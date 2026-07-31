// reasoning 思考流展示：
// - 流式中（streaming 且 endedAt 未填）：带头像流式输出，标题"思考中…"
// - 完成后（有 endedAt）：折叠为「已思考 Ns」，点击展开查看全文
// - <1s 显示「已思考 <1s」

import { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import type { ReasoningBlock as ReasoningData } from "../lib/sessionStore";

interface ReasoningBlockProps {
  reasoning: ReasoningData;
  /** turn 是否流式中。 */
  streaming?: boolean;
  /** reasoning 耗时（ms），来自 turnReducer；缺省时从 reasoning 计算。 */
  thinkingMs?: number;
}

export function ReasoningBlock({ reasoning, streaming, thinkingMs }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const inProgress = streaming && reasoning.endedAt == null;

  if (inProgress) {
    return (
      <div className="reasoning-block in-progress" aria-label="思考中">
        <div className="reasoning-header">
          <Brain size={13} />
          <span>思考中…</span>
        </div>
        <div className="reasoning-text">{reasoning.text || "…"}</div>
      </div>
    );
  }

  const ms =
    thinkingMs ??
    (reasoning.endedAt != null ? reasoning.endedAt - reasoning.startedAt : 0);

  return (
    <div className="reasoning-block collapsed">
      <button
        type="button"
        className="reasoning-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        <Brain size={13} />
        <span>已思考 {formatDuration(ms)}</span>
        <ChevronRight size={12} className={expanded ? "chevron-expanded" : ""} />
      </button>
      {expanded && <div className="reasoning-text">{reasoning.text}</div>}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 1) return "<1s";
  return `${Math.round(seconds)}s`;
}
