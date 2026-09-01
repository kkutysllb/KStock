import type { MouseEvent as ReactMouseEvent } from "react";
import { getDesktopBridge } from "../../lib/desktopBridge";

/**
 * 窗口交互适配层：把 DOM 事件适配为桥接调用。
 * 桥接原语在 src/lib/desktopBridge.ts（toggleMaximize / openExternal）。
 */

/** 双击标题栏区域切换窗口最大化；命中按钮/输入框/链接等交互控件时不触发。 */
export async function toggleWindowMaximize(event: ReactMouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  if (target.closest("button, input, select, textarea, a")) {
    return;
  }
  try {
    await getDesktopBridge()?.toggleMaximize();
  } catch {
    // 浏览器预览环境无原生窗口，忽略。
  }
}

/**
 * 外链统一走桥接层：http(s) 校验 + 桥接打开；
 * 浏览器预览环境（无桥）回退 window.open。
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  const bridge = getDesktopBridge();
  if (bridge) {
    try {
      await bridge.openExternal(url);
      return;
    } catch {
      // 桥接失败时回退 window.open。
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}