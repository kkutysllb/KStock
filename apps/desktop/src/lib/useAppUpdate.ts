import { useCallback, useEffect, useRef, useState } from "react";
import { getDesktopBridge, isDesktopRuntime } from "./desktopBridge";

/**
 * 应用自动更新状态机（供侧边栏下载图标使用）。
 *
 * - 挂载后延迟自动检查一次，发现新版本进入 available；
 * - startUpdate：下载（累计字节进度）→ 安装 → 自动重启（electron-updater quitAndInstall）；
 * - 非桌面端环境（浏览器预览 / vitest）检查失败时静默回到 idle，不影响页面。
 */
export type AppUpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "available"; version: string }
  | { phase: "downloading"; downloadedBytes: number }
  | { phase: "installing" }
  | { phase: "error"; message: string };

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({ phase: "idle" });
  const checkedRef = useRef(false);

  const check = useCallback(async () => {
    setState({ phase: "checking" });
    try {
      const update = isDesktopRuntime()
        ? await getDesktopBridge()!.updateCheck()
        : null;
      if (!update) {
        setState({ phase: "idle" });
        return;
      }
      setState({ phase: "available", version: update.version });
    } catch {
      // 非桌面端环境（浏览器预览 / 测试）或检查失败：静默跳过
      setState({ phase: "idle" });
    }
  }, []);

  const startUpdate = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setState({ phase: "downloading", downloadedBytes: 0 });
    try {
      await getDesktopBridge()!.updateDownload((progress) => {
        setState((prev) =>
          prev.phase === "downloading"
            ? { phase: "downloading", downloadedBytes: progress.downloaded }
            : prev,
        );
      });
      setState({ phase: "installing" });
      await getDesktopBridge()!.updateInstall();
    } catch (err) {
      setState({ phase: "error", message: String(err) });
    }
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    const timer = setTimeout(() => {
      void check();
    }, 5000);
    return () => clearTimeout(timer);
  }, [check]);

  return { state, check, startUpdate };
}
