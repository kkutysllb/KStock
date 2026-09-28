#!/usr/bin/env bash
# 构建 KStock 桌面端「运行时闭包」分发束（KCoder 模式，2.0 架构）。
#
# 产物：staging/
#   kstock-runtime.tar.gz   麒麟 runtime 闭包（symlink-free node_modules +
#                           runtime-bootstrap.mjs 入口 + office kit 随
#                           node_modules 分发），桌面壳首启解压到
#                           ~/.kstock/runtime，用 Electron 内置 Node 直跑
#   plugins/                KStock 插件包（12 个，lib 产物 + 清单）
#   presets/                KStock agent preset 目录
#
# 与旧 build-engine-bundle.sh 的关系：旧脚本产出 pkg 单文件
# （dist-exe/kstock-engine），内嵌 Node24 基座 + 全平台 prebuilds 死重，
# 且 200+ 嵌套 Mach-O 撑爆 macOS 签名/公证面——已废弃，不再使用。
# 本脚本从麒麟源码 deploy 生产闭包，天然单平台、symlink-free。
#
# 跨平台：本脚本设计为在目标平台 runner 上执行（deploy 按 runner 的
# os/cpu 只装当前平台 optional deps），mac/win/linux 各跑各的。
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
STAGING="$ROOT/staging"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$ROOT/vendor/qilin" ] || die "缺 vendor/qilin（先 sync:upstream）"
[ -f "$ROOT/scripts/qilin-pnpm.sh" ] || die "缺 scripts/qilin-pnpm.sh"

# ── 1. KStock 插件包构建（与旧脚本同一组包与构建方式）────────────────
log "重放引擎本地补丁（patch_vendor_engine，幂等）"
"$ROOT/scripts/python.sh" "$ROOT/scripts/patch_vendor_engine.py"

log "构建 KStock 插件包"
for pkg in accounts client-brand presets-ui datasources-ui web quant quant-strategies quant-factors quant-selections quant-reports news-ui chan-ui automation; do
  if [ ! -d "$ROOT/kstock/$pkg/node_modules" ]; then
    die "kstock/$pkg 缺 node_modules——请先在仓库根执行 pnpm install"
  fi
  logf="$(mktemp)"
  if [ "$pkg" = "automation" ]; then
    (cd "$ROOT/kstock/$pkg" && node scripts/build.mjs > "$logf" 2>&1) || {
      echo "!! kstock/$pkg 构建失败：" >&2; tail -20 "$logf" >&2; rm -f "$logf"; exit 1; }
  else
    (cd "$ROOT/kstock/$pkg" && npx tsdown > "$logf" 2>&1) || {
      echo "!! kstock/$pkg 构建失败：" >&2; tail -20 "$logf" >&2; rm -f "$logf"; exit 1; }
  fi
  rm -f "$logf"
done

log "组装 staging/plugins 与 staging/presets"
rm -rf "$STAGING/plugins" "$STAGING/presets"
mkdir -p "$STAGING/plugins" "$STAGING/presets"
for pkg in accounts client-brand presets-ui datasources-ui web quant quant-strategies quant-factors quant-selections quant-reports news-ui chan-ui automation; do
  target="$STAGING/plugins/$pkg"
  mkdir -p "$target"
  cp "$ROOT/kstock/$pkg/package.json" "$target/"
  cp -R "$ROOT/kstock/$pkg/lib" "$target/lib"
  if [ -d "$ROOT/kstock/$pkg/public" ]; then
    cp -R "$ROOT/kstock/$pkg/public" "$target/public"
  fi
  # 引擎 Loader 读取插件根目录的 cordis 配置（如 web/cordis.patch.yml 的
  # bundle patch 层），缺失 = profile 装配直接抛 ENOENT。根级 yml 全随包。
  for yml in "$ROOT/kstock/$pkg"/*.yml "$ROOT/kstock/$pkg"/*.yaml; do
    [ -f "$yml" ] && cp "$yml" "$target/"
  done
done
if [ -d "$ROOT/kstock/presets" ]; then
  (cd "$ROOT/kstock/presets" && tar cf - .) | (cd "$STAGING/presets" && tar xf -)
fi

# ── 2. 麒麟闭包：校验 → 物化 ─────────────────────────────────────────
log "校验 runtime 依赖闭包清单（verify-runtime-closure）"
bash "$ROOT/scripts/qilin-pnpm.sh" run verify-runtime-closure > /dev/null

log "物化麒麟 runtime 闭包 → staging/kstock-runtime"
node "$ROOT/scripts/local/materialize-runtime-closure.mjs" "$STAGING/kstock-runtime"

CLOSURE="$STAGING/kstock-runtime"
[ -f "$CLOSURE/runtime-bootstrap.mjs" ] || die "闭包缺 runtime-bootstrap.mjs 入口"

# ── 3. ABI 冒烟（Electron 内置 Node 直跑；门禁，失败即停）──────────
log "定位 Electron 二进制"
ELECTRON_BIN="$(cd "$ROOT/apps/desktop" && node -p 'require("electron")')"
[ -x "$ELECTRON_BIN" ] || ELECTRON_BIN="$(cd "$ROOT/apps/desktop" && node -p 'require("electron").default' 2>/dev/null || true)"
[ -n "$ELECTRON_BIN" ] && [ -e "$ELECTRON_BIN" ] || die "未定位到 Electron 二进制"

log "ABI 冒烟：原生模块 + node:sqlite"
if ! ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" "$ROOT/scripts/local/smoke-runtime-closure.cjs" "$CLOSURE"; then
  die "ABI 冒烟未通过：上述 ABI-FAIL 模块需按 Electron ABI 重编（参照 KCoder materialize-peers 模式）"
fi

log "冒烟：闭包入口 --help（runCli 装配）"
# 入口必须以绝对路径传入：ESM 裸导入（@qilin/*）按入口文件位置解析，
# 绝对路径即锚定闭包自带的 node_modules，与壳的启动方式一致。
if ! ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" "$CLOSURE/runtime-bootstrap.mjs" --help > "$STAGING/.smoke-help.log" 2>&1; then
  echo "---- 入口 --help 输出 ----" >&2
  tail -20 "$STAGING/.smoke-help.log" >&2
  die "闭包入口冒烟未通过"
fi
grep -q "kstock\|Usage\|usage\|选项\|Options" "$STAGING/.smoke-help.log" || {
  echo "---- --help 输出异常 ----" >&2; cat "$STAGING/.smoke-help.log" >&2; die "入口 --help 输出不含可用性标志"; }
echo "    入口 OK"

# ── 4. Developer ID 预签闭包（公证硬性要求）─────────────────────────
# 实测公证服务会解压 tar.gz 逐个校验内部 Mach-O：未签 / 无时间戳 / 无
# hardened runtime 一律 Invalid（LibreOffice dylibs、node-pty prebuilds、
# sharp、koffi、rg 全部中招）。打 tar 前对整棵闭包树深→浅预签。
# （KCoder 同款前置：其 release.sh 签名阶段即递归签内置运行时树。）
if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
  die "需要 APPLE_SIGNING_IDENTITY（Developer ID 预签闭包，公证硬性要求）"
fi
log "预签闭包内全部 Mach-O（含嵌套 LibreOfficeDev.app）"
bash "$ROOT/scripts/local/presign-engine-macos.sh" "$CLOSURE"

# ── 5. office kit 平台断言 ──────────────────────────────────────────
case "$(uname)-$(uname -m)" in
  Darwin-arm64) KIT="libreoffice-kit-darwin-arm64" ;;
  Darwin-x86_64) KIT="libreoffice-kit-darwin-x64" ;;
  Linux-x86_64) KIT="libreoffice-kit-linux-x64" ;;
  Linux-aarch64) KIT="libreoffice-kit-linux-arm64" ;;
  MINGW*|MSYS*) KIT="libreoffice-kit-win32-x64" ;;
  *) KIT="" ;;
esac
if [ -n "$KIT" ]; then
  if [ -d "$CLOSURE/node_modules/@deepseek-ai/$KIT" ]; then
    log "office kit 已随闭包分发：$KIT ($(du -sh "$CLOSURE/node_modules/@deepseek-ai/$KIT" | cut -f1))"
  else
    log "WARN: 本平台未装 office kit（$KIT）——办公文档转 PDF 能力将不可用"
  fi
fi

# ── 6. tar.gz（拷贝时排除 macOS 元数据）─────────────────────────────
log "打包 kstock-runtime.tar.gz"
rm -f "$STAGING/kstock-runtime.tar.gz"
COPYFILE_DISABLE=1 tar -czf "$STAGING/kstock-runtime.tar.gz" -C "$CLOSURE" .
TAR_SIZE=$(du -h "$STAGING/kstock-runtime.tar.gz" | cut -f1)
CLO_SIZE=$(du -sh "$CLOSURE" | cut -f1)
log "完成：tar.gz $TAR_SIZE（闭包未压缩 $CLO_SIZE）"
ls -la "$STAGING" | grep -vE "^total|\.$"
