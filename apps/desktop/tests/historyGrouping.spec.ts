import { describe, expect, it } from "vitest";

import type { ChatSession } from "../src/lib/sessionStore";
import {
  DEFAULT_COLLAPSED_BUCKETS,
  DEFAULT_EXPANDED_BUCKETS,
  bucketForSession,
  groupSessionsByBucket,
  isArchivedSession,
  selectStaleSessions,
} from "../src/lib/historyGrouping";

// ── 测试辅助 ─────────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0); // 2026-08-12T12:00:00Z
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "s" + Math.random().toString(36).slice(2, 8),
    title: "测试会话",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "08/01 00:00",
    updatedAtIso: "2026-08-01T00:00:00.000Z",
    metadata: {},
    messages: [],
    reportMarkdown: "",
    activeSkills: [],
    ...overrides,
  };
}

function iso(msOffset: number): string {
  return new Date(NOW - msOffset).toISOString();
}

// ── isArchivedSession ────────────────────────────────────────────────

describe("isArchivedSession", () => {
  it("metadata.qilin_archived === true 时为 true", () => {
    expect(isArchivedSession(makeSession({ metadata: { qilin_archived: true } }))).toBe(true);
  });

  it("metadata.qilin_archived === false 时为 false", () => {
    expect(isArchivedSession(makeSession({ metadata: { qilin_archived: false } }))).toBe(false);
  });

  it("metadata 为空对象时为 false", () => {
    expect(isArchivedSession(makeSession({ metadata: {} }))).toBe(false);
  });

  it("metadata.qilin_archived 为非 bool 值时为 false（严格匹配 true）", () => {
    expect(isArchivedSession(makeSession({ metadata: { qilin_archived: "true" } }))).toBe(false);
    expect(isArchivedSession(makeSession({ metadata: { qilin_archived: 1 } }))).toBe(false);
  });
});

// ── bucketForSession ─────────────────────────────────────────────────

describe("bucketForSession", () => {
  it("< 24 小时 → today", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(2 * 60 * 60 * 1000) }), NOW)).toBe("today");
  });

  it("1-3 天 → last3d", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(2 * ONE_DAY_MS) }), NOW)).toBe("last3d");
  });

  it("3-7 天 → last7d", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(5 * ONE_DAY_MS) }), NOW)).toBe("last7d");
  });

  it("7-30 天 → last30d", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(20 * ONE_DAY_MS) }), NOW)).toBe("last30d");
  });

  it("> 30 天但未归档 → 仍落 last30d（自动归档是写操作，读侧不悄悄分到 archived）", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(45 * ONE_DAY_MS) }), NOW)).toBe("last30d");
  });

  it("metadata.qilin_archived === true → archived（优先于时间）", () => {
    // 即使是 1 小时前的，只要标记了 archived，就归到 archived 桶
    expect(bucketForSession(
      makeSession({ updatedAtIso: iso(60 * 60 * 1000), metadata: { qilin_archived: true } }),
      NOW
    )).toBe("archived");
  });

  it("无效 updatedAtIso（NaN）→ today（不误归到 archived）", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: "not-a-date" }), NOW)).toBe("today");
  });

  it("正好 24 小时 → last3d（边界 < 含义）", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(ONE_DAY_MS) }), NOW)).toBe("last3d");
  });

  it("正好 3 天 → last7d（边界 < 含义）", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(3 * ONE_DAY_MS) }), NOW)).toBe("last7d");
  });

  it("正好 7 天 → last30d（边界 < 含义）", () => {
    expect(bucketForSession(makeSession({ updatedAtIso: iso(7 * ONE_DAY_MS) }), NOW)).toBe("last30d");
  });
});

// ── groupSessionsByBucket ────────────────────────────────────────────

describe("groupSessionsByBucket", () => {
  it("空数组返回空数组（不出现空桶）", () => {
    expect(groupSessionsByBucket([], NOW)).toEqual([]);
  });

  it("保留固定桶顺序：today / last3d / last7d / last30d / archived（非时间顺序）", () => {
    // 故意乱序传入，验证返回顺序与桶定义一致
    const sessions = [
      makeSession({ id: "archived-1", updatedAtIso: iso(60 * 60 * 1000), metadata: { qilin_archived: true } }),
      makeSession({ id: "last30d-1", updatedAtIso: iso(20 * ONE_DAY_MS) }),
      makeSession({ id: "today-1", updatedAtIso: iso(60 * 60 * 1000) }),
      makeSession({ id: "last3d-1", updatedAtIso: iso(2 * ONE_DAY_MS) }),
      makeSession({ id: "last7d-1", updatedAtIso: iso(5 * ONE_DAY_MS) }),
    ];
    const buckets = groupSessionsByBucket(sessions, NOW);
    expect(buckets.map((b) => b.bucket)).toEqual(["today", "last3d", "last7d", "last30d", "archived"]);
  });

  it("空桶不出现（只传 today + archived，不应包含 last3d/last7d/last30d）", () => {
    const sessions = [
      makeSession({ id: "today-1", updatedAtIso: iso(60 * 60 * 1000) }),
      makeSession({ id: "archived-1", metadata: { qilin_archived: true } }),
    ];
    const buckets = groupSessionsByBucket(sessions, NOW);
    expect(buckets.map((b) => b.bucket)).toEqual(["today", "archived"]);
  });

  it("桶内顺序保留传入顺序（调用方负责倒序排）", () => {
    const sessions = [
      makeSession({ id: "t1", updatedAtIso: iso(60 * 60 * 1000) }),
      makeSession({ id: "t2", updatedAtIso: iso(2 * 60 * 60 * 1000) }),
      makeSession({ id: "t3", updatedAtIso: iso(3 * 60 * 60 * 1000) }),
    ];
    const [bucket] = groupSessionsByBucket(sessions, NOW);
    expect(bucket?.sessions.map((s) => s.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("defaultExpanded 只有 today + last3d 为 true", () => {
    const sessions = [
      makeSession({ id: "today-1", updatedAtIso: iso(60 * 60 * 1000) }),
      makeSession({ id: "last3d-1", updatedAtIso: iso(2 * ONE_DAY_MS) }),
      makeSession({ id: "last7d-1", updatedAtIso: iso(5 * ONE_DAY_MS) }),
      makeSession({ id: "last30d-1", updatedAtIso: iso(20 * ONE_DAY_MS) }),
      makeSession({ id: "archived-1", metadata: { qilin_archived: true } }),
    ];
    const buckets = groupSessionsByBucket(sessions, NOW);
    const expandedMap = Object.fromEntries(buckets.map((b) => [b.bucket, b.defaultExpanded]));
    expect(expandedMap).toEqual({
      today: true,
      last3d: true,
      last7d: false,
      last30d: false,
      archived: false,
    });
  });

  it("label 已本地化", () => {
    const buckets = groupSessionsByBucket(
      [makeSession({ id: "today-1", updatedAtIso: iso(60 * 60 * 1000) })],
      NOW
    );
    expect(buckets[0]?.label).toBe("今天");
  });

  it("archived session 即使时间在 today 范围内仍分到 archived", () => {
    const sessions = [
      makeSession({
        id: "archived-recent",
        updatedAtIso: iso(60 * 60 * 1000),
        metadata: { qilin_archived: true },
      }),
    ];
    const buckets = groupSessionsByBucket(sessions, NOW);
    expect(buckets.map((b) => b.bucket)).toEqual(["archived"]);
  });
});

// ── selectStaleSessions ──────────────────────────────────────────────

describe("selectStaleSessions", () => {
  it("返回 > 30 天且未归档的 session", () => {
    const sessions = [
      makeSession({ id: "fresh", updatedAtIso: iso(5 * ONE_DAY_MS) }),
      makeSession({ id: "stale-1", updatedAtIso: iso(31 * ONE_DAY_MS) }),
      makeSession({ id: "stale-2", updatedAtIso: iso(60 * ONE_DAY_MS) }),
    ];
    const stale = selectStaleSessions(sessions, NOW);
    expect(stale.map((s) => s.id)).toEqual(["stale-1", "stale-2"]);
  });

  it("排除已归档的 session（避免重复归档）", () => {
    const sessions = [
      makeSession({ id: "stale-archived", updatedAtIso: iso(60 * ONE_DAY_MS), metadata: { qilin_archived: true } }),
      makeSession({ id: "stale-active", updatedAtIso: iso(60 * ONE_DAY_MS) }),
    ];
    const stale = selectStaleSessions(sessions, NOW);
    expect(stale.map((s) => s.id)).toEqual(["stale-active"]);
  });

  it("正好 30 天不算 stale（> 严格大于）", () => {
    const sessions = [
      makeSession({ id: "boundary", updatedAtIso: iso(30 * ONE_DAY_MS) }),
    ];
    expect(selectStaleSessions(sessions, NOW)).toEqual([]);
  });

  it("无效时间戳不入选（避免坏数据触发误归档）", () => {
    const sessions = [
      makeSession({ id: "bad", updatedAtIso: "not-a-date" }),
    ];
    expect(selectStaleSessions(sessions, NOW)).toEqual([]);
  });

  it("自定义 thresholdDays 生效", () => {
    const sessions = [
      makeSession({ id: "week-old", updatedAtIso: iso(8 * ONE_DAY_MS) }),
    ];
    expect(selectStaleSessions(sessions, NOW, 7).map((s) => s.id)).toEqual(["week-old"]);
    expect(selectStaleSessions(sessions, NOW, 14)).toEqual([]);
  });
});

// ── 默认展开/折叠常量一致性 ──────────────────────────────────────────

describe("默认展开/折叠常量", () => {
  it("DEFAULT_EXPANDED_BUCKETS 包含 today + last3d", () => {
    expect(DEFAULT_EXPANDED_BUCKETS.has("today")).toBe(true);
    expect(DEFAULT_EXPANDED_BUCKETS.has("last3d")).toBe(true);
    expect(DEFAULT_EXPANDED_BUCKETS.size).toBe(2);
  });

  it("DEFAULT_COLLAPSED_BUCKETS 包含 last7d + last30d + archived", () => {
    expect(DEFAULT_COLLAPSED_BUCKETS.has("last7d")).toBe(true);
    expect(DEFAULT_COLLAPSED_BUCKETS.has("last30d")).toBe(true);
    expect(DEFAULT_COLLAPSED_BUCKETS.has("archived")).toBe(true);
    expect(DEFAULT_COLLAPSED_BUCKETS.size).toBe(3);
  });

  it("两个集合互为补集（无交集，并集覆盖全部 5 个桶）", () => {
    const allBuckets = ["today", "last3d", "last7d", "last30d", "archived"] as const;
    for (const b of allBuckets) {
      expect(DEFAULT_EXPANDED_BUCKETS.has(b) !== DEFAULT_COLLAPSED_BUCKETS.has(b)).toBe(true);
    }
  });
});
