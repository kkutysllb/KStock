#!/usr/bin/env node
// KStock 开发日志 wrapper：把子进程的 stdout/stderr tee 到终端 + 日志文件。
//
// 用法：
//   node scripts/run_with_log.mjs <log-name> -- <command...>
//
// 示例：
//   node scripts/run_with_log.mjs frontend -- pnpm -C apps/desktop dev
//   node scripts/run_with_log.mjs desktop  -- pnpm -C apps/desktop tauri:dev
//
// 行为：
// - 启动时清空（truncate）logs/<log-name>.log，保证覆写语义（本次运行从头写入）
// - 子进程 stdout/stderr 同时写到终端和日志文件（tee 效果）
// - 子进程退出码透传给父进程
// - Windows 下用 shell 解析 pnpm 等命令
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const LOGS_DIR = resolve(REPO_ROOT, "logs");

const sepIdx = process.argv.indexOf("--");

if (sepIdx === -1 || !process.argv[2]) {
  process.stderr.write(
    "用法: node scripts/run_with_log.mjs <log-name> -- <command...>\n"
  );
  process.exit(2);
}

const logName = process.argv[2];
const cmd = process.argv.slice(sepIdx + 1);

if (cmd.length === 0) {
  process.stderr.write("错误: 缺少要执行的命令\n");
  process.exit(2);
}

// 清空（truncate）日志文件，确保本次运行从头写入
mkdirSync(LOGS_DIR, { recursive: true });
const logPath = resolve(LOGS_DIR, `${logName}.log`);
const fd = openSync(logPath, "w");
process.on("exit", () => closeSync(fd));

// 标记分隔，便于查看本次启动的日志起点
writeSync(
  fd,
  `=== ${logName} dev log started at ${new Date().toISOString()} ===\n`
);

// Windows 下需要 shell 解析 pnpm 等命令
const child = spawn(cmd[0], cmd.slice(1), {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
  env: process.env,
});

const teeOut = (data) => {
  process.stdout.write(data);
  writeSync(fd, data);
};
const teeErr = (data) => {
  process.stderr.write(data);
  writeSync(fd, data);
};

child.stdout.on("data", teeOut);
child.stderr.on("data", teeErr);

child.on("error", (err) => {
  teeErr(`spawn error: ${err.message}\n`);
  process.exit(1);
});

child.on("close", (code) => process.exit(code ?? 0));
