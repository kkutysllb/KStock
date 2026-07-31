import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMemory,
  createFact,
  deleteFact,
  exportMemory,
  getMemory,
  getMemoryConfig,
  getMemoryStatus,
  importMemory,
  isMemoryApiError,
  patchFact,
  reloadMemory,
  type MemoryData,
} from "../src/lib/memoryClient";

// ── fetch mock 基础设施（复用 turnsClient.spec 的模式）──

interface MockRespOpts {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}

function makeMockResponse(opts: MockRespOpts): Response {
  const ok = opts.ok ?? (opts.status ?? 200) < 400;
  const status = opts.status ?? 200;
  return {
    ok,
    status,
    json: async () => opts.json ?? {},
    text: async () => opts.text ?? (typeof opts.json === "string" ? opts.json : JSON.stringify(opts.json ?? "")),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

const sampleMemory: MemoryData = {
  version: "1.0",
  lastUpdated: "2026-07-31T10:00:00Z",
  facts: [
    {
      id: "fact_1",
      content: "User prefers TypeScript",
      category: "preference",
      confidence: 0.9,
      createdAt: "2026-07-30T08:00:00Z",
      source: "thr_abc",
    },
  ],
};

beforeEach(() => {
  document.cookie = "csrf_token=csrf-test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrf_token=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

// ── getMemory ────────────────────────────────────────────────────────

describe("getMemory", () => {
  it("GET /api/memory 返回完整记忆", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    const data = await getMemory();
    expect(data.facts).toHaveLength(1);
    expect(data.facts[0].id).toBe("fact_1");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:18001/api/memory");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBeUndefined(); // GET 无 method
    expect(init.credentials).toBe("include");
  });

  it("501 时抛 MemoryApiError 含 status", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ status: 501, json: { detail: "Operation 'get memory' not supported" } })
    );
    await expect(getMemory()).rejects.toMatchObject({
      message: "Operation 'get memory' not supported",
      status: 501,
    });
    expect(isMemoryApiError(await getMemory().catch((e) => e))).toBe(true);
  });

  it("网络错误归一为 status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getMemory()).rejects.toMatchObject({ status: 0 });
  });
});

// ── createFact ───────────────────────────────────────────────────────

describe("createFact", () => {
  it("POST /api/memory/facts 带 body 和 CSRF header", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    await createFact({ content: "hello", category: "context", confidence: 0.8 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/memory/facts");
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("X-CSRF-Token")).toBe("csrf-test");
    expect(JSON.parse(init.body)).toEqual({ content: "hello", category: "context", confidence: 0.8 });
  });

  it("省略 category/confidence 时填默认值", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    await createFact({ content: "plain" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ content: "plain", category: "context", confidence: 0.5 });
  });
});

// ── patchFact ────────────────────────────────────────────────────────

describe("patchFact", () => {
  it("PATCH 局部字段，只发提供字段", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    await patchFact("fact_1", { confidence: 0.95 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/memory/facts/fact_1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ confidence: 0.95 });
  });
});

// ── deleteFact / clearMemory ─────────────────────────────────────────

describe("deleteFact", () => {
  it("DELETE 单条 fact（编码 fact_id）", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    await deleteFact("fact/with slash");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/memory/facts/fact%2Fwith%20slash");
    expect(init.method).toBe("DELETE");
  });
});

describe("clearMemory", () => {
  it("DELETE /api/memory 清空全部", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: { ...sampleMemory, facts: [] } }));
    const data = await clearMemory();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:18001/api/memory");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(data.facts).toEqual([]);
  });
});

// ── reloadMemory / exportMemory / importMemory ───────────────────────

describe("reloadMemory", () => {
  it("POST /api/memory/reload", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    await reloadMemory();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:18001/api/memory/reload");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});

describe("exportMemory", () => {
  it("GET /api/memory/export", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    const data = await exportMemory();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:18001/api/memory/export");
    expect(data.facts[0].content).toBe("User prefers TypeScript");
  });
});

describe("importMemory", () => {
  it("POST /api/memory/import 带完整 body", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleMemory }));
    await importMemory(sampleMemory);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/memory/import");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(sampleMemory);
  });
});

// ── getMemoryConfig / getMemoryStatus ────────────────────────────────

describe("getMemoryConfig", () => {
  it("GET /api/memory/config 返回配置", async () => {
    const config = {
      enabled: true,
      mode: "middleware",
      injection_enabled: true,
      shutdown_flush_timeout_seconds: 30,
      manager_class: "deermem",
      backend_config: { max_facts: 100 },
    };
    fetchMock.mockResolvedValue(makeMockResponse({ json: config }));
    const data = await getMemoryConfig();
    expect(data.enabled).toBe(true);
    expect(data.mode).toBe("middleware");
    expect(data.backend_config.max_facts).toBe(100);
  });
});

describe("getMemoryStatus", () => {
  it("GET /api/memory/status 合并 config + data", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        json: {
          config: { enabled: true, mode: "tool", manager_class: "x", backend_config: {} },
          data: sampleMemory,
        },
      })
    );
    const status = await getMemoryStatus();
    expect(status.config.mode).toBe("tool");
    expect(status.data.facts).toHaveLength(1);
  });
});

// ── isMemoryApiError ─────────────────────────────────────────────────

describe("isMemoryApiError", () => {
  it("识别 MemoryApiError 形状", () => {
    expect(isMemoryApiError({ message: "x", status: 500 })).toBe(true);
    expect(isMemoryApiError(new Error("x"))).toBe(false);
    expect(isMemoryApiError(null)).toBe(false);
  });
});
