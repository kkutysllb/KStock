import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

export interface GeneralPreferences {
  density: "comfortable" | "compact";
  reduce_motion: boolean;
  sidebar_collapsed: boolean;
  history_collapsed: boolean;
  auto_scroll: boolean;
  show_stage: boolean;
  show_reasoning: boolean;
  show_tool_calls: boolean;
  restore_last_session: boolean;
  create_session_when_empty: boolean;
  send_shortcut: "enter" | "mod_enter";
  keep_draft_after_send: boolean;
  keep_attachments_after_send: boolean;
}

export const DEFAULT_GENERAL_PREFERENCES: GeneralPreferences = {
  density: "comfortable",
  reduce_motion: false,
  sidebar_collapsed: false,
  history_collapsed: false,
  auto_scroll: true,
  show_stage: true,
  show_reasoning: true,
  show_tool_calls: true,
  restore_last_session: true,
  create_session_when_empty: false,
  send_shortcut: "mod_enter",
  keep_draft_after_send: false,
  keep_attachments_after_send: false,
};

export interface GeneralSettingsApiError {
  message: string;
  status: number;
}

export function isGeneralSettingsApiError(error: unknown): error is GeneralSettingsApiError {
  return Boolean(error && typeof error === "object" && "message" in error && "status" in error);
}

async function settingsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const csrf = readCsrfToken();
  if (csrf) headers.set("X-CSRF-Token", csrf);
  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw { message: "无法连接本地引擎，请确认 gateway 已启动", status: 0 } satisfies GeneralSettingsApiError;
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
        ? "请先登录后管理常规设置"
        : "常规设置保存失败，请稍后重试";
    throw { message, status: response.status } satisfies GeneralSettingsApiError;
  }
  return body as T;
}

function withDefaults(value: Partial<GeneralPreferences>): GeneralPreferences {
  return { ...DEFAULT_GENERAL_PREFERENCES, ...value };
}

export async function getGeneralPreferences(): Promise<GeneralPreferences> {
  const response = await settingsFetch<{ preferences?: Partial<GeneralPreferences> }>(
    "/api/v1/kstock/general-settings"
  );
  return withDefaults(response.preferences ?? {});
}

export async function updateGeneralPreferences(
  preferences: GeneralPreferences
): Promise<GeneralPreferences> {
  const response = await settingsFetch<{ preferences: GeneralPreferences }>(
    "/api/v1/kstock/general-settings",
    { method: "PUT", body: JSON.stringify({ ...preferences }) }
  );
  return withDefaults(response.preferences);
}
