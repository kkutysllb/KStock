/**
 * 跨平台命令启动器：剔除 ELECTRON_RUN_AS_NODE 后转发执行。
 *
 * 为什么需要：dev/build 脚本原用 `env -u ELECTRON_RUN_AS_NODE electron .`
 * （Unix env 的 -u 取消变量）——Windows 没有 env，win-node-env 会把整串
 * 拼成 `ENV-u` 直接报「不是内部或外部命令」。ELECTRON_RUN_AS_NODE 若从
 * 环境泄漏进来，electron 二进制会以纯 Node 模式启动（无窗口），必须摘除。
 *
 * 用法：node scripts/run.mjs <bin> [args...]
 * （bin 走 node_modules/.bin 解析；Windows 下 .cmd shim 需 shell 解析）
 */

import { spawn } from "node:child_process";

const [bin, ...args] = process.argv.slice(2);
if (bin === undefined) {
  console.error("用法: node scripts/run.mjs <bin> [args...]");
  process.exit(2);
}

delete process.env.ELECTRON_RUN_AS_NODE;

// Windows 的 npm bin 是 .cmd shim，spawn 不经 shell 无法执行；
// 参数均为静态字面量（"." / "--publish never"），无注入面。
const child = spawn(bin, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (err) => {
  console.error(`启动 ${bin} 失败: ${err.message}`);
  process.exit(1);
});
child.on("close", (code) => {
  process.exit(code ?? 0);
});
