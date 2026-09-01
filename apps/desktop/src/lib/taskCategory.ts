// ── 历史任务按「任务种类」分组 ────────────────────────────────────────
//
// 把后端返回的 flat 历史会话按任务种类（市场分析 / 个股分析 / 选股扫描 /
// 策略回测 / 因子研究 / 报告研报 / 宏观行业 / 衍生品专题 / 通用其他）分组，
// 供侧栏「工作区」汇总折叠展示，取代原先的纯时间分桶。
//
// 分类是**纯读侧推导**：按会话标题关键词匹配（规则对齐 lead_soul 各场景
// 触发词），不依赖后端改动——已存在的历史任务重新渲染时自然按种类归类。
// 规则按顺序首个命中生效，特异性高的种类排在前面。

import type { ChatSession } from "./sessionStore";

/** 任务种类（general 为兜底桶）。 */
export type TaskCategory =
  | "market"
  | "stock"
  | "screening"
  | "backtest"
  | "factor"
  | "report"
  | "macro"
  | "derivative"
  | "general";

/** 侧栏分组顺序：高频研究线在前，兜底桶最后。 */
export const TASK_CATEGORY_ORDER: readonly TaskCategory[] = [
  "market",
  "stock",
  "screening",
  "backtest",
  "factor",
  "report",
  "macro",
  "derivative",
  "general"
];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  market: "市场分析",
  stock: "个股分析",
  screening: "选股扫描",
  backtest: "策略回测",
  factor: "因子研究",
  report: "报告研报",
  macro: "宏观行业",
  derivative: "衍生品专题",
  general: "通用其他"
};

/** 侧栏分组 key：任务种类 + 沿用的「已归档」组（语义同原时间分桶）。 */
export type TaskGroupKey = TaskCategory | "archived";

export const ARCHIVED_GROUP_KEY: TaskGroupKey = "archived";

/**
 * 分类规则表：顺序即优先级，首个命中生效。
 *
 * - factor 最特异（「多因子选股」「分层回测」都属因子研究线）；
 * - backtest 次之（「选股策略回测验证」按编排语义归回测而非选股）；
 * - report 先于 derivative（「可转债周度全景报告」是报告交付物）。
 */
const CATEGORY_RULES: ReadonlyArray<{ category: TaskCategory; pattern: RegExp }> = [
  {
    category: "factor",
    pattern: /因子|ic[\/-]?ir|ic均值|rankic|分层回测|拥挤度|factor/i
  },
  {
    category: "backtest",
    pattern: /回测|双均线|macd|rsi|boll|布林|策略(验证|评审|优化|研究|增强|回测)|动量策略|趋势策略|突破策略|反转策略|均线策略|均值回归|walk[\s-]?forward|样本外|参数(扫描|优化)|信号引擎/i
  },
  {
    category: "screening",
    pattern: /选股|筛选|策略扫描|高股息|成长股|价值股|涨停|超跌|主力资金|龙头股|问财|股票池|自选/i
  },
  {
    category: "report",
    pattern: /报告|研报|周报|月报|日报|复盘|纪要|综述|速览|全景/i
  },
  {
    // 市场分析：大盘/市场维度的联动与情绪研判（须先于 stock 的「分析」兜底，
    // 否则「市场联动分析」会被误归个股分析）。
    category: "market",
    pattern: /市场|大盘|联动|情绪|盘前|开盘|前瞻|资金流向|北向|宽基|风险偏好|指数表现/i
  },
  {
    category: "derivative",
    pattern: /可转债|转债|期权|期货|股指|etf|波动率|双低|权利金|隐含/i
  },
  {
    category: "macro",
    pattern: /宏观|gdp|cpi|ppi|lpr|社融|m2|pmi|行业|产业链|景气|板块|指数行情/i
  },
  {
    category: "stock",
    pattern: /个股|分析|研究|估值|财报|基本面|技术面|缠论|k线|诊断|尽调|龙头股|\d{6}/i
  }
];

/**
 * 推导单个会话的任务种类。标题为空/无命中 → general（通用其他）。
 */
export function classifyTaskCategory(title: string): TaskCategory {
  const text = (title || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return "general";
}

export interface TaskCategoryGroup {
  key: TaskGroupKey;
  /** 组标题，已本地化。 */
  label: string;
  /** 组内会话（保持调用方传入顺序，调用方负责按时间倒序）。 */
  sessions: ChatSession[];
  /** 是否默认展开：具体种类默认展开，「通用其他 / 已归档」默认折叠。 */
  defaultExpanded: boolean;
}

/** 默认折叠的分组：全部种类 + 已归档（用户手动展开）。 */
export const DEFAULT_COLLAPSED_TASK_GROUPS: ReadonlySet<TaskGroupKey> = new Set<TaskGroupKey>([
  ...TASK_CATEGORY_ORDER,
  "archived"
]);

/**
 * 把 flat 会话列表按任务种类分组，返回非空组列表（固定种类顺序）。
 *
 * 调用方应先把 sessions 按 updatedAtIso 倒序排好再传入，组内顺序保留。
 * 已归档会话由调用方单独经 archivedSessions 传入（与原时间分桶一致，
 * 不混入种类分组）。
 */
export function groupSessionsByTaskCategory(
  sessions: ChatSession[]
): TaskCategoryGroup[] {
  const buckets = new Map<TaskCategory, ChatSession[]>();
  for (const session of sessions) {
    const key = classifyTaskCategory(session.title);
    const arr = buckets.get(key);
    if (arr) {
      arr.push(session);
    } else {
      buckets.set(key, [session]);
    }
  }
  const result: TaskCategoryGroup[] = [];
  for (const category of TASK_CATEGORY_ORDER) {
    const arr = buckets.get(category);
    if (!arr || arr.length === 0) continue;
    result.push({
      key: category,
      label: TASK_CATEGORY_LABELS[category],
      sessions: arr,
      defaultExpanded: !DEFAULT_COLLAPSED_TASK_GROUPS.has(category)
    });
  }
  return result;
}
