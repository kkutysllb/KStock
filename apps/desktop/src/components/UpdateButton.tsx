import { useEffect } from "react";
import { Download, RotateCw } from "lucide-react";
import { useAppUpdate } from "../lib/useAppUpdate";

/**
 * 侧边栏用户位置右侧的隐藏下载图标。
 *
 * - 默认隐藏（idle / checking 不渲染）；
 * - 检测到新版本时显示下载图标 + 红色角标，title 提示版本号；
 * - 点击后下载更新（图标旋转 + 累计字节进度提示），下载完成自动重启安装；
 * - 失败时仍显示图标，点击可重试下载。
 */
export function UpdateButton() {
  const { state, check, startUpdate } = useAppUpdate();

  useEffect(() => {
    const handleCheckUpdate = () => {
      void check();
    };
    window.addEventListener("kstock:check-update", handleCheckUpdate);
    return () => window.removeEventListener("kstock:check-update", handleCheckUpdate);
  }, [check]);

  if (state.phase === "idle" || state.phase === "checking") return null;

  const busy = state.phase === "downloading" || state.phase === "installing";
  const title =
    state.phase === "available"
      ? `发现新版本 v${state.version}，点击下载并自动重启安装`
      : state.phase === "downloading"
        ? `正在下载更新… ${(state.downloadedBytes / 1024 / 1024).toFixed(1)} MB`
        : state.phase === "installing"
          ? "更新已下载，正在重启安装…"
          : `更新失败：${state.message}，点击重试`;

  return (
    <button
      type="button"
      className={`sidebar-update-button${busy ? " busy" : ""}`}
      aria-label={title}
      title={title}
      disabled={busy}
      onClick={() => {
        if (state.phase === "available" || state.phase === "error") {
          void startUpdate();
        }
      }}
    >
      {busy ? <RotateCw size={16} /> : <Download size={16} />}
      {state.phase === "available" && <span className="sidebar-update-badge" aria-hidden="true" />}
    </button>
  );
}
