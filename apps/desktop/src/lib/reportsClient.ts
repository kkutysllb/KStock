import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

export interface ReportLibraryItem {
  report_id: string;
  user_id: string;
  thread_id: string;
  title: string;
  symbol: string | null;
  report_type: string;
  generated_at: string;
  period_start: string | null;
  period_end: string | null;
  risk_level: string | null;
  coverage_status: string | null;
  relative_path: string;
  size_bytes: number;
  content_url?: string;
}

interface ReportsResponse { reports: ReportLibraryItem[] }

async function reportsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const csrf = readCsrfToken();
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) throw new Error(`报告库请求失败（${response.status}）`);
  return (await response.json()) as T;
}

export async function listReports(filters: { date?: string; symbol?: string; query?: string } = {}): Promise<ReportLibraryItem[]> {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.query) params.set("query", filters.query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return (await reportsFetch<ReportsResponse>(`/api/v1/kstock/reports${suffix}`)).reports;
}

export async function deleteReport(reportId: string): Promise<void> {
  await reportsFetch(`/api/v1/kstock/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" });
}

export async function fetchReportHtml(reportId: string): Promise<string> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/kstock/reports/${encodeURIComponent(reportId)}/content`, { credentials: "include" });
  if (!response.ok) throw new Error(`报告加载失败（${response.status}）`);
  return response.text();
}
