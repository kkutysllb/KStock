import { AlertCircle, Check, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ToolCall } from "../lib/sessionStore";
import { getToolDisplayName, ToolCard } from "./ToolCard";

interface ToolCallGroupProps {
  calls: ToolCall[];
  compact?: boolean;
}

/** 同名工具调用的聚合视图：默认只显示摘要，展开后保留每次调用的完整详情。 */
export function ToolCallGroup({ calls, compact = false }: ToolCallGroupProps) {
  const [firstCall] = calls;
  const [expanded, setExpanded] = useState(false);
  const status = groupStatus(calls);
  const summary = summarize(calls);
  const toolName = getToolDisplayName(firstCall ? { name: firstCall.name, status } : undefined);

  return (
    <div className={`tool-group status-${status}${compact ? " tool-group-compact" : ""}`}>
      <button
        type="button"
        className="tool-group-header"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <GroupStatusIcon status={status} />
        <code>{toolName}</code>
        <span className="tool-group-count">{calls.length} 次调用</span>
        <span className="tool-group-status">{statusLabel(status)}</span>
        {summary && <span className="tool-group-summary">{summary}</span>}
        <ChevronRight size={13} className={expanded ? "chevron-expanded" : ""} />
      </button>
      {expanded && (
        <div className="tool-group-items">
          {calls.map((call) => <ToolCard key={call.id} call={call} />)}
        </div>
      )}
    </div>
  );
}

export function groupToolCalls(calls: ToolCall[]): ToolCall[][] {
  const groups: ToolCall[][] = [];
  const byName = new Map<string, ToolCall[]>();
  for (const call of calls) {
    const existing = byName.get(call.name);
    if (existing) {
      existing.push(call);
      continue;
    }
    const group = [call];
    byName.set(call.name, group);
    groups.push(group);
  }
  return groups;
}

function groupStatus(calls: ToolCall[]): ToolCall["status"] {
  if (calls.some((call) => call.status === "running")) return "running";
  if (calls.some((call) => call.status === "error")) return "error";
  return "done";
}

function statusLabel(status: ToolCall["status"]): string {
  if (status === "running") return "调用中";
  if (status === "error") return "有失败";
  return "已完成";
}

function GroupStatusIcon({ status }: { status: ToolCall["status"] }) {
  if (status === "running") return <Loader2 size={12} className="spin" />;
  if (status === "error") return <AlertCircle size={12} />;
  return <Check size={12} />;
}

function summarize(calls: ToolCall[]): string {
  if (calls.some((call) => call.result?.trim())) return "有输出";
  if (calls.some((call) => Object.keys(call.args ?? {}).length > 0)) return "有参数";
  return "";
}
