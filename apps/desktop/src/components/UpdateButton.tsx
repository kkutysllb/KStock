import { useEffect } from "react";
import { RotateCw, RefreshCw } from "lucide-react";
import { useAppUpdate } from "../lib/useAppUpdate";

/**
 * 侧边栏用户位置右侧的隐藏更新图标。
 *
 * 新流程（后台静默下载）：
 * - 默认隐藏（idle / checking 不渲染）；
 * - 主进程后台下载完成后推送 updateReady → 显示"已就绪"图标（绿色角标）；
 * - 点击后立即重启安装（图标旋转），无需用户手动下载；
 * - 安装失败时仍显示图标，点击重试安装。
 *
 * 用户全程只看到两个状态：隐藏 / 已就绪可点击安装。
 * 下载过程在后台静默进行，不打扰用户。
 */
export function UpdateButton() {
  const { state, check, installUpdate } = useAppUpdate();

  useEffect(() => {
    const handleCheckUpdate = () => {
      void check();
    };
    window.addEventListener("kstock:check-update", handleCheckUpdate);
    return () => window.removeEventListener("kstock:check-update", handleCheckUpdate);
  }, [check]);

  // idle / checking / 安装过程之外的中间态：不渲染图标
  if (state.phase === "idle" || state.phase === "checking") return null;

  const busy = state.phase === "installing";
  const title =
    state.phase === "ready"
      ? `新版本 v${state.version} 已就绪，点击重启安装`
      : state.phase === "installing"
        ? "正在重启安装…"
        : `更新失败：${state.message}，点击重试`;

  return (
    <button
      type="button"
      className={`sidebar-update-button${busy ? " busy" : ""}`}
      aria-label={title}
      title={title}
      disabled={busy}
      onClick={() => {
        if (state.phase === "ready" || state.phase === "error") {
          void installUpdate();
        }
      }}
    >
      {busy ? <RotateCw size={16} /> : <RefreshCw size={16} />}
      {state.phase === "ready" && <span className="sidebar-update-badge" aria-hidden="true" />}
    </button>
  );
}
