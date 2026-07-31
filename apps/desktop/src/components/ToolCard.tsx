// 紧凑工具调用卡片：
// - 状态点（running 旋转 / done 勾 / error 叉）
// - name + args 摘要（首个 key=value）
// - 有 result 时可点击展开（截断显示）

import { useState } from "react";
import { AlertCircle, Check, ChevronRight, Loader2 } from "lucide-react";
import type { ToolCall } from "../lib/sessionStore";

interface ToolCardProps {
  call: ToolCall;
}

export function ToolCard({ call }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = call.result != null && call.result !== "";

  return (
    <div className={`tool-card status-${call.status}`} aria-label={`工具调用 ${call.name}`}>
      <button
        type="button"
        className="tool-card-header"
        aria-expanded={expanded}
        disabled={!hasResult}
        onClick={() => hasResult && setExpanded((e) => !e)}
      >
        <ToolStatusIcon status={call.status} />
        <code className="tool-name">{call.name}</code>
        <span className="tool-args-summary">{formatArgs(call.args)}</span>
        {hasResult && <ChevronRight size={12} className={expanded ? "chevron-expanded" : ""} />}
      </button>
      {expanded && hasResult && <pre className="tool-result">{truncate(call.result!, 4000)}</pre>}
    </div>
  );
}

function ToolStatusIcon({ status }: { status: ToolCall["status"] }) {
  if (status === "running") return <Loader2 size={12} className="spin" />;
  if (status === "done") return <Check size={12} />;
  return <AlertCircle size={12} />;
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  const [k, v] = entries[0];
  const val = typeof v === "string" ? v : JSON.stringify(v);
  return `${k}=${truncate(val, 40)}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
