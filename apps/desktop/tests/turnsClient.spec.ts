import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelRun,
  deleteUpload,
  ensureThread,
  fetchThreadMessages,
  getUploadLimits,
  listThreads,
  listUploads,
  runContextFromModel,
  streamRun,
  uploadFiles,
  type RunContext,
  type UploadedFileRef
} from "../src/lib/turnsClient";
import { makeTextStream } from "../src/lib/sseParser";

// ── fetch mock 基础设施 ────────────────────────────────────────────────

interface MockRespOpts {
  ok?: boolean;
  status?: number;
  body?: ReadableStream<Uint8Array> | null;
  json?: unknown;
  text?: string;
}

function makeMockResponse(opts: MockRespOpts): Response {
  const ok = opts.ok ?? (opts.status ?? 200) < 400;
  const status = opts.status ?? 200;
  return {
    ok,
    status,
    body: opts.body ?? null,
    json: async () => opts.json ?? {},
    text: async () => opts.text ?? ""
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // 注入 CSRF cookie（readCsrfToken 读 document.cookie）
  document.cookie = "csrf_token=test-csrf-abc";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrf_token=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

// ── ensureThread ──────────────────────────────────────────────────────

describe("ensureThread", () => {
  it("POST /api/threads 返回 thread_id", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: { thread_id: "thr-123" } }));
    const id = await ensureThread();
    expect(id).toBe("thr-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
    expect(init.body).toBe("{}");
  });

  it("响应缺少 thread_id 时抛错", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: { ok: true } }));
    await expect(ensureThread()).rejects.toThrow(/缺少 thread_id/);
  });

  it("HTTP 非 2xx 时抛错并附状态与 detail", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 500, json: { detail: "boom" } })
    );
    await expect(ensureThread()).rejects.toThrow(/创建 thread 失败（500）：boom/);
  });
});

// ── streamRun ─────────────────────────────────────────────────────────

describe("streamRun", () => {
  // 工厂函数：每个测试独立构造 handlers（vi.fn 不跨测试累积调用计数）
  function makeRunOpts() {
    return {
      threadId: "thr-1",
      input: { messages: [{ role: "user" as const, content: "你好" }] },
      context: { model_name: "deepseek-chat", thinking_enabled: true } as RunContext,
      handlers: { onFrame: vi.fn(), onError: vi.fn() }
    };
  }

  function streamResponse(sseChunks: string[]): Response {
    return makeMockResponse({ body: makeTextStream(sseChunks) });
  }

  it("逐帧回调 onFrame，遇 end 后停止", async () => {
    const opts = makeRunOpts();
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: metadata\ndata: {"run_id":"r1"}\n\n',
        'event: messages\ndata: [{"type":"ai","content":"你好"}]\n\n',
        "event: end\ndata: null\n\n",
        'event: values\ndata: {"should":"not emit"}\n\n' // end 之后不应产出
      ])
    );
    await streamRun(opts);
    expect(opts.handlers.onFrame).toHaveBeenCalledTimes(3);
    const events = opts.handlers.onFrame.mock.calls.map((c) => c[0].event);
    expect(events).toEqual(["metadata", "messages", "end"]);
    expect(opts.handlers.onError).not.toHaveBeenCalled();
  });

  it("metadata 帧的 run_id 回调 onRunId（供显式 cancel）", async () => {
    const opts = {
      ...makeRunOpts(),
      handlers: { onFrame: vi.fn(), onError: vi.fn(), onRunId: vi.fn() }
    };
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: metadata\ndata: {"run_id":"run-xyz-789"}\n\n',
        "event: end\ndata: null\n\n"
      ])
    );
    await streamRun(opts);
    expect(opts.handlers.onRunId).toHaveBeenCalledWith("run-xyz-789");
  });

  it("无 onRunId 回调时不报错（可选 handler）", async () => {
    const opts = makeRunOpts(); // handlers 无 onRunId
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: metadata\ndata: {"run_id":"r2"}\n\n',
        "event: end\ndata: null\n\n"
      ])
    );
    await expect(streamRun(opts)).resolves.toBeUndefined();
  });

  it("metadata 帧 run_id 非字符串时不回调 onRunId", async () => {
    const opts = {
      ...makeRunOpts(),
      handlers: { onFrame: vi.fn(), onError: vi.fn(), onRunId: vi.fn() }
    };
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: metadata\ndata: {"run_id":123}\n\n',
        "event: end\ndata: null\n\n"
      ])
    );
    await streamRun(opts);
    expect(opts.handlers.onRunId).not.toHaveBeenCalled();
  });

  it("注入 context 与 stream_mode 到 body", async () => {
    const opts = makeRunOpts();
    fetchMock.mockResolvedValue(streamResponse(["event: end\ndata: null\n\n"]));
    await streamRun(opts);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.input).toEqual({ messages: [{ role: "user", content: "你好" }] });
    expect(body.context).toEqual({ model_name: "deepseek-chat", thinking_enabled: true });
    expect(body.config).toEqual({ recursion_limit: 1000 });
    expect(body.stream_mode).toEqual(["values", "messages-tuple", "custom"]);
  });

  it("请求头带 CSRF 与 Accept: text/event-stream，路径含 threadId", async () => {
    const opts = makeRunOpts();
    fetchMock.mockResolvedValue(streamResponse(["event: end\ndata: null\n\n"]));
    await streamRun(opts);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/thr-1/runs/stream");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
    expect(init.headers["Accept"]).toBe("text/event-stream");
  });

  it("event:error 帧触发 onError 并停止", async () => {
    const opts = makeRunOpts();
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: messages\ndata: [{"type":"ai","content":"部分"}]\n\n',
        'event: error\ndata: "模型超时"\n\n',
        "event: end\ndata: null\n\n" // error 后不应继续
      ])
    );
    await streamRun(opts);
    // error 帧由 onError 处理，不进 onFrame（避免污染 reducer）；messages 帧已进 onFrame
    expect(opts.handlers.onFrame).toHaveBeenCalledTimes(1);
    expect(opts.handlers.onError).toHaveBeenCalledTimes(1);
    expect(opts.handlers.onError.mock.calls[0][0].message).toBe("模型超时");
  });

  it("HTTP 非 2xx 触发 onError", async () => {
    const opts = makeRunOpts();
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 403, json: { detail: "csrf invalid" } })
    );
    await streamRun(opts);
    expect(opts.handlers.onFrame).not.toHaveBeenCalled();
    expect(opts.handlers.onError).toHaveBeenCalledTimes(1);
    expect(opts.handlers.onError.mock.calls[0][0].message).toMatch(/发起 run 失败（403）/);
  });

  it("fetch 抛 AbortError 时静默终止（不报错）", async () => {
    const opts = makeRunOpts();
    const abortErr = new DOMException("aborted", "AbortError");
    fetchMock.mockRejectedValue(abortErr);
    await streamRun(opts);
    expect(opts.handlers.onFrame).not.toHaveBeenCalled();
    expect(opts.handlers.onError).not.toHaveBeenCalled();
  });

  it("fetch 抛普通异常时触发 onError", async () => {
    const opts = makeRunOpts();
    fetchMock.mockRejectedValue(new Error("network down"));
    await streamRun(opts);
    expect(opts.handlers.onError).toHaveBeenCalledTimes(1);
    expect(opts.handlers.onError.mock.calls[0][0].message).toBe("network down");
  });

  it("signal 已 abort 时静默终止", async () => {
    const opts = makeRunOpts();
    fetchMock.mockResolvedValue(streamResponse(["event: end\ndata: null\n\n"]));
    const controller = new AbortController();
    controller.abort();
    await streamRun({ ...opts, signal: controller.signal });
    // abort 后即便 fetch 成功也不应产出帧（每帧前检查 signal.aborted）
    expect(opts.handlers.onFrame).not.toHaveBeenCalled();
    expect(opts.handlers.onError).not.toHaveBeenCalled();
  });
});

// ── fetchThreadMessages ───────────────────────────────────────────────

describe("fetchThreadMessages", () => {
  it("GET /messages 返回 {messages:[...]} 形态", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ json: { messages: [{ type: "human", content: "hi" }] } })
    );
    const msgs = await fetchThreadMessages("thr-1");
    expect(msgs).toEqual([{ type: "human", content: "hi" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/thr-1/messages");
    expect(init.method).toBe("GET");
  });

  it("引擎直接返回数组形态时兼容", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: [{ a: 1 }, { a: 2 }] }));
    const msgs = await fetchThreadMessages("thr-1");
    expect(msgs).toHaveLength(2);
  });

  it("HTTP 非 2xx 时抛错", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 404, json: { detail: "not found" } })
    );
    await expect(fetchThreadMessages("thr-1")).rejects.toThrow(/拉取历史消息失败（404）/);
  });
});

// ── listThreads ───────────────────────────────────────────────────────

describe("listThreads", () => {
  it("POST /api/threads/search 返回 thread 列表", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        json: [
          {
            thread_id: "thr-1",
            status: "idle",
            created_at: "2026-07-31T00:00:00.000Z",
            updated_at: "2026-07-31T12:00:00.000Z",
            values: { title: "茅台分析" }
          },
          {
            thread_id: "thr-2",
            status: "idle",
            created_at: "2026-07-30T00:00:00.000Z",
            updated_at: "2026-07-30T12:00:00.000Z",
            values: { title: "半导体跟踪" }
          }
        ]
      })
    );
    const threads = await listThreads(50);
    expect(threads).toHaveLength(2);
    expect(threads[0].thread_id).toBe("thr-1");
    expect(threads[0].values.title).toBe("茅台分析");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/search");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ limit: 50, offset: 0 });
  });

  it("HTTP 非 2xx 时返回空数组（不抛错，不打断启动流程）", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 401, json: { detail: "unauthorized" } })
    );
    const threads = await listThreads();
    expect(threads).toEqual([]);
  });

  it("fetch 网络异常时返回空数组（gateway 未启动不报错）", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const threads = await listThreads();
    expect(threads).toEqual([]);
  });

  it("响应非数组时返回空数组", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: { not: "an array" } }));
    const threads = await listThreads();
    expect(threads).toEqual([]);
  });
});

// ── cancelRun ───────────────────────────────────────────────────────

describe("cancelRun", () => {
  it("POST .../runs/{run_id}/cancel?action=interrupt 成功", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ status: 202, text: "" }));
    await cancelRun("thr-1", "run-abc");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:18001/api/threads/thr-1/runs/run-abc/cancel?action=interrupt"
    );
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
  });

  it("HTTP 非 2xx 时抛错", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 409, json: { detail: "not cancellable" } })
    );
    await expect(cancelRun("thr-1", "run-abc")).rejects.toThrow(/取消 run 失败（409）：not cancellable/);
  });

  it("run_id 与 thread_id 均 URL 编码", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ status: 202, text: "" }));
    await cancelRun("thr/slash", "run space");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/threads/thr%2Fslash/runs/run%20space/cancel");
  });
});

// ── runContextFromModel ───────────────────────────────────────────────

describe("runContextFromModel", () => {
  it("从模型能力位映射 model_name + thinking_enabled", () => {
    const ctx = runContextFromModel({ name: "deepseek-chat", supports_thinking: true });
    expect(ctx).toEqual({
      model_name: "deepseek-chat",
      thinking_enabled: true,
      subagent_enabled: true
    });
  });

  it("supports_thinking=false 时 thinking_enabled=false", () => {
    const ctx = runContextFromModel({ name: "gpt-4o", supports_thinking: false });
    expect(ctx.thinking_enabled).toBe(false);
  });

  it("supports_reasoning_effort + reasoningEffort 时注入 reasoning_effort", () => {
    const ctx = runContextFromModel(
      { name: "o1", supports_thinking: true, supports_reasoning_effort: true },
      "high"
    );
    expect(ctx.reasoning_effort).toBe("high");
  });

  it("不支持 reasoning_effort 时即使传了也不注入", () => {
    const ctx = runContextFromModel(
      { name: "deepseek-chat", supports_thinking: true, supports_reasoning_effort: false },
      "high"
    );
    expect(ctx.reasoning_effort).toBeUndefined();
  });

  it("默认开启子代理（subagent_enabled=true）", () => {
    const ctx = runContextFromModel({ name: "deepseek-chat", supports_thinking: true });
    expect(ctx.subagent_enabled).toBe(true);
  });
});

// ── uploadFiles ──────────────────────────────────────────────────────

describe("uploadFiles", () => {
  it("POST multipart 上传，返回 UploadedFileRef[]，不带 Content-Type（浏览器加 boundary）", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        json: {
          success: true,
          files: [
            {
              filename: "a.csv",
              size: 123,
              virtual_path: "/uploads/a.csv",
              artifact_url: "/api/threads/t1/uploads/a.csv"
            }
          ],
          message: "ok"
        }
      })
    );
    const file = new File(["col1,col2\n1,2\n"], "a.csv", { type: "text/csv" });
    const refs = await uploadFiles("t1", [file]);
    expect(refs).toEqual([
      {
        filename: "a.csv",
        size: 123,
        virtual_path: "/uploads/a.csv",
        artifact_url: "/api/threads/t1/uploads/a.csv"
      }
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/t1/uploads");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    // multipart 不能手动设 Content-Type（浏览器自动加 boundary）
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
    // body 是 FormData，含 files 字段
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    const entries = form.getAll("files");
    expect(entries).toHaveLength(1);
    expect((entries[0] as File).name).toBe("a.csv");
  });

  it("空文件列表返回空数组，不发起请求", async () => {
    const refs = await uploadFiles("t1", []);
    expect(refs).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("响应 files 为空时抛错", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ json: { success: false, files: [], message: "全部跳过" } })
    );
    const file = new File(["x"], "a.txt");
    await expect(uploadFiles("t1", [file])).rejects.toThrow(/全部跳过/);
  });

  it("HTTP 非 2xx 时抛错并附状态与 detail", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 413, json: { detail: "too large" } })
    );
    const file = new File(["x"], "big.bin");
    await expect(uploadFiles("t1", [file])).rejects.toThrow(/上传附件失败（413）：too large/);
  });

  it("threadId URL 编码", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        json: {
          success: true,
          files: [{ filename: "a.txt", size: 1, virtual_path: "/uploads/a.txt", artifact_url: "u" }],
          message: "ok"
        }
      })
    );
    await uploadFiles("t/slash", [new File(["x"], "a.txt")]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/threads/t%2Fslash/uploads");
  });
});

// ── getUploadLimits ──────────────────────────────────────────────────

describe("getUploadLimits", () => {
  it("GET .../uploads/limits 返回 UploadLimits", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        json: { max_files: 5, max_file_size: 1048576, max_total_size: 5242880 }
      })
    );
    const limits = await getUploadLimits("t1");
    expect(limits).toEqual({ max_files: 5, max_file_size: 1048576, max_total_size: 5242880 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/t1/uploads/limits");
    expect(init.method).toBe("GET");
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
  });

  it("HTTP 非 2xx 时抛错", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 403, json: { detail: "forbidden" } })
    );
    await expect(getUploadLimits("t1")).rejects.toThrow(/读取上传限制失败（403）：forbidden/);
  });
});

// ── listUploads ──────────────────────────────────────────────────────

describe("listUploads", () => {
  it("GET .../uploads/list 返回 UploadedFileRef[]", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({
        json: {
          files: [
            { filename: "x.csv", size: 10, virtual_path: "/uploads/x.csv", artifact_url: "u1" },
            { filename: "y.csv", size: 20, virtual_path: "/uploads/y.csv", artifact_url: "u2" }
          ],
          count: 2
        }
      })
    );
    const refs = await listUploads("t1");
    expect(refs).toHaveLength(2);
    expect(refs[0].filename).toBe("x.csv");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/t1/uploads/list");
    expect(init.method).toBe("GET");
  });

  it("files 缺失时返回空数组", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ json: { count: 0 } }));
    expect(await listUploads("t1")).toEqual([]);
  });

  it("HTTP 非 2xx 时抛错", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 404, json: { detail: "no thread" } })
    );
    await expect(listUploads("t1")).rejects.toThrow(/列出附件失败（404）/);
  });
});

// ── deleteUpload ─────────────────────────────────────────────────────

describe("deleteUpload", () => {
  it("DELETE .../uploads/{filename} 成功", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ status: 200, json: { success: true } }));
    await deleteUpload("t1", "a.csv");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:18001/api/threads/t1/uploads/a.csv");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
  });

  it("HTTP 非 2xx 时抛错", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ ok: false, status: 404, json: { detail: "not found" } })
    );
    await expect(deleteUpload("t1", "missing.csv")).rejects.toThrow(/删除附件失败（404）/);
  });

  it("filename URL 编码", async () => {
    fetchMock.mockResolvedValue(makeMockResponse({ status: 200, json: {} }));
    await deleteUpload("t1", "名 称.csv");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/uploads/" + encodeURIComponent("名 称.csv"));
  });
});
