/**
 * gateway API 错误共享形状与解析 helper。
 *
 * 此前 authClient / dataSourcesClient / extensionsClient / generalSettingsClient /
 * memoryClient / modelsClient / runtimeConfigClient / scheduledTasksClient /
 * strategiesClient / gatewayControlClient 等 client 各自定义了同构的
 * `XxxApiError { message, status }` interface、同构的 `isXxxApiError` 守卫，
 * 以及同构的「Response text → JSON 容错解析 + detail 提取」逻辑。本模块将其
 * 收敛为单一实现：
 *
 * - GatewayApiError：错误共享形状（各 client 的 `XxxApiError` 以类型别名或
 *   `extends` 保持原导出名不变，组件侧用法不受影响）。
 * - isGatewayApiError：单一守卫实现（各 `isXxxApiError` 变为一行委托）。
 * - tolerantParseBody / detailOf：body 容错解析与 detail 提取原语，供
 *   requestJson 的错误工厂上下文使用。
 */

/** gateway API client 错误的共享形状（额外字段由各 client 通过 extends 追加）。 */
export interface GatewayApiError {
  message: string;
  status: number;
}

/**
 * 单一守卫实现：判断捕获值是否为归一化 API 错误形状。
 *
 * 与原先各 client 的 `isXxxApiError` 逐字等价：
 * `typeof err === "object" && err !== null && "message" in err && "status" in err`。
 */
export function isGatewayApiError(err: unknown): err is GatewayApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    "status" in err
  );
}

/** 提取错误 body 中的 detail 字段；body 为 null / 标量 / 无 detail 时返回 undefined。 */
export function detailOf(body: unknown): unknown {
  return (body as { detail?: unknown } | null | undefined)?.detail;
}

/**
 * 容错解析响应 body 文本（各 client 原有语义）：
 * 空文本 → null；JSON.parse 成功 → 解析值；失败 → `{ detail: 原文 }`
 * （即「解析失败返回原文」：原文挂到 detail 上，供错误文案直接采用）。
 */
export function tolerantParseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}
