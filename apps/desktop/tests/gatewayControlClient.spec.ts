import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("gatewayControlClient", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  it("在 Tauri 宿主中通过 gateway_restart command 重启 gateway", async () => {
    invokeMock.mockResolvedValue("gateway 已启动");
    const { restartGateway } = await import("../src/lib/gatewayControlClient");

    await expect(restartGateway()).resolves.toEqual({
      message: "gateway 已启动",
      supervised: false,
    });
    expect(invokeMock).toHaveBeenCalledWith("gateway_restart");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("保留 Rust command 返回的具体错误", async () => {
    invokeMock.mockRejectedValue("gateway 启动超时；请查看日志");
    const { restartGateway } = await import("../src/lib/gatewayControlClient");

    await expect(restartGateway()).rejects.toEqual({
      message: "gateway 启动超时；请查看日志",
      status: 0,
    });
  });
});
