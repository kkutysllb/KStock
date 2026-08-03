// 紧凑工具调用卡片（默认折叠）：
// - 折叠态：状态点 + name，整行可点击展开
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
  const toolName = getToolDisplayName(call);
  const hasArgs = Object.keys(call.args ?? {}).length > 0;
  const hasResult = call.result != null && call.result !== "";
  const expandable = hasArgs || hasResult;

  return (
    <div className={`tool-card status-${call.status}`} aria-label={`工具调用 ${toolName}`}>
      <button
        type="button"
        className="tool-card-header"
        aria-expanded={expanded}
        disabled={!expandable}
        onClick={() => expandable && setExpanded((e) => !e)}
      >
        <ToolStatusIcon status={call.status} />
        <code className="tool-name">{toolName}</code>
        {expandable && <ChevronRight size={12} className={expanded ? "chevron-expanded" : ""} />}
      </button>
      {expanded && (
        <div className="tool-card-detail">
          {hasArgs && (
            <div className="tool-args" aria-label="工具参数">
              {Object.entries(call.args).map(([k, v]) => (
                <ToolDetailDisclosure
                  key={k}
                  label={`参数 ${k}`}
                  meta={formatValueMeta(v)}
                  value={formatValue(v)}
                />
              ))}
            </div>
          )}
          {hasResult && (
            <ToolDetailDisclosure
              label="执行结果"
              meta={formatTextMeta(call.result!)}
              value={truncate(call.result!, 4000)}
              result
            />
          )}
        </div>
      )}
    </div>
  );
}

export function getToolDisplayName(call?: Pick<ToolCall, "name" | "status">): string {
  const name = call?.name?.trim();
  if (name) return name;
  return call?.status === "running" ? "准备工具调用" : "未命名工具";
}

function ToolDetailDisclosure({
  label,
  meta,
  value,
  result = false,
}: {
  label: string;
  meta: string;
  value: string;
  result?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`tool-detail-disclosure${result ? " tool-detail-result" : ""}`}>
      <button
        type="button"
        className="tool-detail-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronRight size={12} className={expanded ? "chevron-expanded" : ""} aria-hidden="true" />
        <span>{label}</span>
        <em>{meta}</em>
      </button>
      {expanded && <pre className="tool-detail-value">{value}</pre>}
    </section>
  );
}

function ToolStatusIcon({ status }: { status: ToolCall["status"] }) {
  if (status === "running") return <Loader2 size={12} className="spin" />;
  if (status === "done") return <Check size={12} />;
  return <AlertCircle size={12} />;
}

function formatValue(v: unknown): string {
  if (typeof v === "string") return truncate(v, 4000);
  if (v == null) return String(v);
  return truncate(JSON.stringify(v, null, 2), 4000);
}

function formatValueMeta(v: unknown): string {
  if (typeof v === "string") return formatTextMeta(v);
  if (v == null) return String(v);
  if (Array.isArray(v)) return `${v.length} 项`;
  if (typeof v === "object") return `${Object.keys(v as Record<string, unknown>).length} 个字段`;
  return typeof v;
}

function formatTextMeta(s: string): string {
  return `${s.length} 字符`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
