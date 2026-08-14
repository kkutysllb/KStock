import { describe, expect, it } from "vitest";
import {
  SUBAGENT_ROLE_META,
  subagentRoleLabel,
  subagentTimeoutMinutes
} from "../src/lib/subagentMeta";

describe("SUBAGENT_ROLE_META", () => {
  it("覆盖全部内置角色（2 built-in + 5 custom_agents）", () => {
    expect(Object.keys(SUBAGENT_ROLE_META).sort()).toEqual(
      [
        "general-purpose",
        "bash",
        "market-data-analyst",
        "stock-researcher",
        "chan-theory-analyst",
        "backtest-executor",
        "report-writer"
      ].sort()
    );
  });

  it("每个角色有中文名、超时上限与职责描述", () => {
    for (const meta of Object.values(SUBAGENT_ROLE_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.timeoutMinutes).toBeGreaterThan(0);
      expect(meta.scope).toBeTruthy();
    }
  });

  it("超时上限与 qilin.config.yaml 模板权威值一致", () => {
    expect(SUBAGENT_ROLE_META["market-data-analyst"].timeoutMinutes).toBe(15); // 900s
    expect(SUBAGENT_ROLE_META["stock-researcher"].timeoutMinutes).toBe(20); // 1200s
    expect(SUBAGENT_ROLE_META["chan-theory-analyst"].timeoutMinutes).toBe(15); // 900s
    expect(SUBAGENT_ROLE_META["backtest-executor"].timeoutMinutes).toBe(25); // 1500s
    expect(SUBAGENT_ROLE_META["report-writer"].timeoutMinutes).toBe(20); // 1200s
    expect(SUBAGENT_ROLE_META["general-purpose"].timeoutMinutes).toBe(30); // 1800s 全局
    expect(SUBAGENT_ROLE_META["bash"].timeoutMinutes).toBe(30); // 1800s 全局
  });
});

describe("subagentRoleLabel", () => {
  it("已知角色返回中文名", () => {
    expect(subagentRoleLabel("stock-researcher")).toBe("个股研究专员");
    expect(subagentRoleLabel("general-purpose")).toBe("通用研究专员");
  });

  it("未知角色（用户自定义）返回 null，UI 回退 description", () => {
    expect(subagentRoleLabel("my-custom-agent")).toBeNull();
  });

  it("role 缺失返回 null", () => {
    expect(subagentRoleLabel(undefined)).toBeNull();
  });
});

describe("subagentTimeoutMinutes", () => {
  it("已知角色返回超时上限分钟数", () => {
    expect(subagentTimeoutMinutes("backtest-executor")).toBe(25);
  });

  it("未知角色返回 null", () => {
    expect(subagentTimeoutMinutes("my-custom-agent")).toBeNull();
    expect(subagentTimeoutMinutes(undefined)).toBeNull();
  });
});
