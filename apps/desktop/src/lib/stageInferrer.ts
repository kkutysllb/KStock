// ── stageInferrer：pipeline_stage 前端推断兜底 ────────────────────────
// 引擎无直接 pipeline_stage 字段，前端基于 SSE 帧内容推断当前阶段。
// 阶段单调推进（不回退）：例如已到"撰写报告"后，后续 tool_call 不会
// 让徽章退回"数据分析"，避免用户困惑。
//
// 阶段词汇可后续调整；STAGE_* 常量供 StageBadge 共用。

import type { SseFrame } from "./sseParser";

/** pipeline_stage 枚举（按流程顺序）。 */
export const STAGE_PREPARE = "准备";
export const STAGE_SEARCH = "检索资料";
export const STAGE_ANALYSIS = "数据分析";
export const STAGE_REPORT = "撰写报告";
export const STAGE_DONE = "完成";

const STAGE_ORDER: Readonly<Record<string, number>> = {
  [STAGE_PREPARE]: 0,
  [STAGE_SEARCH]: 1,
  [STAGE_ANALYSIS]: 2,
  [STAGE_REPORT]: 3,
  [STAGE_DONE]: 4
};

// 检索类关键词（subagent description / 工具名 / 消息内容命中 → 检索资料）
const SEARCH_KEYWORDS = ["搜索", "检索", "news", "search", "公告", "report-search"];
// 分析类关键词（工具名命中 → 数据分析）
const ANALYSIS_KEYWORDS = [
  "financial", "statement", "valuation", "industry", "macro", "business",
  "财务", "估值", "行业", "宏观"
];

/**
 * 根据 SSE 帧推断 pipeline_stage（单调推进，不回退）。
 * @param prev 当前阶段（首次调用传 undefined → 兜底"准备"）
 * @param frame SSE 帧
 * @returns 推断后的阶段
 */
export function inferStage(prev: string | undefined, frame: SseFrame): string {
  const candidate = inferCandidate(frame);
  if (candidate == null) return prev ?? STAGE_PREPARE;
  const prevOrder = prev ? (STAGE_ORDER[prev] ?? 0) : -1;
  const candidateOrder = STAGE_ORDER[candidate] ?? 0;
  // 候选阶段序号须严格大于 prev 才推进（同阶段保持不变，低阶段不回退）
  return candidateOrder > prevOrder ? candidate : (prev ?? STAGE_PREPARE);
}

/** 从单帧推断候选阶段（不考虑 prev）；未命中返回 null。 */
function inferCandidate(frame: SseFrame): string | null {
  switch (frame.event) {
    case "end":
      return STAGE_DONE;

    case "values": {
      const snap = frame.data as Record<string, unknown> | null;
      if (snap && Array.isArray(snap.artifacts) && snap.artifacts.length > 0) {
        return STAGE_REPORT;
      }
      return null;
    }

    case "custom": {
      const ev = frame.data as Record<string, unknown> | null;
      if (!ev) return null;
      const type = ev.type as string;
      if (type !== "task_started" && type !== "task_running") return null;
      const desc = asString(ev.description);
      const content = asString(
        (ev.message as Record<string, unknown> | undefined)?.content
      );
      const hay = `${desc} ${content}`.toLowerCase();
      if (SEARCH_KEYWORDS.some((k) => hay.includes(k.toLowerCase()))) {
        return STAGE_SEARCH;
      }
      return null;
    }

    case "messages": {
      if (!Array.isArray(frame.data) || frame.data.length === 0) return null;
      const msg = frame.data[0] as Record<string, unknown> | undefined;
      if (!msg || typeof msg !== "object") return null;
      const toolCalls = msg.tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
      // 分析词优先于搜索词（同名工具倾向分析）
      for (const tc of toolCalls) {
        const name = asString(tc.name).toLowerCase();
        if (ANALYSIS_KEYWORDS.some((k) => name.includes(k.toLowerCase()))) {
          return STAGE_ANALYSIS;
        }
      }
      for (const tc of toolCalls) {
        const name = asString(tc.name).toLowerCase();
        if (SEARCH_KEYWORDS.some((k) => name.includes(k.toLowerCase()))) {
          return STAGE_SEARCH;
        }
      }
      return null;
    }

    default:
      return null;
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
