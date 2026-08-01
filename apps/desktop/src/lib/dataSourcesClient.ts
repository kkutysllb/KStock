import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

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

export interface DataSourcesApiError {
  message: string;
  status: number;
}

export function isDataSourcesApiError(error: unknown): error is DataSourcesApiError {
  return Boolean(error && typeof error === "object" && "message" in error && "status" in error);
}

async function dataSourcesFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const csrf = readCsrfToken();
  if (csrf) headers.set("X-CSRF-Token", csrf);

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw { message: "无法连接本地引擎，请确认 gateway 已启动", status: 0 } satisfies DataSourcesApiError;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }
  if (!response.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    const message = typeof detail === "string"
      ? detail
      : response.status === 401
        ? "请先登录后管理数据源凭证"
        : "数据源凭证保存失败，请稍后重试";
    throw { message, status: response.status } satisfies DataSourcesApiError;
  }
  return body as T;
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
