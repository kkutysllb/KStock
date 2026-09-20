/**
 * 中文化系统菜单 + 托盘（2.0：导航归引擎 UI 侧栏，壳菜单只剩
 * 应用级动作——数据目录 / 重启引擎 / 检查更新 / 视图 / 关于）。
 */

import { app, BrowserWindow, Menu, MenuItemConstructorOptions, nativeImage, shell, Tray } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { appDataDirectory, EngineProcess } from "./engine";
import { adjustZoom, loadInMainWindow, resetZoom } from "./window";
import { checkForUpdatesInteractive } from "./updater";
import { logMain } from "./logger";

let tray: Tray | null = null;

const PROJECT_HOME = "https://github.com/kkutysllb/KStock";
const PROJECT_ISSUES = "https://github.com/kkutysllb/KStock/issues";

function isDev(): boolean {
  return !app.isPackaged;
}

/** 「重启引擎」：整树终止后重新拉起，并让主窗口带新 token 重载。 */
async function restartEngine(engine: EngineProcess): Promise<void> {
  try {
    const url = await engine.restart();
    loadInMainWindow(url);
  } catch (err) {
    logMain(`重启引擎失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** 构建中文化的系统菜单（macOS 菜单栏；engine 供「重启引擎」用）。 */
export function buildAppMenu(engine: EngineProcess): Menu {
  const isDarwin = process.platform === "darwin";

  const appMenu: MenuItemConstructorOptions = {
    label: "KStock",
    submenu: [
      { role: "about", label: "关于 KStock" },
      { type: "separator" },
      {
        label: "检查更新…",
        accelerator: "CmdOrCtrl+Shift+U",
        click: () => void checkForUpdatesInteractive(),
      },
      { type: "separator" },
      { role: "hide", label: "隐藏 KStock" },
      { role: "hideOthers", label: "隐藏其他" },
      { role: "unhide", label: "全部显示" },
      { type: "separator" },
      { role: "quit", label: "退出 KStock" },
    ],
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: "文件",
    submenu: [
      {
        label: "重启引擎",
        accelerator: "CmdOrCtrl+Shift+E",
        click: () => void restartEngine(engine),
      },
      { type: "separator" },
      {
        label: "打开应用数据目录",
        click: () => openPath(appDataDirectory()),
      },
      {
        label: "打开日志目录",
        click: () => openPath(join(appDataDirectory(), "logs")),
      },
      { type: "separator" },
      { role: "close", label: "关闭窗口" },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "编辑",
    submenu: [
      { role: "undo", label: "撤销" },
      { role: "redo", label: "重做" },
      { type: "separator" },
      { role: "cut", label: "剪切" },
      { role: "copy", label: "复制" },
      { role: "paste", label: "粘贴" },
      { role: "selectAll", label: "全选" },
    ],
  };

  const devSubmenu: MenuItemConstructorOptions[] = isDev()
    ? [{ role: "toggleDevTools", label: "开发者工具" }]
    : [];

  const viewMenu: MenuItemConstructorOptions = {
    label: "视图",
    submenu: [
      {
        label: "重新加载",
        accelerator: "CmdOrCtrl+R",
        click: () => activeWindow()?.webContents.reload(),
      },
      {
        label: "强制重新加载",
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => activeWindow()?.webContents.reloadIgnoringCache(),
      },
      ...devSubmenu,
      { type: "separator" },
      { label: "放大", accelerator: "CmdOrCtrl+=", click: () => adjustZoom(0.1) },
      { label: "缩小", accelerator: "CmdOrCtrl+-", click: () => adjustZoom(-0.1) },
      { label: "实际大小", accelerator: "CmdOrCtrl+0", click: () => resetZoom() },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: "窗口",
    submenu: [
      { role: "minimize", label: "最小化" },
      { role: "zoom", label: "最大化" },
      ...(isDarwin ? [] : [{ role: "close" as const }]),
      { type: "separator" },
      { role: "front", label: "前置全部窗口" },
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: "帮助",
    submenu: [
      { label: "检查更新…", click: () => void checkForUpdatesInteractive() },
      { type: "separator" },
      { label: "打开应用数据目录", click: () => openPath(appDataDirectory()) },
      { label: "打开日志目录", click: () => openPath(join(appDataDirectory(), "logs")) },
      { type: "separator" },
      { label: "打开项目主页", click: () => void shell.openExternal(PROJECT_HOME) },
      { label: "问题反馈", click: () => void shell.openExternal(PROJECT_ISSUES) },
    ],
  };

  const template: MenuItemConstructorOptions[] = isDarwin
    ? [appMenu, fileMenu, editMenu, viewMenu, windowMenu, helpMenu]
    : [fileMenu, editMenu, viewMenu, helpMenu];

  return Menu.buildFromTemplate(template);
}

/** 托盘图标与菜单。 */
export function buildTray(engine: EngineProcess): void {
  const icon = createTrayImage();
  if (!icon || icon.isEmpty()) {
    logMain(`托盘未创建：iconFound=${Boolean(icon)} isEmpty=${icon?.isEmpty() ?? false}`);
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip("KStock 量化助手");
  // 无框平台没有应用菜单，托盘菜单承载全部菜单功能。
  // macOS 菜单栏已有完整菜单，托盘保持精简。
  const menu = process.platform === "darwin" ? buildDarwinTrayMenu(engine) : buildFullTrayMenu(engine);
  tray.setContextMenu(Menu.buildFromTemplate(menu));

  // Windows 习惯：左键点托盘图标切换主窗口显隐（右键才弹菜单）。
  if (process.platform === "win32") {
    tray.on("click", () => toggleMainWindow());
  }
  logMain("托盘已创建");
}

/** macOS 托盘菜单：菜单栏已覆盖全部功能，只留窗口开关、更新与退出。 */
function buildDarwinTrayMenu(engine: EngineProcess): MenuItemConstructorOptions[] {
  return [
    { label: "显示窗口", click: () => showMainWindow() },
    { label: "隐藏窗口", click: () => activeWindow()?.hide() },
    { type: "separator" },
    { label: "检查更新…", click: () => void checkForUpdatesInteractive() },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ];
}

/** Windows/Linux 托盘菜单：无菜单栏平台的全部入口。 */
function buildFullTrayMenu(engine: EngineProcess): MenuItemConstructorOptions[] {
  return [
    { label: "显示窗口", click: () => showMainWindow() },
    { label: "隐藏窗口", click: () => activeWindow()?.hide() },
    // 菜单模板静态构建，标签不随状态刷新，点击时按当前状态切换。
    {
      label: "最大化 / 还原",
      click: () => {
        const win = activeWindow();
        if (!win) return;
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      },
    },
    { type: "separator" },
    { label: "重启引擎", click: () => void restartEngine(engine) },
    { label: "检查更新…", click: () => void checkForUpdatesInteractive() },
    { label: "重新加载", click: () => activeWindow()?.webContents.reload() },
    { type: "separator" },
    { label: "打开应用数据目录", click: () => openPath(appDataDirectory()) },
    { label: "打开日志目录", click: () => openPath(join(appDataDirectory(), "logs")) },
    { type: "separator" },
    { label: "项目主页", click: () => void shell.openExternal(PROJECT_HOME) },
    { label: "问题反馈", click: () => void shell.openExternal(PROJECT_ISSUES) },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ];
}

/**
 * 构建托盘图标 ``nativeImage``。
 *
 * macOS 菜单栏必须用**模板图**（纯黑 + alpha）并标记 template image，系统才能自动
 * 适配深色/浅色外观；Windows/Linux 用彩色图标。三处与旧实现的差异（图标重构）：
 *
 * 1. macOS 读 `trayTemplate.png`，Electron 自动合并同目录的 `trayTemplate@2x.png`，
 *    因此 Retina 菜单栏拿到的是**原生 32px 素材**；
 * 2. 不再运行时 `resize()`——旧实现把单张 128px 缩到 22pt，二次重采样让笔画发灰；
 * 3. Windows/Linux 读逐档出好的彩色 `tray-32.png`（Tier 2 加重版 K），
 *    不再回落到全出血的应用图标。
 *
 * 资产由 `scripts/build-icons.sh` 生成（设计源在 `docs/design/icon-refresh/`）。
 */
function createTrayImage(): Electron.NativeImage | null {
  const darwin = process.platform === "darwin";
  const candidates = darwin
    ? [join(app.getAppPath(), "build", "trayTemplate.png")]
    : [
        join(app.getAppPath(), "build", "tray-32.png"),
        join(app.getAppPath(), "build", "tray-16.png"),
        join(app.getAppPath(), "build", "tray.ico"),
      ];
  const iconPath = candidates.find((p) => existsSync(p));
  if (!iconPath) {
    const found = candidates.filter((p) => existsSync(p));
    logMain(
      `createTrayImage 无可用图标：appPath=${app.getAppPath()} ` +
        `candidates=${JSON.stringify(candidates)} found=${JSON.stringify(found)}`,
    );
    return null;
  }

  // 不做 resize：尺寸已在资产生成阶段按档出好（macOS 16/@2x，Win/Linux 32/16）。
  const icon = nativeImage.createFromPath(iconPath);
  if (darwin) icon.setTemplateImage(true);
  logMain(
    `托盘图标加载：${iconPath} size=${JSON.stringify(icon.getSize())} isEmpty=${icon.isEmpty()}`,
  );
  return icon;
}

function activeWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find((w) => w.isVisible()) ??
    BrowserWindow.getAllWindows()[0];
}

function showMainWindow(): void {
  const win = activeWindow();
  if (win) {
    win.show();
    win.focus();
    if (win.isMinimized()) win.restore();
  }
}

/** Windows 托盘左键：可见则隐藏，否则显示（含从最小化还原）。 */
function toggleMainWindow(): void {
  const win = activeWindow();
  if (!win) return;
  if (win.isVisible() && !win.isMinimized()) {
    win.hide();
  } else {
    win.show();
    win.focus();
    if (win.isMinimized()) win.restore();
  }
}

function openPath(target: string): void {
  void shell.openPath(target);
}
