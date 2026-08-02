import { describe, expect, it } from "vitest";
import { mergeDeliveryFiles, normalizeVirtualPath, type DeliveryFile } from "../src/lib/deliveryFiles";
import type { WorkspaceChangeFile } from "../src/lib/turnsClient";

describe("normalizeVirtualPath", () => {
  it("将 /mnt/user-data/outputs/ 真实路径归一化为 /outputs/ 虚拟路径", () => {
    expect(normalizeVirtualPath("/mnt/user-data/outputs/report.html")).toBe("/outputs/report.html");
    expect(normalizeVirtualPath("/outputs/report.html")).toBe("/outputs/report.html");
  });

  it("非 outputs 路径保持不变", () => {
    expect(normalizeVirtualPath("/outputs/scripts/run.py")).toBe("/outputs/scripts/run.py");
    expect(normalizeVirtualPath("notes.md")).toBe("notes.md");
  });
});

describe("mergeDeliveryFiles", () => {
  const threadId = "thread-1";

  function wsFile(path: string, extra: Partial<WorkspaceChangeFile> = {}): WorkspaceChangeFile {
    return { path, root: "outputs", status: "created", size_after: 123, ...extra } as WorkspaceChangeFile;
  }

  it("同一文件同时出现在虚拟路径与真实路径时只保留一条（回归：交付面板重复）", () => {
    const artifacts = [
      "/outputs/report.html",
      "/mnt/user-data/outputs/report.html",
      "/outputs/extra.md",
    ];
    const files = mergeDeliveryFiles(threadId, artifacts, []);
    expect(files).toHaveLength(2);
    const keys = files.map((f) => f.key).sort();
    expect(keys).toEqual(["/outputs/extra.md", "/outputs/report.html"]);
    const report = files.find((f) => f.key === "/outputs/report.html");
    expect(report?.url).toContain("/api/threads/thread-1/artifacts/outputs/report.html");
  });

  it("workspace 变更补充 size/status，且与 artifacts 同路径时合并为一条", () => {
    const artifacts = ["/mnt/user-data/outputs/report.html"];
    const workspace = [
      wsFile("/outputs/report.html", { status: "modified", size_after: 999 }),
      wsFile("/outputs/report.md"),
    ];
    const files = mergeDeliveryFiles(threadId, artifacts, workspace);
    expect(files).toHaveLength(2);
    const report = files.find((f) => f.key === "/outputs/report.html");
    expect(report).toMatchObject({ status: "modified", size: 999 });
    expect(report?.url).toBeTruthy();
    const md = files.find((f) => f.key === "/outputs/report.md");
    expect(md?.size).toBe(123);
  });

  it("删除/非 outputs 根的 workspace 变更不进入交付列表", () => {
    const workspace = [
      wsFile("/outputs/removed.html", { status: "deleted" }),
      wsFile("/tmp/outside.txt", { root: "uploads" }),
    ];
    expect(mergeDeliveryFiles(threadId, [], workspace)).toHaveLength(0);
  });

  it("artifact_url 显式 URL 优先于虚拟路径派生 URL", () => {
    const artifacts = [{ path: "/outputs/report.html", artifact_url: "http://cdn.example.com/report.html" }];
    const files = mergeDeliveryFiles(threadId, artifacts, []);
    expect(files[0]?.url).toBe("http://cdn.example.com/report.html");
  });
});
