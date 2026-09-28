#!/usr/bin/env node
/**
 * 清理「空白无标题的用户会话」（升级配套整理，QiLin 3.0.5 一次性）。
 *
 * 背景：3.0.5 升级后，冷行会话的 sessionListMetadata 投影缓存没有随 v3→v4
 * 迁移重建，host 侧回退判定 `blank: metadata?.blank ?? session.seq === 0`
 * 把「创建后从未发过消息」的老空白会话当成了普通会话——侧栏工作区下多出
 * 与工作区同名的行（无标题会话回落 cwd 基名展示）。这些会话零内容
 * （仅初始化事件、0 条用户消息、无标题），清除即可；未来新产生的空白
 * 会话由 3.0.5 运行时的投影缓存正常隐藏，不受影响。
 *
 * 行为：
 *   1. 扫描 $QILIN_HOME/sessions/<workspace>/ 下 origin≠subagent 且 depth=0 的会话；
 *   2. 判定空白：无 user/message、无 session/title、无 turn/start 事件；
 *   3. 备份会话目录与 storages/workspace.json 到
 *      $QILIN_HOME/backup-purged-blank-sessions-<stamp>/；
 *   4. 从 workspace.json 各 workspace.sessionIds 移除引用，删除会话目录。
 *
 * 用法：node scripts/local/purge-blank-sessions.mjs [--apply] [--qilin-home <dir>]
 *   默认 dry-run（只打印将做的改动）；--apply 才落盘。
 *   必须在 KStock 桌面端**退出后**执行——活跃引擎持有 workspace.json，
 *   文件级修改会被内存回写复活。
 */

import { zstdDecompressSync } from "node:zlib";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const homeIdx = args.indexOf("--qilin-home");
const qilinHome = homeIdx >= 0 ? args[homeIdx + 1] : join(homedir(), ".kstock/qilin-home");
const sessionsRoot = join(qilinHome, "sessions");
const registryPath = join(qilinHome, "storages/workspace.json");

if (!existsSync(sessionsRoot)) {
  console.error(`!! 会话根不存在：${sessionsRoot}`);
  process.exit(1);
}

/** 多帧 zstd 拼接解码（会话日志按帧追加）。 */
function decodeMultiFrame(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const frames = [];
  let idx = 0;
  while (idx < buf.length - 4) {
    const at = buf.indexOf(MAGIC, idx);
    if (at < 0) break;
    const next = buf.indexOf(MAGIC, at + 4);
    frames.push(buf.subarray(at, next < 0 ? buf.length : next));
    idx = at + 4;
  }
  return frames
    .map((f) => {
      try {
        return zstdDecompressSync(f).toString("utf8");
      } catch {
        return "";
      }
    })
    .join("");
}

/** 判定一个会话目录是否「空白无标题用户会话」。 */
function isBlankUserSession(dir) {
  const log = ["session.v4.jsonl.zstd", "session.v3.jsonl.zstd"]
    .map((name) => join(dir, name))
    .find((path) => existsSync(path));
  if (log === undefined) return { blank: false, reason: "无会话日志" };
  let lines;
  try {
    lines = decodeMultiFrame(readFileSync(log)).split("\n").filter(Boolean);
  } catch {
    return { blank: false, reason: "日志解码失败" };
  }
  if (lines.length === 0) return { blank: false, reason: "空日志" };
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    return { blank: false, reason: "首行非会话头" };
  }
  if (header.origin === "subagent" || (header.delegationDepth ?? 0) > 0) {
    return { blank: false, reason: "子代理会话" };
  }
  let userMessages = 0;
  let titled = false;
  let started = false;
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "user/message") userMessages += 1;
      if (event.type === "session/title" && event.data?.title) titled = true;
      if (event.type === "turn/start") started = true;
    } catch {}
  }
  if (userMessages > 0 || titled || started) {
    return { blank: false, reason: "已有内容（消息/标题/回合）" };
  }
  return { blank: true, reason: `空白（${lines.length} 个初始化事件，preset=${header.agentPreset ?? "-"}）` };
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupRoot = join(qilinHome, `backup-purged-blank-sessions-${stamp}`);
const targets = [];

for (const workspaceDir of readdirSync(sessionsRoot)) {
  const root = join(sessionsRoot, workspaceDir);
  if (!statSync(root).isDirectory()) continue;
  for (const sessionId of readdirSync(root)) {
    const dir = join(root, sessionId);
    if (!statSync(dir).isDirectory()) continue;
    const verdict = isBlankUserSession(dir);
    if (verdict.blank) targets.push({ workspaceDir, sessionId, dir });
  }
}

console.log(`扫描 ${sessionsRoot}`);
console.log(`空白无标题用户会话：${targets.length} 个${targets.length === 0 ? "，无需清理" : ""}`);
for (const target of targets) {
  console.log(`  - ${target.workspaceDir.slice(0, 40)} / ${target.sessionId}`);
}

let registryMutated = false;
const registry = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, "utf8")) : null;
const targetIds = new Set(targets.map((t) => t.sessionId));
const workspaceDirs = readdirSync(sessionsRoot);
const sessionOnDisk = (id) =>
  workspaceDirs.some((wsDir) => existsSync(join(sessionsRoot, wsDir, id)));
for (const [workspaceId, workspace] of Object.entries(registry?.tables?.workspaces ?? {})) {
  const before = workspace.sessionIds ?? [];
  // 目标引用 + 悬挂引用（会话目录已不存在）一并移除。
  const after = before.filter((id) => !targetIds.has(id) && sessionOnDisk(id));
  if (after.length !== before.length) {
    console.log(`  注册表引用移除：workspace ${workspaceId}（${before.length} → ${after.length} 个成员）`);
    workspace.sessionIds = after;
    registryMutated = true;
  }
}

if (!apply) {
  console.log("dry-run 结束（加 --apply 落盘；须先退出 KStock 桌面端）");
  process.exit(0);
}

if (targets.length === 0 && !registryMutated) {
  console.log("无需改动。");
  process.exit(0);
}

mkdirSync(backupRoot, { recursive: true });
if (registryMutated) cpSync(registryPath, join(backupRoot, "workspace.json"));
for (const target of targets) {
  const backupDir = join(backupRoot, target.sessionId);
  cpSync(target.dir, backupDir, { recursive: true });
  rmSync(target.dir, { recursive: true, force: true });
  console.log(`已清除（备份于 ${basename(backupRoot)}）：${target.sessionId}`);
}
if (registryMutated) {
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`workspace.json 引用已更新（原文件备份于 ${basename(backupRoot)}）`);
}
console.log("完成。重启 KStock 后侧栏生效。");
