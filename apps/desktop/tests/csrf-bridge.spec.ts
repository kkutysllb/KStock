// ── CSRF 桥接单元测试 ────────────────────────────────────────────────
// 验证 app:// 反向代理从主进程 session cookie jar 读取 gateway 下发的
// csrf_token 并注入 X-CSRF-Token header 的行为，覆盖打包态渲染进程跨
// scheme 读不到 cookie 的场景（见 electron/lib/csrf-bridge.ts）。

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factory 被 hoist 到文件顶部，普通 const 会陷入 TDZ。用 vi.hoisted
// 把 mock 函数声明同步提升，使 factory 能安全引用。
const { mockCookiesGet } = vi.hoisted(() => ({ mockCookiesGet: vi.fn() }));

vi.mock("electron", () => ({
  session: {
    defaultSession: {
      cookies: {
        get: mockCookiesGet,
      },
    },
  },
}));

// vitest 会把 vi.mock 提升到所有 import 之前，此处安全 import 被测模块。
import { ensureCsrfHeader, readGatewayCsrfToken } from "../electron/lib/csrf-bridge";

describe("readGatewayCsrfToken", () => {
  beforeEach(() => {
    mockCookiesGet.mockReset();
  });

  it("cookie jar 有 csrf_token 时返回值，并按 port 构造 url", async () => {
    mockCookiesGet.mockResolvedValue([{ name: "csrf_token", value: "token-abc-123" }]);
    const token = await readGatewayCsrfToken(18001);
    expect(token).toBe("token-abc-123");
    expect(mockCookiesGet).toHaveBeenCalledWith({
      url: "http://localhost:18001",
      name: "csrf_token",
    });
  });

  it("cookie jar 为空时返回 null", async () => {
    mockCookiesGet.mockResolvedValue([]);
    expect(await readGatewayCsrfToken(18001)).toBeNull();
  });

  it("cookie value 为空字符串时返回 null（防注入空 header）", async () => {
    mockCookiesGet.mockResolvedValue([{ name: "csrf_token", value: "" }]);
    expect(await readGatewayCsrfToken(18001)).toBeNull();
  });

  it("cookies.get 抛异常时不传播，返回 null", async () => {
    mockCookiesGet.mockRejectedValue(new Error("session 不可用"));
    expect(await readGatewayCsrfToken(18001)).toBeNull();
  });

  it("不同 gatewayPort 生成对应 url", async () => {
    mockCookiesGet.mockResolvedValue([]);
    await readGatewayCsrfToken(9999);
    expect(mockCookiesGet).toHaveBeenCalledWith({
      url: "http://localhost:9999",
      name: "csrf_token",
    });
  });
});

describe("ensureCsrfHeader", () => {
  beforeEach(() => {
    mockCookiesGet.mockReset();
  });

  it("无 header 时从 cookie jar 读取并注入 X-CSRF-Token", async () => {
    mockCookiesGet.mockResolvedValue([{ name: "csrf_token", value: "csrf-value-xyz" }]);
    const headers = new Headers();
    await ensureCsrfHeader(headers, 18001);
    expect(headers.get("x-csrf-token")).toBe("csrf-value-xyz");
  });

  it("已有 X-CSRF-Token 时不覆盖且不查 cookie jar（尊重渲染进程显式设置）", async () => {
    mockCookiesGet.mockResolvedValue([{ name: "csrf_token", value: "should-not-be-used" }]);
    const headers = new Headers({ "x-csrf-token": "existing" });
    await ensureCsrfHeader(headers, 18001);
    expect(headers.get("x-csrf-token")).toBe("existing");
    expect(mockCookiesGet).not.toHaveBeenCalled();
  });

  it("cookie jar 无 csrf_token 时不注入 header（gateway 会以 403 拒绝）", async () => {
    mockCookiesGet.mockResolvedValue([]);
    const headers = new Headers();
    await ensureCsrfHeader(headers, 18001);
    expect(headers.has("x-csrf-token")).toBe(false);
  });

  it("cookie 读取异常时不抛错且不注入 header", async () => {
    mockCookiesGet.mockRejectedValue(new Error("boom"));
    const headers = new Headers();
    await expect(ensureCsrfHeader(headers, 18001)).resolves.toBeUndefined();
    expect(headers.has("x-csrf-token")).toBe(false);
  });
});
