import { AlertCircle, Check, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ToolCall } from "../lib/sessionStore";
import {
  formatToolActivityDuration,
  summarizeToolActivity,
  type ToolActivityStatus,
} from "../lib/toolActivity";
import { ToolCard } from "./ToolCard";

interface ToolActivitySummaryProps {
  calls: ToolCall[];
}

export function ToolActivitySummary({ calls }: ToolActivitySummaryProps) {
  if (calls.length === 0) return null;

  const summary = summarizeToolActivity(calls);
  return <ToolActivitySummaryContent calls={calls} summary={summary} />;
}

function ToolActivitySummaryContent({
  calls,
  summary,
}: ToolActivitySummaryProps & { summary: ReturnType<typeof summarizeToolActivity> }) {
  const [expanded, setExpanded] = useState(summary.status === "running");
  const previousStatus = useRef(summary.status);
  const statusLabel = getStatusLabel(summary.status);
  const durationLabel = summary.durationMs != null
    ? ` ${formatToolActivityDuration(summary.durationMs)}`
    : "";

  useEffect(() => {
    if (previousStatus.current !== summary.status) {
      setExpanded(summary.status === "running");
      previousStatus.current = summary.status;
    }
  }, [summary.status]);

  return (
    <section className={`tool-activity-summary status-${summary.status}`} aria-label="工具活动">
      <button
        type="button"
        className="tool-activity-summary-header"
        aria-expanded={expanded}
        aria-label={`${statusLabel}${durationLabel}`}
        onClick={() => setExpanded((value) => !value)}
      >
        <ToolActivityStatusIcon status={summary.status} />
        <span className="tool-activity-status">{statusLabel}{durationLabel}</span>
        <ChevronRight size={13} className={expanded ? "chevron-expanded" : ""} aria-hidden="true" />
      </button>
      <div className="tool-activity-divider" data-testid="tool-activity-divider" />
      {expanded && (
        <div className="tool-activity-details">
          {calls.map((call) => (
            <ToolCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </section>
  );
}

function ToolActivityStatusIcon({ status }: { status: ToolActivityStatus }) {
  if (status === "running") return <Loader2 size={13} className="spin" aria-hidden="true" />;
  if (status === "error") return <AlertCircle size={13} aria-hidden="true" />;
  return <Check size={13} aria-hidden="true" />;
}

function getStatusLabel(status: ToolActivityStatus): string {
  if (status === "running") return "处理中";
  if (status === "error") return "有失败";
  return "已完成";
}
