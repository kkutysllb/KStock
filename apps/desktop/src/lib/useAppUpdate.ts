import { useCallback, useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

/**
 * 应用自动更新状态机（供侧边栏下载图标使用）。
 *
 * - 挂载后延迟自动检查一次，发现新版本进入 available；
 * - startUpdate：下载（累计字节进度）→ 安装 → 自动重启（tauri-plugin-process）；
 * - 非 Tauri 环境（浏览器预览 / vitest）检查失败时静默回到 idle，不影响页面。
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
  const updateRef = useRef<Update | null>(null);
  const checkedRef = useRef(false);

  const check = useCallback(async () => {
    setState({ phase: "checking" });
    try {
      const { check: checkUpdate } = await import("@tauri-apps/plugin-updater");
      const update = await checkUpdate();
      updateRef.current = update;
      if (!update) {
        setState({ phase: "idle" });
        return;
      }
      setState({ phase: "available", version: update.version });
    } catch {
      // 非 Tauri 环境（浏览器预览 / 测试）或检查失败：静默跳过
      setState({ phase: "idle" });
    }
  }, []);

  const startUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    setState({ phase: "downloading", downloadedBytes: 0 });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          setState((prev) =>
            prev.phase === "downloading"
              ? { phase: "downloading", downloadedBytes: prev.downloadedBytes + event.data.chunkLength }
              : prev,
          );
        }
      });
      setState({ phase: "installing" });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
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
