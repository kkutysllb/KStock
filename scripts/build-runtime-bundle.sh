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

# preset 随行技能是 gitignore 的生成物（kstock/presets/*/skills/），语料源在
# vendor/skills/public，由 patch_vendor_skills 按 skills.manifest.json 镜像
# 发布——全新 runner 缺这步会让打包断言「presets carry skill directories」红。
log "发布 preset 随行技能（patch_vendor_skills，幂等）"
"$ROOT/scripts/python.sh" "$ROOT/scripts/patch_vendor_skills.py"

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
# electron@44 起包内无 scripts 字段（不再有 postinstall 拉二进制）：全新
# runner / 首次构建须显式跑 install.js，否则 require 直接抛「未能正确安装」。
# 幂等：二进制已就位则 require 成功，直接跳过。
if ! (cd "$ROOT/apps/desktop" && node -e 'require("electron")' > /dev/null 2>&1); then
  log "补跑 electron install.js（首次拉取 Electron 二进制）"
  (cd "$ROOT/apps/desktop" && node node_modules/electron/install.js)
fi
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
# 预签只在 macOS 有意义（其他平台无 Mach-O）；非 Darwin 不碰预签脚本，
# 否则凭据一旦被全平台注入（G4），ubuntu/windows 会拿 mac 变量跑 codesign 而挂。
# fail-closed 的身份要求在发布门（check-release.sh）；此处保本地开发可用。
if [ "$(uname -s)" = "Darwin" ]; then
  if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    log "预签闭包内全部 Mach-O（含嵌套 LibreOfficeDev.app）"
    bash "$ROOT/scripts/local/presign-engine-macos.sh" "$CLOSURE"
  else
    # 未设身份 = 本地开发闭包（不经公证分发）。预签只是公证前置，不是
    # 运行前置；发布窗口（check-release.sh / CI）由发布门保证身份齐备。
    log "未设 APPLE_SIGNING_IDENTITY——跳过 Developer ID 预签（本地开发闭包，不公证）"
  fi
fi

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
    log "WARN: 本平台未装 office kit（${KIT}）——办公文档转 PDF 能力将不可用"
  fi
fi

# ── 6. tar.gz（拷贝时排除 macOS 元数据）─────────────────────────────
# 打包器必须与运行时解压端同源：Windows 上 Electron 用 System32 的 bsdtar 解压，
# 而 Git Bash 的 PATH 上是 GNU tar。不同源会让中文名/硬链接被改写成解压端读不出
# 的形态（根因与实测数据见 scripts/runtime-tar.sh）。
. "$ROOT/scripts/runtime-tar.sh"
RUNTIME_TAR="$(runtime_tar_bin)"
log "打包 kstock-runtime.tar.gz（tar: $RUNTIME_TAR）"
rm -f "$STAGING/kstock-runtime.tar.gz"
COPYFILE_DISABLE=1 "$RUNTIME_TAR" -czf "$STAGING/kstock-runtime.tar.gz" -C "$CLOSURE" .

# 解压端自检（fail loud）：用同一个 tar 回读含中文名 + 硬链接的资源子树，
# 落盘文件名必须与源逐项一致。不能只看 tar 退出码——GNU tar 默认格式下
# bsdtar 对**绝大多数**中文名是静默乱码改名（不报错、退出码也可能是 0）。
PROBE_SRC="$CLOSURE/node_modules/dsh-animations/skills/video-shot-demos/assets"
if [ -d "$PROBE_SRC" ]; then
  PROBE_OUT="$(mktemp -d)"
  if ! COPYFILE_DISABLE=1 "$RUNTIME_TAR" -xzf "$STAGING/kstock-runtime.tar.gz" -C "$PROBE_OUT" \
       "./node_modules/dsh-animations/skills/video-shot-demos/assets" 2>"$PROBE_OUT/.tar.log"; then
    sed -n '1,5p' "$PROBE_OUT/.tar.log" >&2
    rm -rf "$PROBE_OUT"
    die "闭包无法被运行时解压端解压（tar: ${RUNTIME_TAR}）——中文名/硬链接资源条目报错"
  fi
  if ! diff -q \
      <(cd "$PROBE_SRC" && find . -type f | LC_ALL=C sort) \
      <(cd "$PROBE_OUT/node_modules/dsh-animations/skills/video-shot-demos/assets" && find . -type f | LC_ALL=C sort) >/dev/null; then
    rm -rf "$PROBE_OUT"
    die "闭包解压后文件名与源不一致（编码被改写的征兆）——打包 tar 须与解压端同源"
  fi
  PROBE_COUNT="$(cd "$PROBE_SRC" && find . -type f | wc -l | tr -d ' ')"
  rm -rf "$PROBE_OUT"
  log "解压端自检通过（${PROBE_COUNT} 个中文名/硬链接资源条目名字一致）"
fi

TAR_SIZE=$(du -h "$STAGING/kstock-runtime.tar.gz" | cut -f1)
CLO_SIZE=$(du -sh "$CLOSURE" | cut -f1)
log "完成：tar.gz ${TAR_SIZE}（闭包未压缩 ${CLO_SIZE}）"
ls -la "$STAGING" | grep -vE "^total|\.$"

# ── 7. 收尾：恢复引擎工作区依赖（pnpm deploy --prod 副作用）─────────
# deploy 会把工作区状态置为 production 并剪掉部分 workspace 包的
# node_modules（实机两次复现：apps/cli/node_modules 整体消失，dev 引擎
# 源码直跑随即 ERR_MODULE_NOT_FOUND 'commander'）。恢复会重排 modules
# 目录，pnpm 无 TTY 时会弹确认中止——CI=true 自动确认。store 命中，秒级。
log "恢复引擎工作区依赖（deploy 剪枝回滚）"
CI=true "$ROOT/scripts/qilin-pnpm.sh" install --frozen-lockfile >/dev/null
