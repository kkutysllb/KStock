// ── 历史任务时间分组工具 ──────────────────────────────────────────────
//
// 把后端返回的 flat 历史会话列表按时间维度分桶，供 sidebar 的「历史任务」
// 区域做多级折叠展示（默认只展开「3 天以内」）。
//
// 桶定义（按 updatedAtIso 到 now 的时间差）：
//   today    : 0–24 小时
//   last3d   : 1–3 天
//   last7d   : 3–7 天
//   last30d  : 7–30 天
//   archived : metadata.qilin_archived === true（优先于时间判断）
//
// 空桶不出现在返回值里。archived 桶单独靠 includeArchived=true 拉取，
// 不会被时间桶逻辑误分（优先级最高）。

import type { ChatSession } from "./sessionStore";

export type HistoryBucket = "today" | "last3d" | "last7d" | "last30d" | "archived";

export interface BucketedSessions {
  bucket: HistoryBucket;
  /** 桶标题，已本地化。 */
  label: string;
  /** 该桶内的会话（保持调用方传入的顺序，调用方负责倒序排）。 */
  sessions: ChatSession[];
  /** 是否默认展开——只有「3 天以内」（today + last3d）默认展开。 */
  defaultExpanded: boolean;
}

const BUCKET_LABELS: Record<HistoryBucket, string> = {
  today: "今天",
  last3d: "3 天内",
  last7d: "7 天内",
  last30d: "30 天内",
  archived: "已归档"
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 默认展开的桶集合（导出供 Home.tsx 初始化 collapsedBuckets 用）。 */
export const DEFAULT_EXPANDED_BUCKETS: ReadonlySet<HistoryBucket> = new Set<HistoryBucket>([
  "today",
  "last3d"
]);

/** 默认折叠的桶集合（DEFAULT_EXPANDED_BUCKETS 的补集）。 */
export const DEFAULT_COLLAPSED_BUCKETS: ReadonlySet<HistoryBucket> = new Set<HistoryBucket>([
  "last7d",
  "last30d",
  "archived"
]);

/**
 * 判定一个 session 是否已被归档。
 *
 * 容错：metadata 可能是 undefined（旧版客户端恢复的 session），或值不是
 * 布尔（后端 schema 校验保证为 bool，但本地新建会话无校验）。只有严格
 * 等于 ``true`` 才视为归档。
 */
export function isArchivedSession(session: ChatSession): boolean {
  return session.metadata?.qilin_archived === true;
}

/**
 * 按 updatedAtIso 计算单个 session 所属的非归档桶。
 *
 * 时间差 buckets：[24h, 3d, 7d, 30d]。返回值是该数组中第一个未超出的桶。
 * > 30 天的 session 落到 ``last30d``（调用方负责在自动归档触发时把 > 30 天
 * 的项转为 archived，而不是在这里默默塞进 archived——自动归档是写操作，
 * 不是读侧分类）。
 */
export function bucketForSession(session: ChatSession, now: number = Date.now()): HistoryBucket {
  if (isArchivedSession(session)) return "archived";
  const updated = new Date(session.updatedAtIso).getTime();
  // 无效时间戳（NaN）回退到 today，避免坏数据被错误归到 archived。
  if (!Number.isFinite(updated)) return "today";
  const diff = now - updated;
  if (diff < ONE_DAY_MS) return "today";
  if (diff < 3 * ONE_DAY_MS) return "last3d";
  if (diff < 7 * ONE_DAY_MS) return "last7d";
  return "last30d";
}

/**
 * 把 flat session 列表分桶，返回非空桶列表（按固定桶顺序，非时间顺序）。
 *
 * 调用方应先把 sessions 按 updatedAtIso 倒序排好再传入，桶内顺序保留传入顺序。
 * 返回值的桶顺序固定为 today / last3d / last7d / last30d / archived，与
 * 桶定义一致；空桶不出现。
 */
export function groupSessionsByBucket(
  sessions: ChatSession[],
  now: number = Date.now()
): BucketedSessions[] {
  const order: HistoryBucket[] = ["today", "last3d", "last7d", "last30d", "archived"];
  const buckets = new Map<HistoryBucket, ChatSession[]>();
  for (const session of sessions) {
    const key = bucketForSession(session, now);
    const arr = buckets.get(key);
    if (arr) {
      arr.push(session);
    } else {
      buckets.set(key, [session]);
    }
  }
  const result: BucketedSessions[] = [];
  for (const bucket of order) {
    const arr = buckets.get(bucket);
    if (!arr || arr.length === 0) continue;
    result.push({
      bucket,
      label: BUCKET_LABELS[bucket],
      sessions: arr,
      defaultExpanded: DEFAULT_EXPANDED_BUCKETS.has(bucket)
    });
  }
  return result;
}

/**
 * 找出需要被自动归档的 session（updatedAtIso 距今超过 30 天且未归档）。
 *
 * 用于启动后的一次性清理。返回值保持传入顺序。
 */
export function selectStaleSessions(
  sessions: ChatSession[],
  now: number = Date.now(),
  thresholdDays = 30
): ChatSession[] {
  const threshold = thresholdDays * ONE_DAY_MS;
  return sessions.filter((session) => {
    if (isArchivedSession(session)) return false;
    const updated = new Date(session.updatedAtIso).getTime();
    if (!Number.isFinite(updated)) return false;
    return now - updated > threshold;
  });
}
