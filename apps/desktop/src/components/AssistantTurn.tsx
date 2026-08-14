// assistant turn 整合：Claude/ChatGPT 风格无气泡布局。
// 从上到下：阶段徽章（无工具调用时）→ ReasoningBlock → SubagentGroup[] →
// 执行时间线（Cursor/Cline 风格：正文分段与工具调用按引擎执行顺序交错
// 展示；历史会话无 timeline 时回退「工具活动摘要 + 全文」旧布局）→ error。
// 流式时最后一个正文分段末尾显示迷你 K 线流动（4 根蜡烛错相位脉冲）；
// 空 turn 流式中显示 pending 占位。

import { useMemo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { ChatMessage, HumanInputPayload } from "../lib/sessionStore";
import { Markdown } from "../lib/markdown";
import { splitProseByHeading, shouldSplitProse } from "../lib/proseSegments";
import { StageBadge } from "./StageBadge";
import { ReasoningBlock } from "./ReasoningBlock";
import { SubagentGroup } from "./SubagentGroup";
import { ClarificationCard } from "./ClarificationCard";
import { ToolActivitySummary } from "./ToolActivitySummary";
import { ToolCard } from "./ToolCard";
import { ProseSliceView } from "./ProseSliceView";

interface AssistantTurnProps {
  msg: ChatMessage;
  isStreaming?: boolean;
  showStage?: boolean;
  showReasoning?: boolean;
  showToolCalls?: boolean;
  /** ask_clarification 选项被选中并点“回复并确认”时回调，参数为拼接文本 + 澄清问题（父级弹出确认输入框）。 */
  onClarifyPick?: (text: string, question?: string) => void;
}

/**
 * 检测 turn 是否携带交互式澄清（ask_clarification + 结构化 payload）。
 * 返回 { payload, isInteractive }：
 * - payload：窄化后的 HumanInputPayload（未找到时 undefined）
 * - isInteractive：三种 input_mode（choice_with_other / form / free_text）均为 true，
 *   用于决定是否隐藏 fallback 正文并渲染 ClarificationCard 交互卡片
 */
function detectClarification(msg: ChatMessage): {
  payload?: HumanInputPayload;
  isInteractive: boolean;
} {
  const call = msg.toolCalls?.find(
    (c) => c.name === "ask_clarification" && c.status === "done"
  );
  if (!call) return { isInteractive: false };
  const artifact = call.artifact as
    | { human_input?: unknown }
    | HumanInputPayload
    | undefined;
  const payload = (
    artifact && "human_input" in artifact ? artifact.human_input : artifact
  ) as HumanInputPayload | undefined;
  if (!payload || payload.kind !== "human_input_request") {
    return { isInteractive: false };
  }
  return {
    payload,
    isInteractive:
      payload.input_mode === "choice_with_other" ||
      payload.input_mode === "form" ||
      payload.input_mode === "free_text",
  };
}

/** 交错时间线中的单个正文分段（与旧布局的 turn-text 同款渲染）。 */
function TimelineTextBlock({
  text,
  streaming,
  showCandles,
}: {
  text: string;
  streaming: boolean;
  showCandles: boolean;
}) {
  // 长报告（≥2 个 H1/H2）沿用分段卡片路径，短文本走单 markdown。
  const slices = shouldSplitProse(text) ? splitProseByHeading(text) : null;
  if (slices && slices.length > 1) {
    return (
      <div className="turn-text turn-text-segmented">
        {slices.map((slice, idx) => (
          <ProseSliceView
            key={idx}
            slice={slice}
            isLast={idx === slices.length - 1}
            streaming={streaming}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="turn-text">
      <Markdown>{text}</Markdown>
      {streaming && showCandles && (
        <span className="streaming-candles" aria-hidden="true">
          <span className="candle" />
          <span className="candle" />
          <span className="candle" />
          <span className="candle" />
        </span>
      )}
    </div>
  );
}

export function AssistantTurn({
  msg,
  isStreaming,
  showStage = true,
  showReasoning = true,
  showToolCalls = true,
  onClarifyPick,
}: AssistantTurnProps) {
  const streaming = isStreaming ?? msg.status === "streaming";

  // ask_clarification 交互式澄清检测。
  const { payload: clarifyPayload, isInteractive: hasInteractiveClarification } =
    detectClarification(msg);
  const visibleToolCalls =
    msg.toolCalls?.filter((call) => call.name !== "ask_clarification") ?? [];

  // Cursor/Cline 风格交错时间线：timeline 存在且含工具调用时启用。
  // 历史会话恢复的旧消息没有 timeline，回退旧布局（工具汇总 + 全文）。
  const timeline = msg.timeline;
  const useInterleaved =
    !!timeline && timeline.some((segment) => segment.kind === "tool");
  const interactiveClarification =
    hasInteractiveClarification && !!clarifyPayload && !!onClarifyPick;

  // 旧布局的正文按 H1/H2 切分（仅长报告走分段路径，短消息走单 markdown
  // 原路径）。交错布局各分段独立切分，不在此处理。
  const proseSlices = useMemo(() => {
    if (useInterleaved || !msg.text || !shouldSplitProse(msg.text)) return null;
    return splitProseByHeading(msg.text);
  }, [msg.text, useInterleaved]);
  const hasToolActivity = showToolCalls && visibleToolCalls.length > 0;
  const showTurnHeader = (showStage && !hasToolActivity) || msg.status === "compacted";

  const hasContent =
    (msg.text && msg.text.length > 0) ||
    (showReasoning && msg.reasoning) ||
    (showToolCalls && msg.toolCalls && msg.toolCalls.length > 0) ||
    (msg.subagents && msg.subagents.length > 0) ||
    hasInteractiveClarification;

  // ── 交错时间线渲染项（按执行顺序：正文分段 / 内联工具卡 / 澄清卡）──
  let timelineItems: ReactNode[] = [];
  let trailingTools: typeof visibleToolCalls = [];
  if (useInterleaved && showToolCalls && timeline) {
    // 流式蜡烛：仅在时间线末尾是正文分段时显示（最新活动是文本输出）；
    // 末尾是运行中的工具时，工具卡自带 spinner 表示进度。
    let lastTextPos = -1;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].kind === "text") {
        lastTextPos = i;
        break;
      }
    }
    const candlesAt = lastTextPos === timeline.length - 1 ? lastTextPos : -1;
    const items: ReactNode[] = [];
    let clarified = false;
    timeline.forEach((segment, i) => {
      if (segment.kind === "text") {
        // 交互式澄清：隐藏引擎 fallback 正文（编号列表与卡片重复）。
        if (interactiveClarification) return;
        const segmentText = msg.textSegments?.[segment.index];
        if (!segmentText) return;
        items.push(
          <TimelineTextBlock
            key={`tl-text-${i}`}
            text={segmentText}
            streaming={streaming}
            showCandles={i === candlesAt}
          />
        );
        return;
      }
      const call = msg.toolCalls?.find((c) => c.id === segment.toolCallId);
      if (!call) return;
      if (call.name === "ask_clarification") {
        // 澄清卡渲染在该工具调用的执行位置（而非所有文本之后）。
        if (interactiveClarification && clarifyPayload && !clarified) {
          clarified = true;
          items.push(
            <ClarificationCard
              key={`tl-clarify-${i}`}
              payload={clarifyPayload}
              onPick={(text) => onClarifyPick(text, clarifyPayload.question)}
            />
          );
        }
        return;
      }
      items.push(<ToolCard key={`tl-tool-${i}`} call={call} />);
    });
    // 交互澄清但时间线里没有对应工具段（理论上罕见）：兜底渲染在末尾。
    if (interactiveClarification && clarifyPayload && !clarified) {
      items.push(
        <ClarificationCard
          key="tl-clarify-tail"
          payload={clarifyPayload}
          onPick={(text) => onClarifyPick(text, clarifyPayload.question)}
        />
      );
    }
    timelineItems = items;
    // 不在时间线里的工具调用兜底渲染在末尾，避免任何工具丢失。
    const inTimeline = new Set(
      timeline
        .filter((segment) => segment.kind === "tool")
        .map((segment) => segment.toolCallId)
    );
    trailingTools = visibleToolCalls.filter((call) => !inTimeline.has(call.id));
  }

  return (
    <article className="assistant-turn" aria-label="助手消息">
      <div className="turn-body">
        {showTurnHeader && <div className="turn-header">
          {showStage && !hasToolActivity && <StageBadge stage={msg.stage} streaming={streaming} />}
          {msg.status === "compacted" && (
            <span className="compacted-notice" title="引擎已压缩历史上下文">
              上下文已压缩
            </span>
          )}
        </div>}

        {showReasoning && msg.reasoning && (
          <ReasoningBlock
            reasoning={msg.reasoning}
            streaming={streaming}
            thinkingMs={msg.thinkingMs}
          />
        )}

        {msg.subagents?.map((t) => <SubagentGroup key={t.taskId} task={t} showToolCalls={showToolCalls} />)}

        {useInterleaved && showToolCalls && timeline ? (
          <div className="turn-timeline">
            {timelineItems}
            {trailingTools.length > 0 && <ToolActivitySummary calls={trailingTools} />}
          </div>
        ) : (
          <>
            {showToolCalls && (
              <ToolActivitySummary
                calls={visibleToolCalls}
              />
            )}

            {/*
             * 交互式澄清：三种模式（choice_with_other / form / free_text）均用
             * ClarificationCard 替换 fallback 正文。引擎的 msg.text 是编号列表的
             * 纯文本 fallback，与交互卡片重复，故隐藏（ai message 正文通常为空）。
             */}
            {hasInteractiveClarification && clarifyPayload && onClarifyPick ? (
              <ClarificationCard
                payload={clarifyPayload}
                onPick={(text) => onClarifyPick(text, clarifyPayload.question)}
              />
            ) : (
              msg.text && (
                proseSlices && proseSlices.length > 1 ? (
                  <div className="turn-text turn-text-segmented">
                    {proseSlices.map((slice, idx) => (
                      <ProseSliceView
                        key={idx}
                        slice={slice}
                        isLast={idx === proseSlices.length - 1}
                        streaming={streaming}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="turn-text">
                    <Markdown>{msg.text}</Markdown>
                    {streaming && (
                      <span className="streaming-candles" aria-hidden="true">
                        <span className="candle" />
                        <span className="candle" />
                        <span className="candle" />
                        <span className="candle" />
                      </span>
                    )}
                  </div>
                )
              )
            )}
          </>
        )}

        {!hasContent && streaming && (
          <div className="turn-pending">
            <span className="pending-dots" aria-label="处理中">
              <span />
              <span />
              <span />
            </span>
            <span>正在启动…</span>
          </div>
        )}

        {msg.error && (
          <div className="turn-error">
            <AlertTriangle size={13} />
            <span>{msg.error}</span>
          </div>
        )}
      </div>
    </article>
  );
}
