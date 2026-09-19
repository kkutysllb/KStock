/**
 * KStock Electron 主进程入口（2.0）。
 *
 * 职责只剩进程托管与系统集成的最小集：单实例锁 → 拉起内置引擎
 * （kstock profile，stdout 捕获启动 token）→ 主窗口加载引擎地址 →
 * 菜单/托盘 → 自动更新。退出/更新安装前联动终止引擎进程树。
 * 业务面（对话/四库/报告/公共页）全部在引擎内，壳无协议、无代理、无 IPC 桥。
 */

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
} from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ENGINE_PORT, EngineProcess } from "./lib/engine";
import { buildAppMenu, buildTray } from "./lib/menu";
import { initUpdater, setEngineShutdownHandler } from "./lib/updater";
import {
  createMainWindow,
  getMainWindow,
} from "./lib/window";
import { logMain } from "./lib/logger";

// Windows GPU 硬件加速在部分显卡驱动 / 远程桌面（RDP）/ 虚拟机下会导致
// 渲染黑屏。金融桌面应用无 3D / 视频负载，禁用 GPU 加速改用软件渲染兜底。
// macOS / Linux 不受此问题影响，保留硬件加速。
if (process.platform === "win32") {
  app.disableHardwareAcceleration();
}

logMain(`启动：platform=${process.platform} version=${app.getVersion()} packaged=${app.isPackaged}`);

// 单实例锁：避免多开各自拉起引擎抢 18001 端口。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    logMain("app ready：初始化更新器/图标/引擎…");
    initUpdater();

    // macOS dev 模式下 Dock 默认显示 Electron 图标；手动设置应用图标
    // 让开发态与打包态视觉一致。打包态由 electron-builder 注入 .icns。
    if (process.platform === "darwin" && !app.isPackaged) {
      setDockIcon();
    }

    // 注册安装前引擎终止回调：更新安装时先同步 kill 引擎，
    // 避免 .exe 占用 / 端口冲突导致安装失败。
    setEngineShutdownHandler(() => engine.killAndWait());

    // 拉起内置引擎并取引导地址（带启动 token 的工作台 URL；
    // 端口被外部实例占用时回落到 /workspace，由引擎决定登录跳转）。
    let entryUrl: string;
    try {
      entryUrl = await engine.ensureStarted();
      logMain(`engine: 引导地址 ${entryUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logMain(`引擎启动失败: ${message}`);
      // 可视化报错：端口被旧版 KStock 占用等场景若只静默加载，窗口里就是
      // 旧进程的错误文本，用户无从知道原因。弹窗说明后仍建窗口兜底，
      // 用户可经托盘「重启引擎」重试。
      dialog.showErrorBox("KStock 引擎启动失败", message);
      entryUrl = `http://127.0.0.1:${ENGINE_PORT}/workspace`;
    }

    // macOS 保留原生菜单栏；Windows/Linux 无菜单栏，功能在托盘。
    Menu.setApplicationMenu(process.platform === "darwin" ? buildAppMenu(engine) : null);
    logMain("ready：创建主窗口");
    createMainWindow(entryUrl);
    buildTray(engine);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow(entryUrl);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // 应用退出时联动终止内置引擎进程树。
  // 仅发 SIGTERM 不够：引擎 detached（独立进程组），主进程退出后成为
  // 孤儿进程继续占用 18001 端口。因此退出时 preventDefault 一次：先销毁
  // 窗口断开连接，再同步等待 killAndWait（SIGTERM + 5s 超时 SIGKILL 兜底）。
  let engineShutdownDone = false;
  app.on("before-quit", (event) => {
    if (engineShutdownDone) return;
    event.preventDefault();
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
    engine
      .killAndWait(5000)
      .catch(() => {})
      .finally(() => {
        engineShutdownDone = true;
        app.quit();
      });
  });
}

const engine = new EngineProcess();

/**
 * macOS dev 模式下设置 Dock 图标。
 *
 * 打包后的 .app 由 electron-builder 注入 icon.icns 作为 Dock 图标；
 * 开发态走 ``electron .`` 时 Dock 仍显示 Electron 默认图标，需手动注入。
 */
function setDockIcon(): void {
  const candidates = [
    join(app.getAppPath(), "build", "icons", "128x128@2x.png"),
    join(app.getAppPath(), "build", "icons", "128x128.png"),
  ];
  const iconPath = candidates.find((p) => existsSync(p));
  if (!iconPath) return;
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) app.dock?.setIcon(icon);
}
