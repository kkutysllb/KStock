export interface SidecarRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface SidecarResponse<T = unknown> {
  id: string;
  ok: boolean;
  result?: T;
  error?: string;
}
