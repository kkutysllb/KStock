import { useEffect, useState } from "react";
import type { ToastDetail, ToastTone } from "../lib/toast";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const DISMISS_MS = 2600;

/**
 * 全局 toast 容器：监听 ``kstock:toast`` 事件，渲染顶部居中的轻量提示，
 * 逐条自动消失。始终挂在 App 根，与页面状态无关。
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let seq = 0;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = Date.now() + seq++;
      setToasts((prev) => [...prev, { id, message: detail.message, tone: detail.tone ?? "info" }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DISMISS_MS);
    };
    window.addEventListener("kstock:toast", handler);
    return () => window.removeEventListener("kstock:toast", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
