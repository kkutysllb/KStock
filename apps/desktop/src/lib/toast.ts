/**
 * 轻量全局 toast（即时反馈）。
 *
 * 采用与「系统菜单命令」一致的事件驱动方式：任意模块调用 ``showToast`` 派发
 * ``kstock:toast`` CustomEvent，由挂载在 App 根的 ``ToastHost`` 统一渲染并
 * 自动消失。这样不需要引入全局状态库，也不依赖具体页面是否已挂载。
 */

export type ToastTone = "info" | "success" | "error";

export interface ToastDetail {
  message: string;
  tone: ToastTone;
}

export function showToast(message: string, tone: ToastTone = "info"): void {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>("kstock:toast", {
      detail: { message, tone },
    }),
  );
}
