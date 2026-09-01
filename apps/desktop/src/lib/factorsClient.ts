/**
 * 因子工作区 API 客户端（因子库视图消费）。
 *
 * 后端：/api/v1/kstock/factors*（scripts/kstock_factors.py）。
 * 与策略工作区（strategiesClient.ts）同构：因子是持续迭代的活资产
 * （版本链 + 检验运行），检验运行锁定「因子版本 × 股票池 × 数据区间 ×
 * 检验配置」四元组。
 */

import type { GatewayApiError } from "./gatewayApiError";
import { isGatewayApiError } from "./gatewayApiError";
import { requestJson } from "./requestJson";

export interface FactorRunSummary {
  run_id: string;
  factor_id: string;
  version: number;
  universe: string;
  data_start: string;
  data_end: string;
  config: Record<string, unknown>;
  metrics: Record<string, unknown>;
  ic_series_path?: string | null;
  layers_path?: string | null;
  created_at: string;
}

export interface Factor {
  factor_id: string;
  name: string;
  hypothesis: string;
  category: string;
  status: string;
  current_version: number;
  created_at: string;
  updated_at: string;
  latest_run?: FactorRunSummary | null;
}

export interface FactorVersion {
  factor_id: string;
  version: number;
  parent_version: number | null;
  code_sha256: string;
  code_bytes: number;
  params: Record<string, unknown>;
  change_note: string;
  created_at: string;
}

export interface FactorRunComparison {
  factor_id: string;
  runs: FactorRunSummary[];
  comparable: boolean;
  notes: string[];
}

export interface FactorRunIcSeries {
  run_id: string;
  version: number;
  universe: string;
  data_start: string;
  data_end: string;
  ic_series: Array<Record<string, unknown>>;
}

/** 归一化错误形状（共享 GatewayApiError 的别名，保持与策略客户端一致）。 */
export type FactorsApiError = GatewayApiError;

export function isFactorsApiError(error: unknown): error is FactorsApiError {
  return isGatewayApiError(error);
}

// 与 strategiesClient 同一请求语义：仅非 GET 注入 Content-Type/CSRF；
// 错误消息优先取 detail 字符串；成功严格 json()。
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

export function listFactors(): Promise<Factor[]> {
  return request<Factor[]>("/api/v1/kstock/factors");
}

export function listFactorVersions(factorId: string): Promise<FactorVersion[]> {
  return request<FactorVersion[]>(
    `/api/v1/kstock/factors/${encodeURIComponent(factorId)}/versions`,
  );
}

export function listFactorRuns(factorId: string): Promise<FactorRunSummary[]> {
  return request<FactorRunSummary[]>(
    `/api/v1/kstock/factors/${encodeURIComponent(factorId)}/runs`,
  );
}

export function compareFactorRuns(factorId: string, runIds: string[]): Promise<FactorRunComparison> {
  return request<FactorRunComparison>(
    `/api/v1/kstock/factors/${encodeURIComponent(factorId)}/compare?runs=${runIds
      .map((id) => encodeURIComponent(id))
      .join(",")}`,
  );
}

export function getFactorRunIcSeries(factorId: string, runId: string): Promise<FactorRunIcSeries> {
  return request<FactorRunIcSeries>(
    `/api/v1/kstock/factors/${encodeURIComponent(factorId)}/runs/${encodeURIComponent(runId)}/ic_series`,
  );
}
