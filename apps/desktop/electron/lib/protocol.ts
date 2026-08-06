/**
 * ``app://`` 自定义协议：静态资源服务 + gateway 同源反向代理。
 *
 * 渲染层统一加载 ``app://localhost/index.html``，gateway 请求经
 * ``app://localhost/gateway/*`` 由本模块反向代理到 ``http://localhost:18001``。
 * 前端与 gateway 同 origin（``app://localhost``）→ cookie 归属同一 origin、
 * same-site 自动满足、无 CORS；代理将 Origin 改写为 gateway 自身 origin，
 * 使 gateway 端 CSRFMiddleware 视为同源请求，gateway 代码零改动。
 */

import { app, net, protocol } from "electron";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { ensureCsrfHeader } from "./csrf-bridge";
import { GATEWAY_PORT } from "./gateway";

/** gateway 反向代理的路径前缀。前端 ``GATEWAY_URL`` prod 取 ``app://localhost/gateway``。 */
const GATEWAY_PREFIX = "/gateway";

/** 前端静态产物目录（vite build 输出，electron-builder 打进 app 包）。 */
function frontendDist(): string {
  return join(app.getAppPath(), "dist");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/** 必须在 ``app.ready`` 之前调用（注册 privileged scheme）。 */
export function registerPrivilegedScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        codeCache: true,
        stream: true,
      },
    },
  ]);
}

/** 在 ``app.ready`` 之后注册 ``app://`` 协议处理器。 */
export function registerAppProtocol(): void {
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === GATEWAY_PREFIX || pathname.startsWith(`${GATEWAY_PREFIX}/`)) {
      const upstreamPath = pathname.slice(GATEWAY_PREFIX.length) || "/";
      const target = `http://localhost:${GATEWAY_PORT}${upstreamPath}${url.search}`;
      return proxyGateway(request, target);
    }
    return serveStatic(pathname);
  });
}

/**
 * gateway 反向代理：流式透传请求/响应（含 SSE），Origin 改写为 gateway 自身 origin，
 * set-cookie 剥离 ``domain`` 属性（避免 app:// origin 下被浏览器拒绝）。
 */
async function proxyGateway(request: Request, target: string): Promise<Response> {
  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    // 跳过 hop-by-hop 与由 net.fetch 自动管理的头。
    if (
      lk === "host" ||
      lk === "connection" ||
      lk === "content-length" ||
      lk === "keep-alive" ||
      lk === "transfer-encoding" ||
      lk === "upgrade"
    ) {
      return;
    }
    if (lk === "origin") return; // 改写为 gateway 自身 origin
    forwardHeaders.append(key, value);
  });
  forwardHeaders.set("origin", `http://localhost:${GATEWAY_PORT}`);
  // 渲染进程 app:// origin 读不到 gateway 的 csrf_token cookie（跨 scheme 隔离），
  // 代理层从主进程 session cookie jar 读取并注入 X-CSRF-Token header。
  await ensureCsrfHeader(forwardHeaders, GATEWAY_PORT);

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: forwardHeaders,
    redirect: "manual",
  };
  if (request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const upstream = await net.fetch(target, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildResponseHeaders(upstream.headers),
    });
  } catch {
    // gateway 未就绪：返回 502，前端 waitForGateway 轮询逻辑复用。
    return new Response(JSON.stringify({ detail: "gateway 不可达" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

/** 构造返回给渲染进程的响应头：剥离 hop-by-hop，set-cookie 单独处理并去 domain。 */
function buildResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  upstream.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (
      lk === "connection" ||
      lk === "keep-alive" ||
      lk === "transfer-encoding"
    ) {
      return;
    }
    if (lk === "set-cookie") return; // 单独处理
    headers.append(key, value);
  });

  const setCookies = getSetCookieList(upstream);
  for (const raw of setCookies) {
    headers.append("set-cookie", stripCookieDomain(raw));
  }
  return headers;
}

function getSetCookieList(headers: Headers): string[] {
  const getter = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (typeof getter === "function") {
    try {
      return getter.call(headers) ?? [];
    } catch {
      // 回退到 getHeader。
    }
  }
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

/** 剥离 set-cookie 中的 ``Domain=`` 属性（app:// origin 下 domain 不匹配会被拒）。 */
function stripCookieDomain(setCookie: string): string {
  return setCookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^domain=/i.test(part))
    .join("; ");
}

/** 静态资源服务：读 dist/ 下文件，缺失时回退 index.html（SPA 路由）。 */
async function serveStatic(pathname: string): Promise<Response> {
  const dist = frontendDist();
  // 防止路径穿越。
  const relative = normalize(pathname.replace(/^\/+/, ""));
  if (relative.startsWith("..") || relative.includes("\\")) {
    return new Response("Forbidden", { status: 403 });
  }

  const filePath = join(dist, relative || "index.html");
  try {
    const data = await readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "content-type": mimeFor(filePath),
        "cache-control": "no-cache",
      },
    });
  } catch {
    // 非 JS/CSS 等静态资源路径回退到 index.html，交给前端路由处理。
    try {
      const html = await readFile(join(dist, "index.html"));
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }
}

function mimeFor(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
