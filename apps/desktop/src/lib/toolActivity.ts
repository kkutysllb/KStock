import type { ToolCall } from "./sessionStore";

export type ToolActivityStatus = "running" | "error" | "done";

export interface ToolActivitySummary {
  status: ToolActivityStatus;
  callCount: number;
  toolCount: number;
  latestResult: string;
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

  return {
    status,
    callCount: calls.length,
    toolCount: new Set(calls.map((call) => call.name)).size,
    latestResult: latestResult.length > 95 ? `${latestResult.slice(0, 95)}…` : latestResult,
  };
}
