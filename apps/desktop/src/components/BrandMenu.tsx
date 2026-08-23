/**
 * 侧边栏顶部 logo 下拉菜单（workspace / settings 两变体共享同一组件）。
 *
 * 视觉对齐原 ``.sidebar-brand``：LogoMark + 品牌名 + ChevronDown。区别是
 * 把箭头从装饰图标升级为可点击的菜单触发器，下拉菜单承载应用级动作
 * （关于 KStock / 检查更新 / 打开日志目录 / 重启 gateway）。两个侧边栏
 * 的下拉内容完全一致（settings 已有「返回应用」独立按钮，避免重复）。
 *
 * 设计要点：
 * - 复用 `McpExtensionsCard` 现有下拉模式（useRef 容器 + mousedown 监听
 *   外部点击关闭），保持 codebase 一致性。
 * - `appInfo` 由父组件异步注入，避免每次重渲都打 IPC。父组件决定何时拉
 *   （首次挂载 / 设置页打开时）。
 * - 重启 gateway 走二次确认对话框，避免误点（与现有
 *   BackendControlBar.handleRestart 行为一致）。
 */
import {
  ChevronDown,
  Info,
  RefreshCw,
  FolderOpen,
  RotateCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { fetchAppInfo, openLocalPath } from "../lib/desktopBridge";
import { restartGateway as gatewayControlRestart } from "../lib/gatewayControlClient";
import { showToast } from "../lib/toast";
import { ConfirmDialog } from "./ConfirmDialog";
import { LogoMark } from "./LogoMark";

export interface AppInfo {
  version: string;
  name: string;
  platform: string;
}

export interface BrandMenuProps {
  /** "workspace" 用于工作区侧栏，"settings" 用于设置侧栏（影响类名与 ARIA 文案）。 */
  variant: "workspace" | "settings";
  /**
   * 注入应用元信息。父组件在挂载时通过 `fetchAppInfo()` 拉一次，避免下拉每次
   * 打开都打 IPC。若不传则组件内部自行拉取（首次 mount 后触发）。
   */
  appInfo?: AppInfo | null;
}

const ABOUT_VERSION_PLACEHOLDER = "—";

export function BrandMenu({ variant, appInfo: appInfoProp }: BrandMenuProps) {
  // 父组件未注入时组件内部自取（首次挂载后），避免每次 open 才打 IPC。
  const [appInfoInternal, setAppInfoInternal] = useState<AppInfo | null>(
    appInfoProp ?? null,
  );
  useEffect(() => {
    if (appInfoProp) {
      setAppInfoInternal(appInfoProp);
      return;
    }
    let cancelled = false;
    void fetchAppInfo().then((info) => {
      if (!cancelled) setAppInfoInternal(info);
    });
    return () => {
      cancelled = true;
    };
  }, [appInfoProp]);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [restartPending, setRestartPending] = useState(false);

  // 外部点击 / Escape 关闭下拉（标准下拉 UX）。
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const versionLabel = appInfoInternal?.version || ABOUT_VERSION_PLACEHOLDER;

  const handleCheckUpdate = useCallback(() => {
    setOpen(false);
    // 复用现有 useAppUpdate 链路：派发全局事件让 UpdateButton / useAppUpdate 接管，
    // 与系统菜单「检查更新…」走同一条 IPC，避免重复 toast 与状态机实现。
    window.dispatchEvent(new CustomEvent("kstock:check-update"));
  }, []);

  const handleOpenLogs = useCallback(async () => {
    setOpen(false);
    const result = await openLocalPath("logs");
    if (!result.ok) {
      showToast(`无法打开日志目录：${result.error ?? "未知错误"}`, "error");
    }
  }, []);

  const handleRestartGateway = useCallback(() => {
    setOpen(false);
    setRestartPending(true);
  }, []);

  const confirmRestart = useCallback(async () => {
    setRestartPending(false);
    try {
      await gatewayControlRestart();
      showToast("已发送重启请求，等待后端恢复…", "info");
    } catch (err) {
      showToast(
        `重启失败：${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    }
  }, []);

  const ariaLabel =
    variant === "workspace"
      ? "KStock 工作区菜单"
      : "KStock 设置菜单";

  return (
    <div
      className={`brand-menu brand-menu--${variant}`}
      ref={containerRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="sidebar-brand brand-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <LogoMark compact />
        <strong>KStock</strong>
        <ChevronDown
          size={15}
          className={`brand-menu__chevron${open ? " chevron-expanded" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="brand-menu__dropdown" role="menu" aria-label={ariaLabel}>
          <div className="brand-menu__about" role="presentation">
            <Info size={14} aria-hidden="true" />
            <div className="brand-menu__about-main">
              <strong>{appInfoInternal?.name ?? "KStock"}</strong>
              <span>版本 v{versionLabel}</span>
            </div>
          </div>
          <div className="brand-menu__divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="brand-menu__item"
            onClick={handleCheckUpdate}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>检查更新</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="brand-menu__item"
            onClick={handleOpenLogs}
          >
            <FolderOpen size={15} aria-hidden="true" />
            <span>打开日志目录</span>
          </button>
          <div className="brand-menu__divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="brand-menu__item brand-menu__item--danger"
            onClick={handleRestartGateway}
          >
            <RotateCw size={15} aria-hidden="true" />
            <span>重启 gateway</span>
          </button>
        </div>
      )}
      <ConfirmDialog
        open={restartPending}
        title="重启 gateway"
        description="重启会断开当前所有 SSE 连接与进行中的任务。配置变更后必须重启 gateway 才能完全生效。是否继续？"
        confirmText="确认重启"
        cancelText="取消"
        onConfirm={confirmRestart}
        onCancel={() => setRestartPending(false)}
      />
    </div>
  );
}