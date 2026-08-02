import type { ToolCall } from "./sessionStore";

export type ToolActivityStatus = "running" | "error" | "done";

export interface ToolActivitySummary {
  status: ToolActivityStatus;
  callCount: number;
  toolCount: number;
  latestResult: string;
  durationMs?: number;
}

export function summarizeToolActivity(calls: ToolCall[]): ToolActivitySummary {
  const status: ToolActivityStatus = calls.some((call) => call.status === "running")
    ? "running"
    : calls.some((call) => call.status === "error")
      ? "error"
      : "done";
  const latestResult = [...calls]
    .reverse()
    .find((call) => call.result?.trim())
    ?.result?.replace(/\s+/g, " ")
    .trim() ?? "";

  const startedAt = calls.reduce<number | undefined>(
    (earliest, call) => call.startedAt == null || (earliest != null && call.startedAt >= earliest)
      ? earliest
      : call.startedAt,
    undefined
  );
  const endedAt = calls.reduce<number | undefined>(
    (latest, call) => call.endedAt == null || (latest != null && call.endedAt <= latest)
      ? latest
      : call.endedAt,
    undefined
  );

  return {
    status,
    callCount: calls.length,
    toolCount: new Set(calls.map((call) => call.name)).size,
    latestResult: latestResult.length > 95 ? `${latestResult.slice(0, 95)}…` : latestResult,
    ...(status !== "running" && startedAt != null && endedAt != null
      ? { durationMs: Math.max(0, endedAt - startedAt) }
      : {}),
  };
}

export function formatToolActivityDuration(ms: number): string {
  if (ms < 1_000) return "<1s";
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
