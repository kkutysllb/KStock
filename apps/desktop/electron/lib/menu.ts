/**
 * 中文化系统菜单 + 托盘（对齐原 ``src-tauri/src/main.rs`` 的 build_app_menu / build_tray）。
 */

import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  nativeImage,
  shell,
  Tray,
} from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { appDataDirectory } from "./gateway";
import { adjustZoom, resetZoom, sendMenuCommand } from "./window";

let tray: Tray | null = null;

const PROJECT_HOME = "https://github.com/kkutysllb/KStock";
const PROJECT_ISSUES = "https://github.com/kkutysllb/KStock/issues";

function isDev(): boolean {
  // vite/electron dev 模式下 MAIN_VITE_*/未打包；app.isPackaged 更可靠。
  return !app.isPackaged;
}

/** 构建中文化的系统菜单（macOS 菜单栏 + Windows/Linux 顶部菜单）。 */
export function buildAppMenu(): Menu {
  const isDarwin = process.platform === "darwin";

  const appMenu: MenuItemConstructorOptions = {
    label: "KStock",
    submenu: [
      { role: "about", label: "关于 KStock" },
      { type: "separator" },
      {
        label: "检查更新…",
        accelerator: "CmdOrCtrl+Shift+U",
        click: () => sendMenuCommand("check-update"),
      },
      {
        label: "偏好设置…",
        accelerator: "CmdOrCtrl+,",
        click: () => sendMenuCommand("open-settings"),
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
        label: "新建任务",
        accelerator: "CmdOrCtrl+N",
        click: () => sendMenuCommand("new-task"),
      },
      {
        label: "打开报告库",
        accelerator: "CmdOrCtrl+Shift+L",
        click: () => sendMenuCommand("open-reports"),
      },
      { type: "separator" },
      {
        label: "打开交付文件目录",
        accelerator: "CmdOrCtrl+Shift+O",
        click: () => openPath(join(appDataDirectory(), "runtime", "qilin", "users")),
      },
      {
        label: "打开应用数据目录",
        click: () => openPath(appDataDirectory()),
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
      { label: "检查更新…", click: () => sendMenuCommand("check-update") },
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
export function buildTray(): void {
  const icon = createTrayImage();
  if (!icon || icon.isEmpty()) return;

  tray = new Tray(icon);
  tray.setToolTip("KStock 量化助手");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示窗口", click: () => showMainWindow() },
      { label: "隐藏窗口", click: () => activeWindow()?.hide() },
      { type: "separator" },
      { label: "检查更新…", click: () => sendMenuCommand("check-update") },
      { type: "separator" },
      { label: "退出", click: () => app.quit() },
    ]),
  );
}

/**
 * 构建托盘图标 ``nativeImage``。
 *
 * macOS 菜单栏高度约 22pt，必须用小尺寸图标并标记为 template image，
 * 系统才能自动适配深色/浅色外观。直接用 128×128 的原图会导致缩放后
 * 变成模糊黑色方块。
 *
 * Windows/Linux 任务栏托盘用彩色 ``icon.png`` 缩放到 32×32。
 */
function createTrayImage(): Electron.NativeImage | null {
  const darwin = process.platform === "darwin";
  const candidates = darwin
    ? [
        join(app.getAppPath(), "build", "tray.png"),
        join(app.getAppPath(), "build", "icons", "32x32.png"),
        join(app.getAppPath(), "build", "icon.png"),
      ]
    : [
        join(app.getAppPath(), "build", "icons", "32x32.png"),
        join(app.getAppPath(), "build", "tray.png"),
        join(app.getAppPath(), "build", "icon.png"),
      ];
  const iconPath = candidates.find((p) => existsSync(p));
  if (!iconPath) return null;

  const size = darwin ? { width: 22, height: 22 } : { width: 32, height: 32 };
  const icon = nativeImage.createFromPath(iconPath).resize(size);
  // macOS：tray.png 是黑色透明线条（设计为 template image），标记后
  // 系统自动适配深色/浅色菜单栏。
  if (darwin) icon.setTemplateImage(true);
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

function openPath(target: string): void {
  void shell.openPath(target);
}
