// artifactLinks 模块测试：交付文件链接识别 + Markdown 链接点击行为。
// 背景：正文里的交付文件链接此前统一 `target="_blank"`，Electron 主进程
// setWindowOpenHandler 把 http(s) 外链丢给系统浏览器 → gateway 根路径在
// 浏览器重定向到产品首页。修复后 gateway 可预览文件链接应走应用内预览回调。

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArtifactLinkContext, artifactPreviewNameFromHref } from "../src/lib/artifactLinks";
import { Markdown } from "../src/lib/markdown";

vi.mock("../src/lib/gatewayUrl", () => ({
  GATEWAY_URL: "http://localhost:18001",
  readCsrfToken: () => null,
}));

describe("artifactPreviewNameFromHref", () => {
  it("识别 gateway 绝对链接的交付文件并返回文件名", () => {
    expect(artifactPreviewNameFromHref("http://localhost:18001/outputs/report.html")).toBe("report.html");
    expect(artifactPreviewNameFromHref("http://localhost:18001/mnt/user-data/outputs/周报.md")).toBe("周报.md");
  });

  it("识别相对路径与带 query/hash 的链接", () => {
    expect(artifactPreviewNameFromHref("/outputs/analyze.json")).toBe("analyze.json");
    expect(artifactPreviewNameFromHref("http://localhost:18001/outputs/a.html?v=1")).toBe("a.html");
    expect(artifactPreviewNameFromHref("http://localhost:18001/outputs/a.txt#L1")).toBe("a.txt");
  });

  it("解码 URL 编码的文件名", () => {
    expect(artifactPreviewNameFromHref("http://localhost:18001/outputs/%E5%B0%BD%E8%B0%83.html")).toBe("尽调.html");
  });

  it("跨域外链不拦截（保持系统浏览器打开）", () => {
    expect(artifactPreviewNameFromHref("https://example.com/report.html")).toBeNull();
    expect(artifactPreviewNameFromHref("https://xueqiu.com/s/SH600111")).toBeNull();
  });

  it("gateway 域内不可预览的扩展名不拦截", () => {
    expect(artifactPreviewNameFromHref("http://localhost:18001/outputs/chart.png")).toBeNull();
    expect(artifactPreviewNameFromHref("http://localhost:18001/outputs/data.pdf")).toBeNull();
    expect(artifactPreviewNameFromHref("http://localhost:18001/")).toBeNull();
  });
});

describe("Markdown 交付文件链接点击", () => {
  const renderLink = (markdown: string, handler: ((href: string, name: string) => void) | null) =>
    render(
      <ArtifactLinkContext.Provider value={handler}>
        <Markdown>{markdown}</Markdown>
      </ArtifactLinkContext.Provider>
    );

  it("gateway 文件链接点击触发应用内预览回调且不导航", () => {
    const handler = vi.fn();
    renderLink("[📄 尽调报告](http://localhost:18001/outputs/%E5%B0%BD%E8%B0%83.html)", handler);
    fireEvent.click(screen.getByRole("link", { name: "📄 尽调报告" }));
    expect(handler).toHaveBeenCalledWith(
      "http://localhost:18001/outputs/%E5%B0%BD%E8%B0%83.html",
      "尽调.html"
    );
  });

  it("外链与不可预览链接不触发回调", () => {
    const handler = vi.fn();
    renderLink(
      "[外部报告](https://example.com/report.html) [图表](http://localhost:18001/outputs/a.png) [首页](http://localhost:18001/)",
      handler
    );
    fireEvent.click(screen.getByRole("link", { name: "外部报告" }));
    fireEvent.click(screen.getByRole("link", { name: "图表" }));
    fireEvent.click(screen.getByRole("link", { name: "首页" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("无 Provider（回调缺失）时点击回退默认 _blank 行为", () => {
    renderLink("[报告](http://localhost:18001/outputs/report.html)", null);
    const link = screen.getByRole("link", { name: "报告" }) as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });
});
