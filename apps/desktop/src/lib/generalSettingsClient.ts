import type { GatewayApiError } from "./gatewayApiError";
import { isGatewayApiError } from "./gatewayApiError";
import { requestJson } from "./requestJson";

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
  notify_task_done: boolean;
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
  send_shortcut: "enter",
  keep_draft_after_send: false,
  keep_attachments_after_send: false,
  notify_task_done: true,
};

/** 归一化错误形状（共享 GatewayApiError 的别名，保持原导出名）。 */
export type GeneralSettingsApiError = GatewayApiError;

export function isGeneralSettingsApiError(error: unknown): error is GeneralSettingsApiError {
  return isGatewayApiError(error);
}

async function settingsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
          ? "请先登录后管理常规设置"
          : "常规设置保存失败，请稍后重试",
      status,
    }),
  });
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

async function putPreferences(preferences: GeneralPreferences): Promise<GeneralPreferences> {
  const response = await settingsFetch<{ preferences: GeneralPreferences }>(
    "/api/v1/kstock/general-settings",
    { method: "PUT", body: JSON.stringify({ ...preferences }) }
  );
  return withDefaults(response.preferences);
}

export async function updateGeneralPreferences(
  preferences: GeneralPreferences
): Promise<GeneralPreferences> {
  try {
    return await putPreferences(preferences);
  } catch (error) {
    // 旧版 gateway 的 GeneralPreferences 是 extra="forbid"：前端新增字段
    // （notify_task_done）会被 422 拒绝。剥离新增字段重试一次，保证旧网关
    // 下其余设置仍可保存；重建网关包（build-gateway-bundle.sh）后字段自然
    // 生效。返回值经 withDefaults 补齐，调用方无感。
    if (
      isGeneralSettingsApiError(error) &&
      error.status === 422 &&
      "notify_task_done" in preferences
    ) {
      const legacy = { ...preferences } as Partial<GeneralPreferences>;
      delete legacy.notify_task_done;
      return putPreferences(legacy as GeneralPreferences);
    }
    throw error;
  }
}
