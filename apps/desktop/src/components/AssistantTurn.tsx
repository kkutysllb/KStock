// assistant turn 整合：Claude/ChatGPT 风格无气泡布局。
// 从上到下：头像 + StageBadge → ReasoningBlock → SubagentGroup[] →
// ToolCard[]（主 agent）→ 正文 text（markdown 源文本）→ 用量/error。
// 流式时正文末尾闪动光标；空 turn 流式中显示 pending 占位。

import { AlertTriangle, Sparkles, Zap } from "lucide-react";
import type { ChatMessage, HumanInputPayload } from "../lib/sessionStore";
import { Markdown } from "../lib/markdown";
import { StageBadge } from "./StageBadge";
import { ReasoningBlock } from "./ReasoningBlock";
import { ToolCard } from "./ToolCard";
import { SubagentGroup } from "./SubagentGroup";
import { ClarificationCard } from "./ClarificationCard";

interface AssistantTurnProps {
  msg: ChatMessage;
  isStreaming?: boolean;
  showStage?: boolean;
  showReasoning?: boolean;
  showToolCalls?: boolean;
  /** ask_clarification 选项被选中并点“加入输入框”时回调，参数为拼接文本。 */
  onClarifyPick?: (text: string) => void;
}

/**
 * 检测 turn 是否携带交互式澄清（ask_clarification + choice_with_other payload）。
 * 返回 { payload, isInteractive }：
 * - payload：窄化后的 HumanInputPayload（未找到时 undefined）
 * - isInteractive：仅 input_mode=choice_with_other 为 true，用于决定是否隐藏 fallback 文本
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
    | undefined;
  const payload = artifact?.human_input as HumanInputPayload | undefined;
  if (!payload || payload.kind !== "human_input_request") {
    return { isInteractive: false };
  }
  return {
    payload,
    isInteractive: payload.input_mode === "choice_with_other",
  };
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

  const hasContent =
    (msg.text && msg.text.length > 0) ||
    (showReasoning && msg.reasoning) ||
    (showToolCalls && msg.toolCalls && msg.toolCalls.length > 0) ||
    (msg.subagents && msg.subagents.length > 0) ||
    hasInteractiveClarification;

  return (
    <article className="assistant-turn" aria-label="助手消息">
      <div className="turn-avatar" aria-hidden="true">
        <Sparkles size={14} />
      </div>
      <div className="turn-body">
        {(showStage || msg.status === "compacted") && <div className="turn-header">
          {showStage && <StageBadge stage={msg.stage} streaming={streaming} />}
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

        {showToolCalls && msg.toolCalls
          ?.filter((c) => c.name !== "ask_clarification")
          .map((c) => <ToolCard key={c.id} call={c} />)}

        {/*
         * 交互式澄清（choice_with_other）：用 ClarificationCard 替换 fallback 正文。
         * 引擎的 msg.text 是编号列表的纯文本 fallback，与选项卡重复，故隐藏。
         * 非交互模式（form/free_text）保留 msg.text，ClarificationCard 内部退化提示。
         */}
        {hasInteractiveClarification && clarifyPayload && onClarifyPick ? (
          <ClarificationCard payload={clarifyPayload} onPick={onClarifyPick} />
        ) : (
          msg.text && (
            <div className="turn-text">
              <Markdown>{msg.text}</Markdown>
              {streaming && <span className="streaming-cursor" aria-hidden="true" />}
            </div>
          )
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

        <TurnFooter msg={msg} />

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

function TurnFooter({ msg }: { msg: ChatMessage }) {
  if (!msg.usage) return null;
  return (
    <div className="turn-footer">
      <span className="usage-chip">
        <Zap size={11} />
        {msg.usage.total_tokens} tokens
      </span>
    </div>
  );
}
