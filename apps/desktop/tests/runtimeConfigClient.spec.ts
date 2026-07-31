import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeConfig,
  isRuntimeConfigApiError,
  updateRuntimeConfigSection,
  type RuntimeConfig,
} from "../src/lib/runtimeConfigClient";

// ── fetch mock 基础设施（复用 memoryClient.spec 的模式）──

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
    text: async () =>
      opts.text ??
      (typeof opts.json === "string" ? opts.json : JSON.stringify(opts.json ?? "")),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

const sampleConfig: RuntimeConfig = {
  memory: {
    enabled: false,
    mode: "middleware",
    injection_enabled: false,
    shutdown_flush_timeout_seconds: 30,
    manager_class: "deermem",
    backend_config: {},
  },
  summarization: {
    enabled: true,
    model_name: null,
    trigger: { type: "tokens", value: 32000 },
    keep: { type: "messages", value: 10 },
    trim_tokens_to_summarize: 15564,
    summary_prompt: null,
    skill_file_read_tool_names: ["read_file"],
  },
  title: {
    enabled: true,
    max_words: 6,
    max_chars: 60,
    model_name: null,
  },
  database: {
    backend: "sqlite",
    sqlite_dir: ".qilin/data",
    postgres_url: "",
    echo_sql: false,
    pool_size: 5,
    pool_recycle: 300,
    command_timeout: 30,
    checkpoint_channel_mode: "full",
    checkpoint_delta: { snapshot_frequency: 10 },
    checkpoint_graph_cache: { accessor_graph_max: 64 },
  },
};

beforeEach(() => {
  document.cookie = "csrf_token=rc-csrf-test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrf_token=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

// ── getRuntimeConfig ────────────────────────────────────────────────

describe("getRuntimeConfig", () => {
  it("GET /api/v1/kstock/runtime-config 返回四段配置", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: sampleConfig }));
    const cfg = await getRuntimeConfig();
    expect(cfg.memory.manager_class).toBe("deermem");
    const trigger = cfg.summarization.trigger;
    const triggerVal = Array.isArray(trigger) ? trigger[0]?.value : trigger?.value;
    expect(triggerVal).toBe(32000);
    expect(cfg.title.max_words).toBe(6);
    expect(cfg.database.backend).toBe("sqlite");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:18001/api/v1/kstock/runtime-config");
    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBe("include");
  });

  it("网络错误归一为 status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getRuntimeConfig()).rejects.toMatchObject({ status: 0 });
  });
});

// ── updateRuntimeConfigSection ──────────────────────────────────────

describe("updateRuntimeConfigSection", () => {
  it("PUT 指定段带 body 和 CSRF header", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ json: { section: "title", value: sampleConfig.title } })
    );
    await updateRuntimeConfigSection("title", sampleConfig.title);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/v1/kstock/runtime-config/title");
    expect(init.method).toBe("PUT");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("X-CSRF-Token")).toBe("rc-csrf-test");
    expect(JSON.parse(init.body)).toEqual(sampleConfig.title);
  });

  it("段名被 URL 编码（无特殊字符场景仍是原文）", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ json: { section: "summarization", value: sampleConfig.summarization } })
    );
    await updateRuntimeConfigSection("summarization", sampleConfig.summarization);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:18001/api/v1/kstock/runtime-config/summarization"
    );
  });

  it("400 校验失败时返回 fieldErrors", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        status: 400,
        json: {
          detail: {
            code: "validation_failed",
            message: "title 配置校验失败",
            errors: [
              { field: "max_words", message: "Input should be less than or equal to 20", type: "less_than_equal" },
            ],
          },
        },
      })
    );
    await expect(updateRuntimeConfigSection("title", sampleConfig.title)).rejects.toMatchObject({
      status: 400,
      message: "title 配置校验失败",
      fieldErrors: [
        { field: "max_words", message: "Input should be less than or equal to 20", type: "less_than_equal" },
      ],
    });
  });

  it("detail 为字符串时直接作为 message", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ status: 400, json: { detail: "未知配置段 'foo'" } })
    );
    await expect(updateRuntimeConfigSection("title", sampleConfig.title)).rejects.toMatchObject({
      status: 400,
      message: "未知配置段 'foo'",
    });
  });
});

// ── isRuntimeConfigApiError ─────────────────────────────────────────

describe("isRuntimeConfigApiError", () => {
  it("识别错误形状", () => {
    expect(isRuntimeConfigApiError({ message: "x", status: 500 })).toBe(true);
    expect(isRuntimeConfigApiError(new Error("x"))).toBe(false);
    expect(isRuntimeConfigApiError(null)).toBe(false);
  });
});
