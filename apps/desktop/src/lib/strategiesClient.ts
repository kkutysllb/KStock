/**
 * 策略工作区 API 客户端（策略库视图消费）。
 *
 * 后端：/api/v1/kstock/strategies*（scripts/kstock_strategies.py）。
 * 策略是持续迭代的活资产（版本链 + 回测运行），与一次性交付物的报告库分离。
 */

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

export interface StrategyRunSummary {
  run_id: string;
  strategy_id: string;
  version: number;
  data_start: string;
  data_end: string;
  rules: Record<string, unknown>;
  metrics: Record<string, unknown>;
  equity_path?: string | null;
  trades_path?: string | null;
  created_at: string;
}

export interface Strategy {
  strategy_id: string;
  name: string;
  hypothesis: string;
  status: string;
  current_version: number;
  created_at: string;
  updated_at: string;
  latest_run?: StrategyRunSummary | null;
}

export interface StrategyVersion {
  strategy_id: string;
  version: number;
  parent_version: number | null;
  code_sha256: string;
  code_bytes: number;
  params: Record<string, unknown>;
  change_note: string;
  created_at: string;
}

export interface StrategyRunComparison {
  strategy_id: string;
  runs: StrategyRunSummary[];
  comparable: boolean;
  notes: string[];
}

export interface StrategyEquity {
  run_id: string;
  version: number;
  data_start: string;
  data_end: string;
  equity: Array<Record<string, unknown>>;
}

export interface StrategiesApiError {
  message: string;
  status: number;
}

export function isStrategiesApiError(error: unknown): error is StrategiesApiError {
  return Boolean(error && typeof error === "object" && "message" in error && "status" in error);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
    const csrf = readCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // 非 JSON 错误体，保留默认消息。
    }
    throw { message, status: response.status } satisfies StrategiesApiError;
  }
  return (await response.json()) as T;
}

export function listStrategies(): Promise<Strategy[]> {
  return request<Strategy[]>("/api/v1/kstock/strategies");
}

export function listStrategyVersions(strategyId: string): Promise<StrategyVersion[]> {
  return request<StrategyVersion[]>(
    `/api/v1/kstock/strategies/${encodeURIComponent(strategyId)}/versions`,
  );
}

export function listStrategyRuns(strategyId: string): Promise<StrategyRunSummary[]> {
  return request<StrategyRunSummary[]>(
    `/api/v1/kstock/strategies/${encodeURIComponent(strategyId)}/runs`,
  );
}

export function compareStrategyRuns(strategyId: string, runIds: string[]): Promise<StrategyRunComparison> {
  return request<StrategyRunComparison>(
    `/api/v1/kstock/strategies/${encodeURIComponent(strategyId)}/compare?runs=${runIds
      .map((id) => encodeURIComponent(id))
      .join(",")}`,
  );
}

export function getStrategyRunEquity(strategyId: string, runId: string): Promise<StrategyEquity> {
  return request<StrategyEquity>(
    `/api/v1/kstock/strategies/${encodeURIComponent(strategyId)}/runs/${encodeURIComponent(runId)}/equity`,
  );
}
