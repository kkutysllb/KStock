/**
 * CSRF double-submit token 桥接。
 *
 * gateway 使用 Double Submit Cookie 模式做 CSRF 防护：受保护端点需同时
 * 携带 ``csrf_token`` cookie 与 ``X-CSRF-Token`` header，且两者相等。
 *
 * 打包态渲染进程加载 ``app://localhost``，与 gateway 下发 cookie 的
 * ``http://localhost:<port>`` origin 跨 scheme 隔离，``document.cookie``
 * 读不到 ``csrf_token``，无法在前端构造 header。本模块从主进程 session
 * cookie jar（``net.fetch`` 自动存储 gateway 下发的 cookie）读取 token，
 * 供 ``app://`` 反向代理为每个转发请求注入 header。
 *
 * gateway 端 ``CSRFMiddleware`` 同时校验 cookie（``net.fetch`` 自动携带）
 * 与 header（代理注入），两者相等即通过。auth 端点（login/register/
 * logout/initialize）CSRF 豁免，注入对它们无副作用。
 *
 * 安全边界：仅经本地代理的请求生效；外部 origin 直连 gateway 仍受
 * gateway 的 CORS + CSRF + access_token 认证完整保护。
 */

import { session } from "electron";

/** gateway CSRF double-submit cookie 名（与 ``csrf_middleware.CSRF_COOKIE_NAME`` 一致）。 */
const CSRF_COOKIE_NAME = "csrf_token";

/**
 * 从主进程 session cookie jar 读取 gateway 下发的 ``csrf_token``。
 *
 * @returns token 值；cookie 不存在或读取失败时返回 ``null``。
 */
export async function readGatewayCsrfToken(gatewayPort: number): Promise<string | null> {
  try {
    const cookies = await session.defaultSession.cookies.get({
      url: `http://localhost:${gatewayPort}`,
      name: CSRF_COOKIE_NAME,
    });
    if (cookies.length > 0 && cookies[0].value) {
      return cookies[0].value;
    }
  } catch {
    // cookie 读取失败不阻断转发；gateway 会以 403 拒绝，前端有错误提示。
  }
  return null;
}

/**
 * 为转发给 gateway 的请求注入 ``X-CSRF-Token`` header。
 *
 * 若 header 已存在（渲染进程显式设置），保留原值不覆盖。
 */
export async function ensureCsrfHeader(
  forwardHeaders: Headers,
  gatewayPort: number,
): Promise<void> {
  if (forwardHeaders.has("x-csrf-token")) return;
  const token = await readGatewayCsrfToken(gatewayPort);
  if (token) {
    forwardHeaders.set("x-csrf-token", token);
  }
}
