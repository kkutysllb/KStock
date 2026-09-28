/**
 * 麒麟 runtime 闭包 ABI 冒烟（Electron 内置 Node 直跑）。
 *
 * 用法：ELECTRON_RUN_AS_NODE=1 <electron> smoke-runtime-closure.cjs <闭包目录>
 *
 * 验证三层：
 *   A. 闭包入口 runtime-bootstrap.mjs --help 可用（runCli 装配无缺件）
 *      —— 由 build-runtime-bundle.sh 单独调用，本脚本只管 B/C。
 *   B. 原生模块按 N-API/ABI 三态判定：
 *      absent   = 闭包本就不含（非本平台 optional dep）→ 跳过
 *      loaded   = 加载成功 → 打印版本
 *      ABI-FAIL = dlopen/ABI 错误 → 硬失败（需按 Electron ABI 重编）
 *   C. node:sqlite 内置模块可用（量化存储插件依赖，Node ≥22.5）。
 *
 * 注意：本文件以 CJS 运行，require 的解析基准是闭包目录
 * （createRequire(closure/package.json)），因此能命中闭包自带的
 * node_modules，而非构建机的全局/工作区模块。
 */
const closureDir = process.argv[2];
if (!closureDir) {
  console.error("usage: smoke-runtime-closure.cjs <closure-dir>");
  process.exit(2);
}

const { createRequire } = require("node:module");
const req = createRequire(require("node:path").join(closureDir, "package.json"));

let failed = false;

/** [模块名, 是否硬必需（absent 也算失败）]
 *  sharp/node-pty 是引擎运行路径上的原生依赖，必须可加载；
 *  fsevents/bufferutil/utf-8-validate 只是可选加速件，闭包未含属正常
 *  （实测本闭包即未含 fsevents——引擎文件监视不走 chokidar/fsevents）。 */
const NATIVE_MODULES = [
  ["sharp", true],
  ["node-pty", true],
  ["fsevents", false],
  ["bufferutil", false],
  ["utf-8-validate", false],
];

for (const [name, required] of NATIVE_MODULES) {
  try {
    const mod = req(name);
    const version = mod?.default?.VERSION ?? mod?.VERSION ?? "unknown";
    console.log(`  OK      ${name}@${version}`);
  } catch (err) {
    const code = err?.code ?? "";
    if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
      console.log(`  ${required ? "FAIL" : "SKIP"}    ${name}（闭包未含${required ? "，但被标记为必需" : ""}）`);
      if (required) failed = true;
      continue;
    }
    console.error(`  ABI-FAIL ${name}: ${err.message}`);
    failed = true;
  }
}

try {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec("create table t(x)");
  db.close();
  console.log("  OK      node:sqlite（内置）");
} catch (err) {
  console.error(`  ABI-FAIL node:sqlite: ${err.message}`);
  failed = true;
}

process.exit(failed ? 1 : 0);
