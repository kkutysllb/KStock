/**
 * 选股工作区 API 客户端（选股库视图消费）。
 *
 * 后端：/api/v1/kstock/selections*（scripts/kstock_selections.py）。
 * 与策略/因子工作区客户端同构：选股方案是持续迭代的活资产（要求版本链 +
 * 运行归档），运行锁定「要求版本 × 基准日 × 股票池 × 执行口径」，
 * 归档完整选股报告与命中清单。
 */

import type { GatewayApiError } from "./gatewayApiError";
import { isGatewayApiError } from "./gatewayApiError";
import { requestJson } from "./requestJson";

export interface SelectionRunSummary {
  run_id: string;
  selection_id: string;
  version: number;
  trade_date: string;
  universe: string;
  rules: Record<string, unknown>;
  metrics: Record<string, unknown>;
  report_path?: string | null;
  picks_path?: string | null;
  created_at: string;
}

export interface Selection {
  selection_id: string;
  name: string;
  criteria: string;
  status: string;
  current_version: number;
  created_at: string;
  updated_at: string;
  latest_run?: SelectionRunSummary | null;
}

export interface SelectionVersion {
  selection_id: string;
  version: number;
  parent_version: number | null;
  criteria: Record<string, unknown>;
  criteria_bytes: number;
  params: Record<string, unknown>;
  change_note: string;
  created_at: string;
}

export interface SelectionRunComparison {
  selection_id: string;
  runs: SelectionRunSummary[];
  comparable: boolean;
  notes: string[];
}

export interface SelectionRunReport {
  run_id: string;
  version: number;
  trade_date: string;
  universe: string;
  report: string;
}

export interface SelectionRunPicks {
  run_id: string;
  version: number;
  trade_date: string;
  picks: Array<Record<string, unknown>>;
}

/** 归一化错误形状（共享 GatewayApiError 的别名，保持与策略/因子客户端一致）。 */
export type SelectionsApiError = GatewayApiError;

export function isSelectionsApiError(error: unknown): error is SelectionsApiError {
  return isGatewayApiError(error);
}

// 与 strategiesClient/factorsClient 同一请求语义：仅非 GET 注入 Content-Type/CSRF。
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

export function listSelections(): Promise<Selection[]> {
  return request<Selection[]>("/api/v1/kstock/selections");
}

export function listSelectionVersions(selectionId: string): Promise<SelectionVersion[]> {
  return request<SelectionVersion[]>(
    `/api/v1/kstock/selections/${encodeURIComponent(selectionId)}/versions`,
  );
}

export function listSelectionRuns(selectionId: string): Promise<SelectionRunSummary[]> {
  return request<SelectionRunSummary[]>(
    `/api/v1/kstock/selections/${encodeURIComponent(selectionId)}/runs`,
  );
}

export function compareSelectionRuns(selectionId: string, runIds: string[]): Promise<SelectionRunComparison> {
  return request<SelectionRunComparison>(
    `/api/v1/kstock/selections/${encodeURIComponent(selectionId)}/compare?runs=${runIds
      .map((id) => encodeURIComponent(id))
      .join(",")}`,
  );
}

export function getSelectionRunPicks(selectionId: string, runId: string): Promise<SelectionRunPicks> {
  return request<SelectionRunPicks>(
    `/api/v1/kstock/selections/${encodeURIComponent(selectionId)}/runs/${encodeURIComponent(runId)}/picks`,
  );
}

export function getSelectionRunReport(selectionId: string, runId: string): Promise<SelectionRunReport> {
  return request<SelectionRunReport>(
    `/api/v1/kstock/selections/${encodeURIComponent(selectionId)}/runs/${encodeURIComponent(runId)}/report`,
  );
}
