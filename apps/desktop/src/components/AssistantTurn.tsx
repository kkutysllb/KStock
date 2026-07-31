// assistant turn 整合：Claude/ChatGPT 风格无气泡布局。
// 从上到下：头像 + StageBadge → ReasoningBlock → SubagentGroup[] →
// ToolCard[]（主 agent）→ 正文 text（markdown 源文本）→ 用量/error。
// 流式时正文末尾闪动光标；空 turn 流式中显示 pending 占位。

import { AlertTriangle, Sparkles, Zap } from "lucide-react";
import type { ChatMessage } from "../lib/sessionStore";
import { Markdown } from "../lib/markdown";
import { StageBadge } from "./StageBadge";
import { ReasoningBlock } from "./ReasoningBlock";
import { ToolCard } from "./ToolCard";
import { SubagentGroup } from "./SubagentGroup";

interface AssistantTurnProps {
  msg: ChatMessage;
  isStreaming?: boolean;
}

export function AssistantTurn({ msg, isStreaming }: AssistantTurnProps) {
  const streaming = isStreaming ?? msg.status === "streaming";
  const hasContent =
    (msg.text && msg.text.length > 0) ||
    msg.reasoning ||
    (msg.toolCalls && msg.toolCalls.length > 0) ||
    (msg.subagents && msg.subagents.length > 0);

  return (
    <article className="assistant-turn" aria-label="助手消息">
      <div className="turn-avatar" aria-hidden="true">
        <Sparkles size={14} />
      </div>
      <div className="turn-body">
        <div className="turn-header">
          <StageBadge stage={msg.stage} streaming={streaming} />
          {msg.status === "compacted" && (
            <span className="compacted-notice" title="引擎已压缩历史上下文">
              上下文已压缩
            </span>
          )}
        </div>

        {msg.reasoning && (
          <ReasoningBlock
            reasoning={msg.reasoning}
            streaming={streaming}
            thinkingMs={msg.thinkingMs}
          />
        )}

        {msg.subagents?.map((t) => <SubagentGroup key={t.taskId} task={t} />)}

        {msg.toolCalls?.map((c) => <ToolCard key={c.id} call={c} />)}

        {msg.text && (
          <div className="turn-text">
            <Markdown>{msg.text}</Markdown>
            {streaming && <span className="streaming-cursor" aria-hidden="true" />}
          </div>
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
