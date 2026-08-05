import { beforeEach, describe, expect, it, vi } from "vitest";

const restartGatewayMock = vi.fn();

describe("gatewayControlClient", () => {
  beforeEach(() => {
    restartGatewayMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    // 模拟 Electron 桌面端宿主经 contextBridge 注入的 window.kstockDesktop。
    Object.defineProperty(window, "kstockDesktop", {
      configurable: true,
      value: { restartGateway: restartGatewayMock },
    });
  });

  it("在桌面端宿主中通过桥接 API 重启 gateway", async () => {
    restartGatewayMock.mockResolvedValue("gateway 已启动");
    const { restartGateway } = await import("../src/lib/gatewayControlClient");

    await expect(restartGateway()).resolves.toEqual({
      message: "gateway 已启动",
      supervised: false,
    });
    expect(restartGatewayMock).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("保留桥接 API 返回的具体错误", async () => {
    restartGatewayMock.mockRejectedValue("gateway 启动超时；请查看日志");
    const { restartGateway } = await import("../src/lib/gatewayControlClient");

    await expect(restartGateway()).rejects.toEqual({
      message: "gateway 启动超时；请查看日志",
      status: 0,
    });
  });

  it("无桌面端宿主桥时抛友好错误", async () => {
    // 清除桥接 API，模拟浏览器预览环境。
    Object.defineProperty(window, "kstockDesktop", {
      configurable: true,
      value: undefined,
    });
    const { restartGateway } = await import("../src/lib/gatewayControlClient");

    await expect(restartGateway()).rejects.toEqual({
      message: "当前运行环境没有桌面端宿主，请手动重启 gateway",
      status: 0,
    });
  });
});
