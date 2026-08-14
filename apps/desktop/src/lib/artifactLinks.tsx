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
