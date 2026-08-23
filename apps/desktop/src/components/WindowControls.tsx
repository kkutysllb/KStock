/**
 * Windows 无框窗口自绘窗控（最小化 / 最大化-还原 / 关闭）。
 *
 * Electron 侧 win32 下 frame: false，原生标题栏与窗控按钮全部移除，
 * 菜单功能迁入托盘。本组件固定悬浮在窗口右上角（z-index 高于报告预览
 * 全屏层），仅在 Windows 桌面宿主渲染——浏览器预览、vitest 与 macOS
 * （保留红绿灯）均不渲染。
 */

import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getDesktopBridge, isWindowsDesktop } from "../lib/desktopBridge";

export function WindowControls() {
  // 初始 true：窗口默认最大化启动（ready-to-show 即 maximize），
  // isMaximized() 返回前先按还原图标渲染会闪一下错误图标。
  const [maximized, setMaximized] = useState(true);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge?.isMaximized || !bridge?.onMaximizeChange) return;
    let subscribed = true;
    void bridge.isMaximized().then((value) => {
      if (subscribed) setMaximized(value);
    });
    const unsubscribe = bridge.onMaximizeChange((value) => setMaximized(value));
    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, []);

  if (!isWindowsDesktop()) return null;
  const bridge = getDesktopBridge();

  return (
    <div className="window-controls" role="group" aria-label="窗口控制">
      <button
        type="button"
        className="window-control-button"
        aria-label="最小化"
        title="最小化"
        onClick={() => void bridge?.minimize?.()}
      >
        <Minus size={14} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className="window-control-button"
        aria-label={maximized ? "还原" : "最大化"}
        title={maximized ? "向下还原" : "最大化"}
        onClick={() => void bridge?.toggleMaximize?.()}
      >
        {maximized ? <Copy size={11} strokeWidth={1.6} /> : <Square size={11} strokeWidth={1.6} />}
      </button>
      <button
        type="button"
        className="window-control-button window-control-close"
        aria-label="关闭"
        title="关闭"
        onClick={() => void bridge?.closeWindow?.()}
      >
        <X size={14} strokeWidth={1.6} />
      </button>
    </div>
  );
}
