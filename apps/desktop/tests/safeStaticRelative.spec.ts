import { describe, expect, it } from "vitest";
import { win32 } from "node:path";
import { safeStaticRelative } from "../electron/lib/protocol";

/**
 * 路径穿越检查的跨平台契约测试。
 *
 * 核心场景：Windows 黑屏根因是 ``node:path.normalize`` 在 Windows 上把 ``/``
 * 转成 ``\\``，导致 ``/assets/index.js`` → ``assets\\index.js`` → 含 ``\\``
 * → 被 403 拒绝。修复后统一用 ``posix.normalize``，跨平台行为一致。
 *
 * 这些测试在所有平台运行，验证修复后的 ``safeStaticRelative`` 对正常静态资源
 * 请求（含子目录）返回非 null，对路径穿越返回 null。
 */
describe("safeStaticRelative", () => {
  it("根路径返回 '.'（index.html 回退由 serveStatic 处理）", () => {
    expect(safeStaticRelative("/")).toBe(".");
    expect(safeStaticRelative("")).toBe(".");
  });

  it("静态资源根级文件正常通过", () => {
    expect(safeStaticRelative("/favicon.png")).toBe("favicon.png");
    expect(safeStaticRelative("/index.html")).toBe("index.html");
  });

  it("assets 子目录下的 JS/CSS 模块正常通过（Windows 黑屏根因场景）", () => {
    expect(safeStaticRelative("/assets/index-BuNPvN9c.js")).toBe(
      "assets/index-BuNPvN9c.js",
    );
    expect(safeStaticRelative("/assets/index-9eu36Az9.css")).toBe(
      "assets/index-9eu36Az9.css",
    );
    expect(safeStaticRelative("/assets/react-vendor-CAFUplbN.js")).toBe(
      "assets/react-vendor-CAFUplbN.js",
    );
  });

  it("多层子目录正常通过", () => {
    expect(safeStaticRelative("/assets/icons/128x128.png")).toBe(
      "assets/icons/128x128.png",
    );
  });

  it("POSIX 路径穿越被拒", () => {
    expect(safeStaticRelative("/../../etc/passwd")).toBeNull();
    expect(safeStaticRelative("/../../../secret")).toBeNull();
  });

  it("反斜杠路径穿越被拒（Windows 特有攻击向量）", () => {
    // protocol.ts 第 70 行已 decodeURIComponent，safeStaticRelative 收到的是已解码路径。
    expect(safeStaticRelative("/..\\..\\secret")).toBeNull();
    // URL 编码的反斜杠 %5C 在 protocol.ts 已解码为 \，到达此处必为真实 \。
    expect(safeStaticRelative("/foo\\bar")).toBeNull();
  });

  it("对比例子：修复前用 win32.normalize 会让 /assets/index.js 含反斜杠", () => {
    // 这是回归文档：证明为什么不能用默认的 path.normalize。
    // 在 Windows 上 win32.normalize("assets/index.js") = "assets\\index.js"，
    // 含 \ → 会被误判为穿越 → 403 → JS 全被拒 → Windows 黑屏。
    const winNormalized = win32.normalize("assets/index.js");
    expect(winNormalized).toBe("assets\\index.js");
    expect(winNormalized.includes("\\")).toBe(true);

    // 而修复后 safeStaticRelative（用 posix.normalize）正常通过：
    expect(safeStaticRelative("/assets/index.js")).toBe("assets/index.js");
  });
});
