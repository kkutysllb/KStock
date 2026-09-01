import type { MouseEvent as ReactMouseEvent } from "react";
import {
  openExternalUrl as desktopOpenExternalUrl,
  toggleWindowMaximize as desktopToggleMaximize,
} from "../../lib/desktopBridge";

/** 双击标题栏区域切换窗口最大化；命中按钮/输入框/链接等交互控件时不触发。 */
export async function toggleWindowMaximize(event: ReactMouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  if (target.closest("button, input, select, textarea, a")) {
    return;
  }
  await desktopToggleMaximize();
}

/** 外链统一走桥接层（http(s) 校验与浏览器预览回退在桥接层内部处理）。 */
export async function openExternalUrl(url: string) {
  await desktopOpenExternalUrl(url);
}
