/**
 * 工具调用折叠组：正文分段之间的工具调用（单个或连续多个）统一收拢为
 * 一行汇总条，默认折叠（不打断阅读），用户点击手动展开——视觉与交互
 * 对所有工具调用保持一致。
 *
 * 汇总条展示：调用数量、工具名聚合（finance_data_search ×3 · bash ×2）、
 * 聚合状态（运行中 k / n 失败 / 已完成）。运行中的组默认也保持折叠——
 * 状态就显示在汇总条上，需要看细节时再展开。
 */

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { ToolCall } from "../lib/sessionStore";
import { ToolCard, getToolDisplayName } from "./ToolCard";

/** 名字聚合最多展示的工种数，超出用省略号。 */
const MAX_NAME_SUMMARY = 3;

function summarizeNames(calls: ToolCall[]): string {
  const counts = new Map<string, number>();
  for (const call of calls) {
    const name = getToolDisplayName(call) || call.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
  if (parts.length <= MAX_NAME_SUMMARY) return parts.join(" · ");
  return `${parts.slice(0, MAX_NAME_SUMMARY).join(" · ")} 等 ${parts.length} 种`;
}

export function ToolRunGroup({
  calls,
  render,
}: {
  calls: ToolCall[];
  /** 单卡渲染注入（默认 ToolCard），便于测试替身。 */
  render?: (call: ToolCall) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const running = calls.filter((call) => call.status === "running").length;
  const failed = calls.filter((call) => call.status === "error").length;

  const statusText =
    running > 0
      ? `运行中 ${running}/${calls.length}`
      : failed > 0
        ? `${failed} 项失败`
        : "已完成";
  const statusClass = running > 0 ? "running" : failed > 0 ? "error" : "done";

  return (
    <div className={`tool-run-group status-${statusClass}`} aria-label={`${calls.length} 个工具调用`}>
      <button
        className="tool-run-group-bar"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench size={12} className="tool-run-group-icon" />
        <span className="tool-run-group-count">工具调用 {calls.length} 项</span>
        <span className="tool-run-group-names">{summarizeNames(calls)}</span>
        <span className={`tool-run-group-status ${statusClass}`}>
          {running > 0 && <span className="tool-run-group-spinner" aria-hidden="true" />}
          {statusText}
        </span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className="tool-run-group-body">
          {calls.map((call) => render?.(call) ?? <ToolCard key={call.id} call={call} />)}
        </div>
      )}
    </div>
  );
}
