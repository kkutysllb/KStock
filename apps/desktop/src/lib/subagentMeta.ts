// ── subagentMeta：内置子代理角色元信息 ────────────────────────────────
// 浮动面板「Subagent 调用」的角色展示数据源。role 由 turnReducer 从
// task 工具调用的 args.subagent_type 提取（task_id === tool_call_id，
// 见 vendor/qilin/qilin/tools/builtins/task_tool.py）。
//
// 执行估计（timeoutMinutes）与 config/qilin.config.yaml subagents 段的
// 模板权威值保持一致；用户 runtime.yaml 可能覆盖超时，故面板用
// 「预计最长」措辞而非精确值。

export interface SubagentRoleMeta {
  /** 角色中文名（面板标题）。 */
  label: string;
  /** 执行超时上限（分钟），即「预计最长执行时长」的估计依据。 */
  timeoutMinutes: number;
  /** 职责一句话（面板悬停/副标题补充）。 */
  scope: string;
}

/** 内置角色元信息表：role 名 → 展示信息。 */
export const SUBAGENT_ROLE_META: Record<string, SubagentRoleMeta> = {
  "general-purpose": {
    label: "通用研究专员",
    timeoutMinutes: 30,
    scope: "复杂多步骤任务的兜底委派角色"
  },
  bash: {
    label: "命令执行器",
    timeoutMinutes: 30,
    scope: "bash 命令执行专员"
  },
  "market-data-analyst": {
    label: "市场数据专员",
    timeoutMinutes: 15,
    scope: "大盘/板块/宏观数据采集与解读"
  },
  "stock-researcher": {
    label: "个股研究专员",
    timeoutMinutes: 20,
    scope: "个股基本面/财报/估值深度研究"
  },
  "chan-theory-analyst": {
    label: "缠论分析专员",
    timeoutMinutes: 15,
    scope: "缠论技术分析（K线/笔/中枢/买卖点）"
  },
  "backtest-executor": {
    label: "回测执行专员",
    timeoutMinutes: 25,
    scope: "策略回测执行与绩效评估"
  },
  "report-writer": {
    label: "报告撰写专员",
    timeoutMinutes: 20,
    scope: "整合研究成果为离线 HTML 看板"
  }
};

/** 角色中文名；未知角色（如用户自定义）返回 null，UI 回退显示 description。 */
export function subagentRoleLabel(role: string | undefined): string | null {
  if (!role) return null;
  return SUBAGENT_ROLE_META[role]?.label ?? null;
}

/** 角色执行超时上限（分钟）；未知角色返回 null。 */
export function subagentTimeoutMinutes(role: string | undefined): number | null {
  if (!role) return null;
  return SUBAGENT_ROLE_META[role]?.timeoutMinutes ?? null;
}
