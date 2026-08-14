import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GENERAL_PREFERENCES,
  updateGeneralPreferences,
  type GeneralPreferences,
} from "../src/lib/generalSettingsClient";

// ── fetch mock（复用 runtimeConfigClient.spec 的模式）──

interface MockRespOpts {
  ok?: boolean;
  status?: number;
  json?: unknown;
}

function makeMockResponse(opts: MockRespOpts): Response {
  const status = opts.status ?? 200;
  return {
    ok: (opts.ok ?? status < 400),
    status,
    json: async () => opts.json ?? {},
    text: async () => JSON.stringify(opts.json ?? ""),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "cookie", { value: "", configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function prefs(overrides: Partial<GeneralPreferences> = {}): GeneralPreferences {
  return { ...DEFAULT_GENERAL_PREFERENCES, ...overrides };
}

describe("updateGeneralPreferences 旧网关兼容", () => {
  it("PUT 422 时剥离 notify_task_done 重试一次，其余设置保存成功", async () => {
    fetchMock
      .mockResolvedValueOnce(makeMockResponse({ status: 422, json: { detail: [{ loc: ["body", "notify_task_done"] }] } }))
      .mockResolvedValueOnce(
        makeMockResponse({ status: 200, json: { preferences: { ...prefs({ density: "compact" }), notify_task_done: undefined } } }),
      );

    const result = await updateGeneralPreferences(prefs({ notify_task_done: false, density: "compact" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(firstBody.notify_task_done).toBe(false);
    expect("notify_task_done" in retryBody).toBe(false);
    expect(retryBody.density).toBe("compact");
    // 旧网关响应缺字段时补默认值，调用方拿到完整对象
    expect(result.notify_task_done).toBe(true);
    expect(result.density).toBe("compact");
  });

  it("非 422 错误不重试，原样抛出", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ status: 401, json: { detail: "Not authenticated" } }),
    );

    await expect(updateGeneralPreferences(prefs())).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("422 且与 notify_task_done 无关时不重试（避免掩盖真实校验错误）", async () => {
    fetchMock.mockResolvedValue(
      makeMockResponse({ status: 422, json: { detail: [{ loc: ["body", "density"] }] } }),
    );

    // 构造一个无法通过校验的 density：依然先带 notify_task_done 发送，
    // 收到 422 后会剥离重试——此时第二次仍 422 则抛出（不再无限重试）
    fetchMock.mockResolvedValue(
      makeMockResponse({ status: 422, json: { detail: [{ loc: ["body", "density"] }] } }),
    );

    await expect(
      updateGeneralPreferences(prefs({ density: "compact" })),
    ).rejects.toMatchObject({ status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
