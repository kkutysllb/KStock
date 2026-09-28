#!/usr/bin/env node
/**
 * 物化麒麟 runtime 闭包（KCoder 模式的 KStock 实现）。
 *
 * 复刻 vendor/qilin/scripts/build-exe-for-python-sdk.ts 的 deployStaging()
 * 三阶段，但**不做** pkg 注入与 SEA 侧车拷贝——产物是 symlink-free 的
 * 平铺 node_modules 闭包，供桌面壳以 Electron 内置 Node
 * （ELECTRON_RUN_AS_NODE=1）直跑：
 *
 *   1. pnpm --filter qilin-python-runtime-closure deploy --legacy --prod
 *      （与上游完全一致的 flags，见上游 deployStaging()）
 *   2. restoreLegacyHoists：legacy hoister 把部分直依赖落在部署源旁边的
 *      node_modules，这里逐个拷回部署目标（dereference，跳过嵌套
 *      node_modules，保证全局只有一份 Cordis 实例）
 *   3. materializeStagedLinks：残余 symlink 换成实体拷贝、删除 .bin
 *   4. 删除 DEPLOY_ONLY_DOCS；写入 .runtime-version 标记
 *
 * 为什么不在单文件 exe 上继续：pkg 产物内嵌 Node24 基座 + 全部 6 平台的
 * 原生 prebuilds（mac 包里背着 linuxmusl/win32 的 libvips 等），262MB 里
 * 死重占大头；且 200+ 嵌套 Mach-O 让 macOS 签名/公证面急剧膨胀。
 * pnpm deploy 按 runner 平台只装当前平台 optional deps，死重天然消失。
 *
 * 用法：node scripts/local/materialize-runtime-closure.mjs <staging 目录>
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const QILIN_ROOT = join(REPO_ROOT, "vendor/qilin");
const QILIN_PNPM = join(REPO_ROOT, "scripts/qilin-pnpm.sh");
const CLOSURE_PKG = "qilin-python-runtime-closure";
/** legacy hoister 的落点（上游 DEPLOY_SOURCE_NODE_MODULES）。 */
const DEPLOY_SOURCE_NODE_MODULES = join(QILIN_ROOT, "python/sdk-runtime/node_modules");
const DEPLOY_ONLY_DOCS = ["README.md", "README.zh.md", "README.i18n.yaml"];

const staging = resolve(process.argv[2] ?? "");
if (!staging || staging === REPO_ROOT || REPO_ROOT.startsWith(staging + sep) || QILIN_ROOT.startsWith(staging + sep)) {
  console.error(`materialize: 拒绝清空 ${staging}（包含仓库根）`);
  process.exit(2);
}

function pnpm(args) {
  const res = spawnSync("bash", [QILIN_PNPM, ...args], { cwd: QILIN_ROOT, encoding: "utf8" });
  if (res.status !== 0) {
    console.error(res.stdout?.slice(-4000));
    console.error(res.stderr?.slice(-4000));
    throw new Error(`pnpm ${args.join(" ")} 失败（exit ${res.status}）`);
  }
}

function firstSymlink(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (lstatSync(path).isSymbolicLink()) return path;
    if (entry.isDirectory()) {
      const nested = firstSymlink(path);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function copyWithoutNestedModules(source, destination) {
  // 作用域包（@qilin/x）的目标父目录需先存在——不依赖 cpSync 的自建行为。
  mkdirSync(dirname(destination), { recursive: true });
  const nested = join(source, "node_modules");
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: (path) => path !== nested && !path.startsWith(nested + sep),
  });
}

// ── 1. deploy ───────────────────────────────────────────────────────
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
console.log(`==> pnpm deploy ${CLOSURE_PKG} → ${staging}`);
pnpm([
  "--filter", CLOSURE_PKG,
  "deploy",
  "--legacy",
  "--prod",
  // 与上游一致：生产部署不含工作区工具链（如 Electron patched signer）
  "--config.allow-unused-patches=true",
  "--config.node-linker=hoisted",
  "--config.auto-install-peers=false",
  "--config.link-workspace-packages=true",
  staging,
]);

// ── 2. restoreLegacyHoists ──────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(staging, "package.json"), "utf8"));
const restored = [];
for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
  const destination = join(staging, "node_modules", dependency);
  if (existsSync(destination)) continue;
  const source = join(DEPLOY_SOURCE_NODE_MODULES, dependency);
  if (!existsSync(source)) {
    throw new Error(`materialize: ${dependency} 在部署目标与 ${DEPLOY_SOURCE_NODE_MODULES} 均不存在`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyWithoutNestedModules(source, destination);
  restored.push(dependency);
}
const stillMissing = Object.keys(manifest.dependencies ?? {}).filter(
  (d) => !existsSync(join(staging, "node_modules", d)),
);
if (stillMissing.length > 0) throw new Error(`materialize: 部署后仍缺失：${stillMissing.join(", ")}`);
if (restored.length > 0) console.log(`    还原 legacy hoists：${restored.join(", ")}`);

// ── 2.5 repairStagedScope（KStock 等价修复，对应上游 repairStagedScope）──
/**
 * pnpm 的 legacy deploy 可能把部分**传递**的 workspace 作用域包留在部署源而非
 * 目标（restoreLegacyHoists 只覆盖清单里的直接依赖），例如
 * @qilin/sandbox-windows-acl 可经 @qilin/sandbox-local 到达却在闭包里缺位——
 * 运行时首个裸导入即失败。这里补齐作用域包，并为其非作用域依赖补拷。
 */
function repairStagedScope(sourceNodeModules, stagedNodeModules) {
  const scopes = ["@qilin", "@deepseek-ai"];
  const repaired = [];
  const copyPackage = (name) => {
    const destination = join(stagedNodeModules, name);
    if (existsSync(join(destination, "package.json"))) return;
    const source = join(sourceNodeModules, name);
    if (!existsSync(join(source, "package.json"))) return;
    copyWithoutNestedModules(source, destination);
    repaired.push(name);
  };
  for (const scope of scopes) {
    const scopeDir = join(sourceNodeModules, scope);
    if (!existsSync(scopeDir)) continue;
    for (const entry of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      copyPackage(`${scope}/${entry.name}`);
    }
  }
  for (const name of [...repaired]) {
    const manifestPath = join(stagedNodeModules, name, "package.json");
    if (!existsSync(manifestPath)) continue;
    const pkgManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const dependency of Object.keys(pkgManifest.dependencies ?? {})) {
      if (dependency.startsWith("@")) continue;
      copyPackage(dependency);
    }
  }
  if (repaired.length > 0) console.log(`    补齐作用域包：${repaired.join(", ")}`);
}

repairStagedScope(DEPLOY_SOURCE_NODE_MODULES, join(staging, "node_modules"));

// ── 3. materializeStagedLinks ───────────────────────────────────────
const nodeModules = join(staging, "node_modules");
let remaining = existsSync(nodeModules) ? firstSymlink(nodeModules) : undefined;
let materialized = 0;
while (remaining !== undefined) {
  const segments = remaining.slice(nodeModules.length + 1).split(sep);
  const binIndex = segments.lastIndexOf(".bin");
  if (binIndex >= 0) {
    rmSync(join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true });
  } else {
    const source = realpathSync(remaining);
    rmSync(remaining, { recursive: true, force: true });
    copyWithoutNestedModules(source, remaining);
    materialized += 1;
  }
  remaining = firstSymlink(nodeModules);
}
console.log(`    物化链接 ${materialized} 个`);

// ── 4. 裁剪 + docs 清理 + 版本标记 ──────────────────────────────────
// deploy 产物兼任麒麟 python SDK 的打包载体（pyproject/hatch/src），桌面端
// 只需要 Node 闭包本体。platforms.json 是 python 打包的平台元数据，运行时
// 零引用（已实测 grep 闭包 node_modules 无一处引用）。
const PRUNE_PYTHON_PACKAGING = ["src", "pyproject.toml", "hatch_build.py", "platforms.json"];
for (const name of PRUNE_PYTHON_PACKAGING) {
  rmSync(join(staging, name), { recursive: true, force: true });
}
for (const name of DEPLOY_ONLY_DOCS) rmSync(join(staging, name), { force: true });

const engineVersion = JSON.parse(readFileSync(join(QILIN_ROOT, "package.json"), "utf8")).version;
const commit = spawnSync("git", ["-C", QILIN_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();
writeFileSync(
  join(staging, ".runtime-version"),
  `${JSON.stringify({ engine: "qilin", version: engineVersion, commit, builtAt: new Date().toISOString() })}\n`,
);

let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(path);
    else {
      files += 1;
      bytes += statSync(path).size;
    }
  }
};
walk(staging);
console.log(`==> 闭包就绪：${files} 文件 / ${(bytes / 1048576).toFixed(1)} MB 未压缩 / 引擎 ${engineVersion}`);
