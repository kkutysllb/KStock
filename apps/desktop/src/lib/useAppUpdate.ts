import { useCallback, useEffect, useRef, useState } from "react";
import { getDesktopBridge, isDesktopRuntime } from "./desktopBridge";
import { showToast } from "./toast";

/**
 * 应用自动更新状态机（后台静默下载 + 完成后提示安装）。
 *
 * 新流程：
 * - 应用启动后自动检查一次（或菜单触发），发现新版本后主进程后台下载；
 * - 下载完成时主进程通过 onUpdateReady 推送，本 hook 切换到 ready 状态；
 * - UI 此时显示"新版本已就绪，点击重启安装"图标；
 * - 用户点击 → installUpdate → 主进程终止 gateway + quitAndInstall。
 *
 * 旧流程（已废弃）：发现新版本 → UI 立即显示下载图标 → 用户点击 → 手动
 * 下载（前端看进度）→ 用户再点安装。用户感知重、需要多次操作。
 *
 * 非桌面端环境（浏览器预览 / vitest）检查失败时静默回到 idle，不影响页面。
 */
export type AppUpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "installing" }
  | { phase: "ready"; version: string; releaseNotes?: string }
  | { phase: "error"; message: string };

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({ phase: "idle" });
  const checkedRef = useRef(false);

  // 订阅主进程的 update-ready 推送（下载完成时主进程主动通知）。
  // 在桌面运行时才订阅，非桌面环境（浏览器/vitest）静默跳过。
  useEffect(() => {
    if (!isDesktopRuntime()) return;
    const bridge = getDesktopBridge();
    if (!bridge?.onUpdateReady) return;

    const unsubscribe = bridge.onUpdateReady(({ version, releaseNotes }) => {
      setState({ phase: "ready", version, releaseNotes });
    });
    return unsubscribe;
  }, []);

  // 用户手动触发"检查更新"（菜单点击）：仅返回结果，不等下载。
  // 下载完成会通过 onUpdateReady 回调推送，UI 自然切换到 ready。
  // ``notify`` 为 true 时（手动菜单触发）向用户弹 toast 反馈结果；
  // 启动后的自动检查传 false，保持静默，避免每次启动都弹提示。
  const check = useCallback(async (notify = false) => {
    setState({ phase: "checking" });
    if (notify) showToast("正在检查更新…");
    try {
      const result = isDesktopRuntime()
        ? await getDesktopBridge()!.updateCheck()
        : null;
      if (!result) {
        // 非桌面环境（浏览器预览 / 测试）或旧契约返回 null：静默回到 idle。
        setState({ phase: "idle" });
        return;
      }
      if (result.status === "available") {
        // 主进程已在后台触发下载，UI 暂时不显示，
        // 等待 onUpdateReady 推送后再切到 ready 状态。
        if (notify) {
          showToast(`发现新版本 v${result.version}，正在后台下载…`, "success");
        }
      } else if (result.status === "latest") {
        if (notify) showToast(`已是最新版本 v${result.version}`);
      } else {
        if (notify) showToast(`检查更新失败：${result.message}`, "error");
      }
      setState({ phase: "idle" });
    } catch (err) {
      // 非桌面端环境（浏览器预览 / 测试）或检查失败：静默回到 idle。
      if (notify) {
        showToast(
          `检查更新失败：${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
      setState({ phase: "idle" });
    }
  }, []);

  // 用户点击"重启安装"：调用主进程安装逻辑（终止 gateway + quitAndInstall）。
  const installUpdate = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setState({ phase: "installing" });
    try {
      await getDesktopBridge()!.updateInstall();
      // updateInstall 内部会 quitAndInstall，进程会退出，下面的代码通常不会执行。
    } catch (err) {
      setState({ phase: "error", message: String(err) });
    }
  }, []);

  // 应用启动后延迟自动检查一次（仅触发主进程检查 + 后台下载，
  // UI 状态不会切换到 available，等待 ready 推送）。
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    const timer = setTimeout(() => {
      void check();
    }, 5000);
    return () => clearTimeout(timer);
  }, [check]);

  return { state, check, installUpdate };
}
