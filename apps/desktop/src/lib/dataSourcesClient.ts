import type { GatewayApiError } from "./gatewayApiError";
import { isGatewayApiError } from "./gatewayApiError";
import { requestJson } from "./requestJson";

export interface DataSourceConfig {
  id: "tushare" | "iwencai";
  label: string;
  env_name: string;
  configured: boolean;
}

export interface DataSourcesResponse {
  sources: DataSourceConfig[];
}

export interface DataSourcesWritePayload {
  tushare_token?: string | null;
  iwencai_api_key?: string | null;
}

/** 归一化错误形状（共享 GatewayApiError 的别名，保持原导出名）。 */
export type DataSourcesApiError = GatewayApiError;

export function isDataSourcesApiError(error: unknown): error is DataSourcesApiError {
  return isGatewayApiError(error);
}

async function dataSourcesFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, init, {
    csrf: "always",
    networkErrorFactory: () => ({
      message: "无法连接本地引擎，请确认 gateway 已启动",
      status: 0,
    }),
    errorFactory: ({ status, detail }) => ({
      message: typeof detail === "string"
        ? detail
        : status === 401
          ? "请先登录后管理数据源凭证"
          : "数据源凭证保存失败，请稍后重试",
      status,
    }),
  });
}

export function getDataSources(): Promise<DataSourcesResponse> {
  return dataSourcesFetch<DataSourcesResponse>("/api/v1/kstock/data-sources");
}

export function getDataSourceStatus(): Promise<DataSourcesResponse> {
  return dataSourcesFetch<DataSourcesResponse>("/api/v1/kstock/data-source-status");
}

export function updateDataSources(payload: DataSourcesWritePayload): Promise<DataSourcesResponse> {
  return dataSourcesFetch<DataSourcesResponse>("/api/v1/kstock/data-sources", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
