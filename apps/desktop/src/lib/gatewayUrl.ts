/**
 * gateway 基地址与共享 cookie 工具。
 *
 * authClient / modelsClient 等多个 API 客户端共享同一 gateway 地址与 CSRF
 * cookie 读取逻辑，抽取到本模块避免重复。``GATEWAY_URL`` 默认指向本地
 * ``http://localhost:18001``（与桌面端 Vite dev server 同属 same-site），
 * 打包态可经 ``VITE_GATEWAY_URL`` 覆盖。
 */

/** gateway 基地址。 */
export const GATEWAY_URL: string =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? "http://localhost:18001";

/**
 * 读取 JS 可读的 ``csrf_token`` cookie（gateway 登录后下发）。
 *
 * 用于 CSRF double-submit：写操作需把该值放入 ``X-CSRF-Token`` header。
 * ``access_token`` 是 HttpOnly cookie，JS 读不到，故不在此处理。
 */
export function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
