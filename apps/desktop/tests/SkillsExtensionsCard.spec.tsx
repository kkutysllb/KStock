import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock extensionsClient ──
const mockExtModule = vi.hoisted(() => ({
  getAvailableSkills: vi.fn(),
  setSkillEnabled: vi.fn(),
}));

vi.mock("../src/lib/extensionsClient", () => ({
  __esModule: true,
  ...mockExtModule,
  isExtensionsApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

import { SkillsExtensionsCard } from "../src/components/SkillsExtensionsCard";

// ── 固定数据 ──

const makeSkill = (name: string, group: string, enabled = true) => ({
  name,
  dir_name: name,
  group,
  path: `${group}/${name}`,
  title: name,
  description: `${name} 描述`,
  version: "1.0.0",
  category: "finance",
  enabled,
});

const skillsResponse = {
  skills: [
    makeSkill("stock-analysis", "stock"),
    makeSkill("news-search", "stock"),
    makeSkill("macro-query", "stock"),
    makeSkill("analysis-report", "common"),
    makeSkill("chart-visualization", "common"),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExtModule.getAvailableSkills.mockResolvedValue(skillsResponse);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("SkillsExtensionsCard 加载与展示", () => {
  it("加载后展示预置技能列表 + 启用计数", async () => {
    render(<SkillsExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("stock-analysis")).toBeInTheDocument();
    });
    // 启用计数：5/5
    expect(screen.getByText(/5\/5 启用/)).toBeInTheDocument();
    // 技能描述出现
    expect(screen.getByText("stock-analysis 描述")).toBeInTheDocument();
  });

  it("加载时展示 loading 占位", () => {
    mockExtModule.getAvailableSkills.mockReturnValue(new Promise(() => {}));
    render(<SkillsExtensionsCard />);
    expect(screen.getByText("加载技能列表…")).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockExtModule.getAvailableSkills.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<SkillsExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── 启停切换 ───────────────────────────────────────────────────────

describe("SkillsExtensionsCard 启停切换", () => {
  it("点击 toggle 禁用技能时调用 setSkillEnabled false", async () => {
    mockExtModule.setSkillEnabled.mockResolvedValue({
      name: "stock-analysis",
      enabled: false,
      action: "disabled",
    });
    render(<SkillsExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("stock-analysis")).toBeInTheDocument();
    });

    // 点击第一个 skill 的 toggle（stock-analysis）
    const toggles = screen.getAllByRole("checkbox");
    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(mockExtModule.setSkillEnabled).toHaveBeenCalledWith(
        "stock-analysis",
        false
      );
    });
  });

  it("点击 toggle 启用已禁用技能时调用 setSkillEnabled true", async () => {
    const disabledSkills = {
      skills: [
        makeSkill("stock-analysis", "stock", false),
        makeSkill("news-search", "stock", true),
      ],
    };
    mockExtModule.getAvailableSkills.mockResolvedValue(disabledSkills);
    mockExtModule.setSkillEnabled.mockResolvedValue({
      name: "stock-analysis",
      enabled: true,
      action: "enabled",
    });

    render(<SkillsExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("stock-analysis")).toBeInTheDocument();
    });

    // 点击 stock-analysis 的 toggle（当前 disabled → 启用）
    const toggles = screen.getAllByRole("checkbox");
    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(mockExtModule.setSkillEnabled).toHaveBeenCalledWith(
        "stock-analysis",
        true
      );
    });
  });
});

// ── 搜索过滤 ───────────────────────────────────────────────────────

describe("SkillsExtensionsCard 搜索过滤", () => {
  it("输入搜索关键词后只显示匹配的技能", async () => {
    render(<SkillsExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("stock-analysis")).toBeInTheDocument();
    });

    // 搜索 "news"
    const searchInput = screen.getByPlaceholderText("搜索技能名或描述…");
    fireEvent.change(searchInput, { target: { value: "news" } });

    // 只剩 news-search
    expect(screen.getByText("news-search")).toBeInTheDocument();
    expect(screen.queryByText("stock-analysis")).not.toBeInTheDocument();
    expect(screen.queryByText("macro-query")).not.toBeInTheDocument();
  });

  it("搜索无匹配时显示空提示", async () => {
    render(<SkillsExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("stock-analysis")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("搜索技能名或描述…");
    fireEvent.change(searchInput, { target: { value: "zzzznotexist" } });

    expect(screen.getByText("没有匹配的技能。")).toBeInTheDocument();
  });
});
