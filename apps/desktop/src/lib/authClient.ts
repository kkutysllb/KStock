/**
 * KStock 认证 API 客户端 —— 对接内置 QiLin gateway。
 *
 * 设计要点
 * --------
 * - 所有请求带 ``credentials: "include"``，让 gateway 下发的 ``access_token``
 *   (HttpOnly) 与 ``csrf_token`` (JS 可读) cookie 随请求自动携带。
 * - 注册 / 登录 / 登出 / 初始化 属于 gateway 的 CSRF ``_AUTH_EXEMPT_PATHS``，
 *   首次请求无需 X-CSRF-Token；登录成功后 gateway 会下发 ``csrf_token`` cookie，
 *   后续受保护的状态变更请求由 ``withCsrfHeader`` 自动读取并附加。
 * - gateway 的错误响应有三种形态，``parseGatewayError`` 统一归一为
 *   ``AuthApiError``，供 UI 按 ``code`` 给出中文友好提示。
 */

/** gateway /api/v1/auth/me 与注册响应中的用户对象。 */
export interface AuthUser {
  id: string;
  email: string;
  system_role: "admin" | "user";
  needs_setup?: boolean;
  oauth_provider?: string | null;
}

/** gateway ``AuthErrorCode`` 的镜像（见 vendor/.../auth/errors.py）。 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "token_expired"
  | "token_invalid"
  | "user_not_found"
  | "email_already_exists"
  | "provider_not_found"
  | "not_authenticated"
  | "system_already_initialized"
  | "registration_disabled"
  | "validation_error"
  | "rate_limited"
  | "network_error"
  | "unknown";

/** 归一化后的认证错误。 */
export interface AuthApiError {
  code: AuthErrorCode;
  /** 面向用户的中文提示。 */
  message: string;
  /** HTTP 状态码（网络错误时为 0）。 */
  status: number;
}

/** 注册请求体（对应 gateway ``/api/v1/auth/register``）。 */
export interface RegisterPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

/** 初始化管理员请求体（对应 gateway ``/api/v1/auth/initialize``）。 */
export interface InitializeAdminPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

/** /setup-status 响应。 */
export interface SetupStatus {
  needs_setup: boolean;
  registration_enabled: boolean;
}

/**
 * gateway 基地址。
 *
 * Tauri dev / 浏览器预览默认走 Vite dev server (``http://localhost:1420``)，
 * 与 gateway ``http://localhost:18001`` 同属 ``localhost`` registrable domain，
 * 属于 same-site，``samesite=lax`` 的 access_token cookie 可随 fetch 发送。
 * 打包态可经 ``VITE_GATEWAY_URL`` 覆盖。
 */
export const GATEWAY_URL: string =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? "http://localhost:18001";

/** 读取 JS 可读的 csrf_token cookie（gateway 登录后下发）。 */
function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** gateway 错误码 → 中文友好提示。 */
const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: "邮箱或密码不正确",
  token_expired: "登录已过期，请重新登录",
  token_invalid: "登录态无效，请重新登录",
  user_not_found: "账户不存在，请重新登录或注册",
  email_already_exists: "该邮箱已注册，请直接登录",
  provider_not_found: "不支持的登录方式",
  not_authenticated: "请先登录",
  system_already_initialized: "系统已初始化",
  registration_disabled: "当前部署未开放自助注册",
  validation_error: "提交内容有误，请检查邮箱与密码",
  rate_limited: "尝试过于频繁，请稍后再试",
  network_error: "无法连接本地引擎，请确认 gateway 已启动",
  unknown: "操作失败，请稍后重试",
};

/**
 * 把 gateway 的多种错误响应形态归一为 ``AuthApiError``。
 *
 * gateway 三种错误 body：
 * 1. ``{detail: {code, message}}`` —— 结构化业务错误（多数 auth 端点）
 * 2. ``{detail: "..."}``            —— 裸字符串（如登录限流 429）
 * 3. ``{detail: [{loc, msg}]}``      —— pydantic 校验错误（422）
 */
function parseGatewayError(status: number, body: unknown): AuthApiError {
  let code: AuthErrorCode = "unknown";
  let rawMessage = "";

  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (detail && typeof detail === "object" && "code" in detail) {
      // 形态 1：结构化业务错误
      const d = detail as { code?: string; message?: string };
      code = (d.code as AuthErrorCode) ?? "unknown";
      rawMessage = d.message ?? "";
    } else if (typeof detail === "string") {
      // 形态 2：裸字符串
      rawMessage = detail;
      if (status === 429) code = "rate_limited";
    } else if (Array.isArray(detail)) {
      // 形态 3：pydantic 校验错误
      code = "validation_error";
      rawMessage = detail
        .map((e: { msg?: string }) => e?.msg ?? "")
        .filter(Boolean)
        .join("；");
    }
  }

  // 状态码兜底（如 401 未带 detail）
  if (code === "unknown") {
    if (status === 401) code = "not_authenticated";
    else if (status === 403) code = "registration_disabled";
    else if (status === 429) code = "rate_limited";
  }

  // 已知错误码优先用中文映射（更好 UX）；未知错误码才回退到 gateway 原文。
  const knownMessage = code !== "unknown" ? ERROR_MESSAGES[code] : "";
  return {
    code,
    message: knownMessage || rawMessage || ERROR_MESSAGES.unknown,
    status,
  };
}

/** 统一 fetch 封装：带 cookie、归一错误、JSON 解析。 */
async function gatewayFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // 若已有 csrf_token cookie，为受保护端点自动附加 double-submit header。
  // auth exempt 端点没有 cookie 时不附加，无副作用。
  const csrf = readCsrfToken();
  if (csrf && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrf);
  }

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    // 网络层失败：gateway 未启动 / 跨域被拦
    const err: AuthApiError = {
      code: "network_error",
      message: ERROR_MESSAGES.network_error,
      status: 0,
    };
    throw err;
  }

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }

  if (!response.ok) {
    throw parseGatewayError(response.status, body);
  }

  return body as T;
}

// ── 认证 API ────────────────────────────────────────────────────────────

/** 探测系统初始化状态与是否开放注册（GET，公开）。 */
export function getSetupStatus(): Promise<SetupStatus> {
  return gatewayFetch<SetupStatus>("/api/v1/auth/setup-status");
}

/** 注册本地普通账户；成功后 gateway 同步下发会话 cookie（自动登录）。 */
export function register(payload: RegisterPayload): Promise<AuthUser> {
  return gatewayFetch<AuthUser>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 首次启动初始化管理员账户（对应 gateway ``/api/v1/auth/initialize``）。
 *
 * 仅当 ``setup-status`` 返回 ``needs_setup=true`` 时可调用，成功后创建
 * ``system_role="admin"`` 的账户并下发会话 cookie。已存在 admin 时返回
 * 409 ``system_already_initialized``。这是引擎侧「角色」的唯一体现：
 * 首个初始化账户为管理员，后续 ``register`` 只能创建普通用户。
 */
export function initializeAdmin(payload: InitializeAdminPayload): Promise<AuthUser> {
  return gatewayFetch<AuthUser>("/api/v1/auth/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 本地邮箱密码登录。
 *
 * gateway 使用 OAuth2PasswordRequestForm，故请求体为 form-urlencoded：
 * username=email、password、remember_me。成功后下发 access_token cookie。
 */
export function login(email: string, password: string, rememberMe = true): Promise<{ expires_in: number; needs_setup: boolean }> {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  form.set("remember_me", rememberMe ? "true" : "false");
  return gatewayFetch<{ expires_in: number; needs_setup: boolean }>("/api/v1/auth/login/local", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

/** 登出：清除 gateway 会话 cookie。 */
export function logout(): Promise<{ message: string }> {
  return gatewayFetch<{ message: string }>("/api/v1/auth/logout", { method: "POST" });
}

/** 读取当前会话用户；未登录时抛 ``not_authenticated`` 错误。 */
export function getCurrentUser(): Promise<AuthUser> {
  return gatewayFetch<AuthUser>("/api/v1/auth/me");
}

/** 判断当前是否已登录（吞掉 401，返回 null）。 */
export async function tryGetCurrentUser(): Promise<AuthUser | null> {
  try {
    return await getCurrentUser();
  } catch (err) {
    const apiErr = err as AuthApiError;
    if (apiErr?.code === "not_authenticated" || apiErr?.status === 401) {
      return null;
    }
    throw err;
  }
}

/** 类型守卫：判断异常是否为归一化后的 AuthApiError。 */
export function isAuthApiError(err: unknown): err is AuthApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    "status" in err
  );
}
