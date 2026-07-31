// reasoning 思考流展示（默认折叠）：
// - 流式中（streaming 且 endedAt 未填）：折叠态显示「思考中…」动画摘要，展开看流式全文
// - 完成后（有 endedAt）：折叠态显示「已思考 Ns」，展开看完整思考内容
// - <1s 显示「已思考 <1s」
// 两种态默认折叠；用户点击摘要条展开/收起。

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

  const ms =
    thinkingMs ??
    (reasoning.endedAt != null ? reasoning.endedAt - reasoning.startedAt : 0);

  return (
    <div className={`reasoning-block ${expanded ? "expanded" : "collapsed"}${inProgress ? " in-progress" : ""}`} aria-label={inProgress ? "思考中" : "已思考"}>
      <button
        type="button"
        className="reasoning-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        <Brain size={13} />
        <span>{inProgress ? "思考中…" : `已思考 ${formatDuration(ms)}`}</span>
        <ChevronRight size={12} className={expanded ? "chevron-expanded" : ""} />
      </button>
      {expanded && (
        <div className="reasoning-text">{reasoning.text || (inProgress ? "…" : "")}</div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 1) return "<1s";
  return `${Math.round(seconds)}s`;
}
