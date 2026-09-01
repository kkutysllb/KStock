import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock useAppUpdate：直接控制状态机，专注 UpdateButton 的展示/交互 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: { phase: "idle" } as any,
  check: vi.fn(),
  installUpdate: vi.fn(),
}));
vi.mock("../src/lib/useAppUpdate", () => ({
  useAppUpdate: () => mockUpdate,
}));

// Markdown 渲染走真实 react-markdown 链路太重，测试只断言源文本透传。
vi.mock("../src/lib/markdown", () => ({
  Markdown: ({ children }: { children: string }) => (
    <div data-testid="notes-md">{children}</div>
  ),
}));

import { UpdateButton } from "../src/components/UpdateButton";

const NOTES = [
  "# v1.1.0",
  "",
  "## 新功能",
  "",
  "- 因子库/选股库资产工作区",
  "- 更新图标悬停展示发布内容",
].join("\n");

function setReady(version: string, releaseNotes?: string) {
  mockUpdate.state = { phase: "ready", version, releaseNotes };
}

describe("UpdateButton", () => {
  beforeEach(() => {
    mockUpdate.state = { phase: "idle" };
    mockUpdate.check.mockReset();
    mockUpdate.installUpdate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("idle 状态不渲染图标", () => {
    const { container } = render(<UpdateButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ready 且带 releaseNotes：悬停展示发布内容浮层，移出后收起", async () => {
    setReady("1.1.0", NOTES);
    render(<UpdateButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "新版本 v1.1.0 已就绪，点击重启安装");
    // 有浮层时不给原生 title，避免双重提示
    expect(button).not.toHaveAttribute("title");

    fireEvent.mouseEnter(button);
    const popover = await screen.findByRole("note", { name: "v1.1.0 更新内容" });
    expect(popover).toHaveTextContent("v1.1.0 更新内容");
    expect(screen.getByTestId("notes-md")).toHaveTextContent("因子库/选股库资产工作区");

    fireEvent.mouseLeave(button);
    await waitFor(() => {
      expect(screen.queryByRole("note")).toBeNull();
    });
  });

  it("ready 无 releaseNotes：悬停不出现浮层，保留原生 title", () => {
    setReady("1.1.0");
    render(<UpdateButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "新版本 v1.1.0 已就绪，点击重启安装");
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("Escape 收起浮层", async () => {
    setReady("1.1.0", NOTES);
    render(<UpdateButton />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    await screen.findByRole("note");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("note")).toBeNull();
    });
  });

  it("ready 点击图标触发安装；浮层打开不受影响", async () => {
    setReady("1.1.0", NOTES);
    render(<UpdateButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(mockUpdate.installUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("installing 状态显示忙碌图标并禁用点击", () => {
    mockUpdate.state = { phase: "installing" };
    render(<UpdateButton />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockUpdate.installUpdate).not.toHaveBeenCalled();
  });
});
