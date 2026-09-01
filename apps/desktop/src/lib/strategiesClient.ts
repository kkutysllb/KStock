/**
 * 策略工作区 API 客户端（策略库视图消费）。
 *
 * 后端：/api/v1/kstock/strategies*（scripts/kstock_strategies.py）。
 * 策略是持续迭代的活资产（版本链 + 回测运行），与一次性交付物的报告库分离。
 */

import type { GatewayApiError } from "./gatewayApiError";
import { isGatewayApiError } from "./gatewayApiError";
import { requestJson } from "./requestJson";

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

/** 归一化错误形状（共享 GatewayApiError 的别名，保持原导出名）。 */
export type StrategiesApiError = GatewayApiError;

export function isStrategiesApiError(error: unknown): error is StrategiesApiError {
  return isGatewayApiError(error);
}

// 原语义保留：仅非 GET 注入 Content-Type/CSRF；不捕获网络错误；
// 错误消息优先取 detail 字符串，否则回退「请求失败（status）」；成功严格 json()。
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, init, {
    contentType: "non-get",
    csrf: "non-get",
    successParse: "json",
    errorFactory: ({ status, detail }) => ({
      message: typeof detail === "string" ? detail : `请求失败（${status}）`,
      status,
    }),
  });
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
