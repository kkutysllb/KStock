// 交付文件链接识别与应用内预览回调传递。
//
// 引擎在消息正文里输出交付文件链接（如 `[📄 尽调报告.html](http://localhost:18001/...)`），
// 这类链接应走应用内预览（fetch blob → iframe / 文本视图），而不是 `target="_blank"`
// 新窗口——Electron 主进程的 setWindowOpenHandler 会把 http(s) 外链丢给系统浏览器，
// gateway 根路径在浏览器里重定向到产品首页，用户看到的是「跳转到产品首页」而非预览。
//
// 本模块提供：
// - artifactPreviewNameFromHref：判断 href 是否为 gateway 交付文件链接
//   （gateway 域 + 可预览扩展名），返回文件展示名，否则 null。
// - ArtifactLinkContext / useArtifactLinkHandler：把 Home 的 openArtifact
//   回调传递给深层的 Markdown 链接组件，避免跨多层 props 钻孔。

import { createContext, useContext } from "react";
import { GATEWAY_URL } from "./gatewayUrl";

/** 可从 gateway 拉取并在应用内预览的文件扩展名（其余走系统浏览器/下载）。 */
const PREVIEW_EXTENSIONS = /\.(html?|md|json|txt|csv)(\?|#|$)/i;

/** 判断 href 是否为可应用内预览的交付文件链接，返回文件展示名；否则 null。 */
export function artifactPreviewNameFromHref(href: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(href, GATEWAY_URL);
  } catch {
    return null;
  }
  // 跨域外链（非 gateway）不拦截，保持系统浏览器打开。
  const gateway = new URL(GATEWAY_URL);
  if (parsed.origin !== gateway.origin) return null;
  if (!PREVIEW_EXTENSIONS.test(parsed.pathname)) return null;
  const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export type ArtifactLinkHandler = (href: string, name: string) => void;

/** 交付文件链接点击回调（由 Home 注入 openArtifact）。 */
export const ArtifactLinkContext = createContext<ArtifactLinkHandler | null>(null);

export function useArtifactLinkHandler(): ArtifactLinkHandler | null {
  return useContext(ArtifactLinkContext);
}

// ── 预览 HTML 清洗：blob iframe 无法解析根绝对路径与 Vite HMR 注入 ──
//
// HTML 在 `blob:` URL 的 iframe 中加载时，base 非层级化，且 sandbox 缺
// allow-same-origin 使脚本环境为 opaque origin：
// - `<script type="module">import RefreshRuntime from "/@react-refresh"` 等
//   Vite 开发注入会抛「Failed to resolve module specifier "/@react-refresh"」；
// - `type="module" src` 入口脚本（如 Vite 页面快照的 `/src/main.tsx`）在
//   opaque origin 下无法通过 CORS（报 401/被拦截），且把整个应用跑进
//   iframe 会覆盖预览内容，一律移除；
// - `src="/assets/x.js"`、`href="/style.css"` 等根绝对路径资源在 blob base
//   下同样无法解析。
// 预览前清洗：移除 module 脚本，根绝对路径资源回源到 HTML 自身所在的
// origin（交付文件通常由 gateway 提供，资源同源可直取）。

/** 移除 Vite 开发模式注入的 HMR 脚本（blob 环境无意义且报错）。 */
export function sanitizePreviewHtml(html: string, baseOrigin: string): string {
  return html
    // <script type="module" src="/@vite/client"></script>
    .replace(/<script\b[^>]*\bsrc=["'][^"']*\/@vite\/client["'][^>]*>\s*<\/script>/gi, "")
    // 内联 module 脚本：import RefreshRuntime from "/@react-refresh" ...
    .replace(/<script\b[^>]*type=["']module["'][^>]*>[^<]*@react-refresh[^<]*<\/script>/gi, "")
    // 其余 module 入口脚本（Vite 快照的 /src/main.tsx 等）：opaque origin 下
    // 必然 CORS 失败，且整应用挂载会覆盖预览内容，移除。
    .replace(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, "")
    // 根绝对路径资源回源：src="/x" → src="<origin>/x"；保留 //、http(s)://、data:、blob: 等
    .replace(/(\b(?:src|href|action|poster)=["'])\/(?!\/)/g, `$1${baseOrigin.replace(/\/$/, "")}/`);
}
