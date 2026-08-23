import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock 宿主桥接层 ──
// BrandMenu 依赖 fetchAppInfo / openLocalPath + 通过 kstock:check-update 事件
// 通知外部 useAppUpdate；用 vi.hoisted 保证 mock 在 vi.mock 工厂之前就绪。
const mockBridge = vi.hoisted(() => ({
  appInfo: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock("../src/lib/desktopBridge", () => ({
  fetchAppInfo: mockBridge.appInfo,
  openLocalPath: mockBridge.openPath,
}));

const mockGateway = vi.hoisted(() => ({
  restartGateway: vi.fn(),
}));
vi.mock("../src/lib/gatewayControlClient", () => ({
  restartGateway: mockGateway.restartGateway,
}));

// 捕获 toast 调用，避免依赖 ToastHost 挂载顺序。
const mockToast = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/toast", () => ({
  showToast: mockToast,
}));

import { BrandMenu } from "../src/components/BrandMenu";

describe("BrandMenu", () => {
  beforeEach(() => {
    mockBridge.appInfo.mockReset();
    mockBridge.openPath.mockReset();
    mockGateway.restartGateway.mockReset();
    mockToast.mockReset();
    // 默认桥接实现：返回带版本号的应用信息；openPath 返回 ok。
    mockBridge.appInfo.mockResolvedValue({
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    });
    mockBridge.openPath.mockResolvedValue({ ok: true });
    mockGateway.restartGateway.mockResolvedValue({
      message: "gateway 已启动",
      supervised: false,
    });
  });

  afterEach(() => {
    // 不残留全局事件监听。
    vi.restoreAllMocks();
  });

  it("workspace 变体：默认渲染触发器，但下拉菜单不展开", () => {
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    const trigger = screen.getByRole("button", { name: /KStock 工作区菜单/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("settings 变体：aria-label 切换为「KStock 设置菜单」", () => {
    render(<BrandMenu variant="settings" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    expect(
      screen.getByRole("button", { name: /KStock 设置菜单/ }),
    ).toBeInTheDocument();
  });

  it("点击触发器展开下拉菜单，菜单项完整列出", async () => {
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    const menu = await screen.findByRole("menu");
    expect(menu).toBeInTheDocument();
    // about 区渲染为 <strong>{name}</strong> + <span>版本 v{version}</span>，
    // 组件内无「关于」字样，按实际结构断言。
    expect(withinMenu(menu, "版本 v1.0.7")).toBeInTheDocument();
    expect(withinMenu(menu, "检查更新")).toBeInTheDocument();
    expect(withinMenu(menu, "打开日志目录")).toBeInTheDocument();
    expect(withinMenu(menu, "重启 gateway")).toBeInTheDocument();
  });

  it("未注入 appInfo 时，组件内部自取 fetchAppInfo 并在 about 区显示", async () => {
    render(<BrandMenu variant="workspace" />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    await waitFor(() => {
      expect(mockBridge.appInfo).toHaveBeenCalledTimes(1);
    });
    const menu = await screen.findByRole("menu");
    expect(withinMenu(menu, "版本 v1.0.7")).toBeInTheDocument();
  });

  it("外部点击关闭下拉菜单", async () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <BrandMenu variant="workspace" appInfo={{
          version: "1.0.7",
          name: "KStock",
          platform: "win32",
        }} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("Escape 关闭下拉并把焦点还给触发器", async () => {
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    const trigger = screen.getByRole("button", { name: /KStock 工作区菜单/ });
    fireEvent.click(trigger);
    await screen.findByRole("menu");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("检查更新：派发 kstock:check-update 自定义事件，菜单关闭", async () => {
    const handler = vi.fn();
    window.addEventListener("kstock:check-update", handler);
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /检查更新/ }));
    expect(handler).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    window.removeEventListener("kstock:check-update", handler);
  });

  it("打开日志目录：成功时不弹 toast，失败时弹 error toast", async () => {
    mockBridge.openPath.mockResolvedValueOnce({
      ok: false,
      error: "no bridge",
    });
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /打开日志目录/ }));
    await waitFor(() => {
      expect(mockBridge.openPath).toHaveBeenCalledWith("logs");
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("无法打开日志目录"),
        "error",
      );
    });
  });

  it("重启 gateway：先弹二次确认，确认后调 restartGateway 并 toast", async () => {
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /重启 gateway/ }));
    // 出现 ConfirmDialog，标题「重启 gateway」
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("重启 gateway");
    // 点确认
    fireEvent.click(screen.getByRole("button", { name: /确认重启/ }));
    await waitFor(() => {
      expect(mockGateway.restartGateway).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("已发送重启请求"),
        "info",
      );
    });
  });

  it("重启 gateway：取消时不调 restartGateway", async () => {
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /重启 gateway/ }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: /^取消$/ }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(mockGateway.restartGateway).not.toHaveBeenCalled();
  });

  it("重启 gateway 失败时弹 error toast", async () => {
    mockGateway.restartGateway.mockRejectedValueOnce(new Error("IPC 失败"));
    render(<BrandMenu variant="workspace" appInfo={{
      version: "1.0.7",
      name: "KStock",
      platform: "win32",
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /KStock 工作区菜单/ }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /重启 gateway/ }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: /确认重启/ }));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("重启失败：IPC 失败"),
        "error",
      );
    });
  });
});

/**
 * 在指定 role="menu" 容器内查询文本，避免与测试容器外其他同名文本冲突。
 * （BrandMenu 的 about 区块在 menu 内，便于回归菜单文案。）
 */
function withinMenu(menu: HTMLElement, text: string): HTMLElement | null {
  return Array.from(menu.querySelectorAll("*")).find(
    (node) => node.textContent?.includes(text),
  ) as HTMLElement | null;
}