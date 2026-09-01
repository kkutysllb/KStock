import { useEffect, useRef, useState } from "react";
import { RotateCw, RefreshCw } from "lucide-react";
import { useAppUpdate } from "../lib/useAppUpdate";
import { Markdown } from "../lib/markdown";

/**
 * 侧边栏用户位置右侧的隐藏更新图标。
 *
 * 新流程（后台静默下载）：
 * - 默认隐藏（idle / checking 不渲染）；
 * - 主进程后台下载完成后推送 updateReady → 显示"已就绪"图标（绿色角标）；
 * - 悬停（或键盘聚焦）展示新版本发布内容浮层（markdown 渲染）；
 * - 点击后立即重启安装（图标旋转），无需用户手动下载；
 * - 安装失败时仍显示图标，点击重试安装。
 *
 * 用户全程只看到两个状态：隐藏 / 已就绪可点击安装。
 * 下载过程在后台静默进行，不打扰用户。
 */
export function UpdateButton() {
  const { state, check, installUpdate } = useAppUpdate();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ bottom: number; right: number } | null>(
    null,
  );

  useEffect(() => {
    const handleCheckUpdate = () => {
      void check(true);
    };
    window.addEventListener("kstock:check-update", handleCheckUpdate);
    return () => window.removeEventListener("kstock:check-update", handleCheckUpdate);
  }, [check]);

  // 非 ready 状态（安装中 / 失败重试）强制收起浮层。
  useEffect(() => {
    if (state.phase !== "ready") setNotesOpen(false);
  }, [state.phase]);

  // Escape 收起浮层。
  useEffect(() => {
    if (!notesOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notesOpen]);

  // 卸载时清掉延迟关闭定时器。
  useEffect(
    () => () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const releaseNotes = state.phase === "ready" ? state.releaseNotes : undefined;

  /** 打开浮层：按图标矩形计算 fixed 坐标（向上展开，右对齐，防侧栏裁剪）。 */
  const openNotes = () => {
    if (!releaseNotes) return;
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      setPanelPos({
        bottom: Math.max(window.innerHeight - rect.top + 8, 96),
        right: Math.max(window.innerWidth - rect.right, 12),
      });
    }
    setNotesOpen(true);
  };

  /** 延迟关闭：容忍按钮与浮层间隙的鼠标移动，避免闪烁。 */
  const scheduleClose = () => {
    if (!releaseNotes) return;
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setNotesOpen(false), 160);
  };

  // idle / checking / 安装过程之外的中间态：不渲染图标
  if (state.phase === "idle" || state.phase === "checking") return null;

  const busy = state.phase === "installing";
  const version = state.phase === "ready" ? state.version : null;
  const title =
    state.phase === "ready"
      ? `新版本 v${state.version} 已就绪，点击重启安装`
      : state.phase === "installing"
        ? "正在重启安装…"
        : `更新失败：${state.message}，点击重试`;
  const showNotes = notesOpen && Boolean(releaseNotes);

  return (
    <div
      ref={wrapRef}
      className="sidebar-update-wrap"
      onMouseEnter={openNotes}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`sidebar-update-button${busy ? " busy" : ""}`}
        aria-label={title}
        // 有发布内容浮层时隐藏原生 title 提示，避免双重 tooltip。
        title={releaseNotes ? undefined : title}
        disabled={busy}
        onFocus={openNotes}
        onBlur={scheduleClose}
        onClick={() => {
          if (state.phase === "ready" || state.phase === "error") {
            void installUpdate();
          }
        }}
      >
        {busy ? <RotateCw size={16} /> : <RefreshCw size={16} />}
        {state.phase === "ready" && (
          <span className="sidebar-update-badge" aria-hidden="true" />
        )}
      </button>
      {showNotes && version && panelPos && (
        <div
          className="update-notes-popover"
          style={{ bottom: panelPos.bottom, right: panelPos.right }}
          role="note"
          aria-label={`v${version} 更新内容`}
        >
          <div className="update-notes-head">v{version} 更新内容</div>
          <div className="update-notes-body">
            <Markdown>{releaseNotes ?? ""}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
