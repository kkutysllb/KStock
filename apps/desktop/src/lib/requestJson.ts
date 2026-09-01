/**
 * gateway fetch 通用封装 —— 各 API client 私有 fetch 模板的单一实现。
 *
 * 收敛此前在 10 个 client 中复制粘贴的同一套流程：
 * Headers 构建（Content-Type / CSRF 注入）→ `credentials: "include"` fetch
 * → 非 2xx body 解析（text 容错 / json 优先）→ client 错误工厂归一 → 成功 body 解析。
 *
 * 行为与原模板逐字对齐：
 * - CSRF：经 gatewayUrl 的 `readCsrfToken()` 读 `csrf_token` cookie（gateway
 *   登录后下发的 JS 可读 cookie），按 `csrf` 策略注入 `X-CSRF-Token` header。
 * - headers 容器跟随调用方：`init.headers` 为普通对象时返回普通对象
 *   （turnsClient 的调用形态），未传或为 Headers 实例时构建 Headers 实例
 *   （其余 client 的调用形态）。
 * - 网络层失败：提供 `networkErrorFactory` 时归一为 client 自己的错误
 *   （status 0），否则原样抛出（reports/strategies/turns 的原语义）。
 * - 非 2xx：按策略解析 body 后交给 `errorFactory`，由各 client 生成自己的
 *   `XxxApiError`（错误文案与附加字段零变化）。
 */
import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";
import { detailOf, tolerantParseBody } from "./gatewayApiError";

/** 非 2xx 响应的归一化解析结果（errorFactory 的入参）。 */
export interface GatewayErrorContext {
  /** HTTP 状态码。 */
  status: number;
  /**
   * 错误 body 解析结果：text 容错模式下为 JSON 值 / `{detail: 原文}` / null；
   * json 模式下为 response.json() 的结果（可能是 null），解析失败为 undefined。
   */
  body: unknown;
  /** body.detail（body 为含 detail 的对象时），其余为 undefined。 */
  detail: unknown;
  /** 原始响应文本（json 模式解析失败时的回退展示用；空 body 为 ""）。 */
  rawText: string;
}

/** Content-Type 注入策略。 */
export type ContentTypeMode =
  | "auto" // 有 body 且未显式设置时注入 application/json（auth/dataSources/… 原语义）
  | "always" // 无条件注入（turnsClient jsonHeaders 原语义）
  | "non-get" // 仅非 GET 注入（strategies/scheduledTasks 原语义）
  | "never"; // 从不注入（reports / multipart 上传原语义）

/** CSRF（X-CSRF-Token）注入策略。 */
export type CsrfMode =
  | "if-missing" // 有 csrf cookie 且未显式设置时注入（auth/extensions/memory/models/runtimeConfig 原语义）
  | "always" // 有 csrf cookie 即注入（dataSources/generalSettings/reports/turns 原语义）
  | "non-get"; // 仅非 GET 注入（strategies/scheduledTasks 原语义）

/** 成功（2xx）响应 body 解析策略。 */
export type SuccessParseMode =
  | "tolerant" // text→JSON 容错：空文本 null、解析失败 {detail:原文}（auth 等 7 个 client 原语义）
  | "json" // response.json()，失败原样抛错（reports/strategies/scheduledTasks/turns 原语义）
  | "discard"; // best-effort 消费 body，返回 undefined（turnsClient 的 DELETE/202 void 调用原语义）

/** 非 2xx 错误 body 解析策略。 */
export type ErrorParseMode =
  | "tolerant" // text→JSON 容错（配 successParse "tolerant"）
  | "json"; // 先 json() 失败再 text()（配 successParse "json"/"discard"，turnsClient toError 原语义）

export interface RequestJsonOptions<E> {
  /** 错误工厂：把非 2xx 的 status/body/detail 转成该 client 对外抛出的错误实例。 */
  errorFactory: (ctx: GatewayErrorContext) => E;
  /** 网络层失败（fetch reject）的错误工厂；缺省时网络错误原样抛出。 */
  networkErrorFactory?: () => E;
  /** CSRF 注入策略，默认 "if-missing"。 */
  csrf?: CsrfMode;
  /** Content-Type 注入策略，默认 "auto"。 */
  contentType?: ContentTypeMode;
  /** 成功 body 解析策略，默认 "tolerant"。 */
  successParse?: SuccessParseMode;
  /** 错误 body 解析策略，默认随 successParse（"tolerant"→"tolerant"，其余→"json"）。 */
  errorParse?: ErrorParseMode;
  /** 204 No Content 直接返回 undefined（scheduledTasksClient 原语义），默认 false。 */
  noContentAsUndefined?: boolean;
}

/** 组装请求头：按策略注入 Content-Type 与 CSRF，容器类型跟随调用方。 */
function prepareHeaders(
  initHeaders: HeadersInit | undefined,
  body: BodyInit | null | undefined,
  method: string | undefined,
  contentType: ContentTypeMode,
  csrfMode: CsrfMode,
): HeadersInit {
  // 与 strategies/scheduledTasks 原语义一致：method 存在且非 GET 才算非只读。
  const nonGet = Boolean(method) && method !== "GET";

  const applyContentType = (has: () => boolean, set: (v: string) => void): void => {
    if (contentType === "never") return;
    if (contentType === "always") {
      set("application/json");
      return;
    }
    if (contentType === "non-get") {
      if (nonGet) set("application/json");
      return;
    }
    // auto：有 body 且未显式设置时注入。
    if (body && !has()) set("application/json");
  };

  const applyCsrf = (has: () => boolean, set: (v: string) => void): void => {
    const csrf = readCsrfToken();
    if (!csrf) return;
    if (csrfMode === "always") set(csrf);
    else if (csrfMode === "non-get") {
      if (nonGet) set(csrf);
    } else if (!has()) set(csrf);
  };

  if (initHeaders === undefined || initHeaders instanceof Headers) {
    const headers = new Headers(initHeaders);
    applyContentType(
      () => headers.has("Content-Type"),
      (v) => headers.set("Content-Type", v),
    );
    applyCsrf(
      () => headers.has("X-CSRF-Token"),
      (v) => headers.set("X-CSRF-Token", v),
    );
    return headers;
  }

  // 普通对象头：保持普通对象返回（turnsClient 调用形态）。
  const record = { ...(initHeaders as Record<string, string>) };
  applyContentType(
    () => "Content-Type" in record,
    (v) => {
      record["Content-Type"] = v;
    },
  );
  applyCsrf(
    () => "X-CSRF-Token" in record,
    (v) => {
      record["X-CSRF-Token"] = v;
    },
  );
  return record;
}

/** 非 2xx 响应 → 错误工厂上下文（两种 body 解析策略）。 */
async function parseErrorContext(
  response: Response,
  mode: ErrorParseMode,
): Promise<GatewayErrorContext> {
  const status = response.status;
  if (mode === "json") {
    // turnsClient toError 原语义：优先 response.json()，失败再 text() 回退。
    let body: unknown;
    let rawText = "";
    try {
      body = await response.json();
    } catch {
      try {
        rawText = await response.text();
      } catch {
        // body 已被消费/不可读：保留空文本。
      }
    }
    return { status, body, detail: detailOf(body), rawText };
  }
  const rawText = await response.text();
  const body = tolerantParseBody(rawText);
  return { status, body, detail: detailOf(body), rawText };
}

/**
 * 通用 gateway JSON 请求：请求 `${GATEWAY_URL}${path}`，携带会话 cookie 与
 * CSRF header，非 2xx 经 errorFactory 归一后抛出，2xx 按 successParse 返回 body。
 */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  opts: RequestJsonOptions<unknown>,
): Promise<T> {
  const contentType = opts.contentType ?? "auto";
  const csrfMode = opts.csrf ?? "if-missing";
  const successParse = opts.successParse ?? "tolerant";
  const errorParse =
    opts.errorParse ?? (successParse === "tolerant" ? "tolerant" : "json");

  const headers = prepareHeaders(init.headers, init.body, init.method, contentType, csrfMode);

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (err) {
    if (opts.networkErrorFactory) throw opts.networkErrorFactory();
    throw err;
  }

  if (!response.ok) {
    const ctx = await parseErrorContext(response, errorParse);
    throw opts.errorFactory(ctx);
  }

  if (opts.noContentAsUndefined && response.status === 204) {
    return undefined as T;
  }

  if (successParse === "json") {
    return (await response.json()) as T;
  }
  if (successParse === "discard") {
    // best-effort 消费 body（202/204 等无关键 payload），不让连接悬挂。
    try {
      await response.text();
    } catch {
      /* ignore */
    }
    return undefined as T;
  }
  const text = await response.text();
  return tolerantParseBody(text) as T;
}
