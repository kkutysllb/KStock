// 紧凑工具调用卡片（默认折叠）：
// - 折叠态：状态点 + name + 状态标签（调用中/已完成/失败），整行可点击展开
// - 展开态：args 详情（key=value 列表）+ result（截断显示）
// - running 状态保持折叠，仅 spinner 提示进度

import { useState } from "react";
import { AlertCircle, Check, ChevronRight, Loader2 } from "lucide-react";
import type { ToolCall } from "../lib/sessionStore";

interface ToolCardProps {
  call: ToolCall;
}

export function ToolCard({ call }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs = Object.keys(call.args ?? {}).length > 0;
  const hasResult = call.result != null && call.result !== "";
  const expandable = hasArgs || hasResult;

  return (
    <div className={`tool-card status-${call.status}`} aria-label={`工具调用 ${call.name}`}>
      <button
        type="button"
        className="tool-card-header"
        aria-expanded={expanded}
        disabled={!expandable}
        onClick={() => expandable && setExpanded((e) => !e)}
      >
        <ToolStatusIcon status={call.status} />
        <code className="tool-name">{call.name}</code>
        <span className="tool-status-label">{statusLabel(call.status)}</span>
        {expandable && <ChevronRight size={12} className={expanded ? "chevron-expanded" : ""} />}
      </button>
      {expanded && (
        <div className="tool-card-detail">
          {hasArgs && (
            <dl className="tool-args">
              {Object.entries(call.args).map(([k, v]) => (
                <div key={k} className="tool-arg-row">
                  <dt>{k}</dt>
                  <dd>{formatValue(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          {hasResult && <pre className="tool-result">{truncate(call.result!, 4000)}</pre>}
        </div>
      )}
    </div>
  );
}

function ToolStatusIcon({ status }: { status: ToolCall["status"] }) {
  if (status === "running") return <Loader2 size={12} className="spin" />;
  if (status === "done") return <Check size={12} />;
  return <AlertCircle size={12} />;
}

function statusLabel(status: ToolCall["status"]): string {
  switch (status) {
    case "running":
      return "调用中";
    case "done":
      return "已完成";
    case "error":
      return "失败";
  }
}

function formatValue(v: unknown): string {
  if (typeof v === "string") return truncate(v, 200);
  if (v == null) return String(v);
  return truncate(JSON.stringify(v), 200);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
