#!/usr/bin/env bash
# 本地 macOS 签名 + 公证打包（KStock 桌面端）。
#
# 与 scripts/build-desktop.sh 的区别：本脚本面向"没有 CI、要在这台机器上出
# 可直接分发的 dmg/zip"的场景，并绕开本地环境下会失败的若干环节。
#
# 前置条件（缺一不可）：
#   1. dist-exe/ 已构建（scripts/build-engine-bundle.sh）
#   2. dist-exe/ 内全部 Mach-O 已用 Developer ID 预签
#      （scripts/local/presign-engine-macos.sh）——否则 Apple 公证
#      会因"未签名的嵌套二进制"直接 HARDFAIL
#   3. login 钥匙串里存在 Developer ID Application 身份，且私钥 ACL 已放行
#      codesign（见下方"为什么用 CSC_KEYCHAIN"）
#
# 环境变量：
#   KS_APPLE_ID             Apple ID 邮箱（公证必需）
#   KS_APPLE_PASSWORD       App 专用密码（appleid.apple.com 生成）
#   KS_TEAM_ID              Team ID
#   KS_NOTARY_PROFILE       可选；给了就用 keychain profile 代替上面三个
#   KS_SIGN_IDENTITY        签名身份名（不含 "Developer ID Application: " 前缀）
#   KSTOCK_SKIP_NOTARIZE=1  仅签名，不公证
#
# ─────────────────────────────────────────────────────────────────────
# 本脚本固化的四个真实坑（都是本机实测踩出来的，别的机器同样会踩）
# ─────────────────────────────────────────────────────────────────────
# 【坑 1】本地离线打包会卡在 github.com
#   electron-builder.yml 里 publish.provider=github。即便传 `--publish never`，
#   首次构建仍会去 github.com 拉 release 信息；本机实测该域名间歇不可达
#   （connect ETIMEDOUT 20.205.243.166:443，而 api.github.com 可达），
#   配合 build-desktop.sh 的 3 次重试 = 白等 3×超时。
#   → 用 apps/desktop/electron-builder.local.yml（extends 主配置 + publish: null）。
#     注意不能再传 --publish，CLI 优先级会压掉 YAML 里的 null。
#
# 【坑 2】Electron 运行时下载（本次 44.4.1）走 github.com releases
#   @electron/get 的请求超时是 10 分钟（downloadOptions.timeout.request），
#   网络抖动时表现为构建静默卡 10 分钟再报 "Timeout awaiting 'request'"。
#   而且它每次都会联网重取 SHASUMS256.txt（cacheMode: Bypass，无法缓存）。
#   → 用 ELECTRON_MIRROR 指到 npmmirror，并把已校验的 zip 预置进
#     ~/Library/Caches/electron/<sha256(镜像URL父目录)>/。
#
# 【坑 3】electron-builder 创建临时钥匙串后必失败（上游缺陷）
#   macCodeSign.js 用【随机口令】create-keychain，随后 importCerts() 调
#     security set-key-partition-list -k <CSC_KEY_PASSWORD>
#   即把 p12 口令当成钥匙串口令用 —— 两者必然不同，报
#     "SecKeychainUnlock: The user name or passphrase you entered is not correct"
#   且该调用无任何容错。沙箱/权限都不是原因（实测全权限下同样失败）。
#   → 绕开 createKeychain：不设 CSC_LINK，改用 CSC_KEYCHAIN 指向既有钥匙串
#     （macPackager 在 cscLink==null 时直接 { keychainFile: CSC_KEYCHAIN }）。
#     此时签名用的是钥匙串里已有的身份，p12 无需参与。
#     另注意 CSC_NAME 不能带 "Developer ID Application: " 前缀。
#
# 【坑 4】notarytool 会"假失败"
#   上传大体积 .app 时多段上传完成、Apple 已受理，但客户端收尾响应超时，
#   electron-builder 报 abortedUpload(deadlineExceeded) 并以 exit 1 结束，
#   于是 dmg/zip/staple 全部没做。这是假失败。
#   → 用 `xcrun notarytool history` 查真实提交状态；Accepted 后用
#     `xcrun notarytool submit --wait` 的替身做法：直接 staple + 手动打包。
#     （本脚本的 --prepackaged 分支就是用来复用已签好的 .app 出 dmg/zip。）
#
# 用法:
#   KS_APPLE_ID=... KS_APPLE_PASSWORD=... KS_TEAM_ID=... \
#     bash scripts/local/build-signed-macos.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
DESKTOP="$ROOT/apps/desktop"
APP="$DESKTOP/release/mac-arm64/KStock.app"

KS_SIGN_IDENTITY="${KS_SIGN_IDENTITY:-Bing Li (DHV5D72JNF)}"
KS_APPLE_ID="${KS_APPLE_ID:-}"
KS_APPLE_PASSWORD="${KS_APPLE_PASSWORD:-}"
KS_TEAM_ID="${KS_TEAM_ID:-}"
KS_NOTARY_PROFILE="${KS_NOTARY_PROFILE:-}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── 0. 工具链与前置校验 ─────────────────────────────────────────────
[[ "$(uname -s)" == "Darwin" ]] || die "仅支持 macOS"
[ -d "$ROOT/vendor/qilin" ] || die "缺 vendor/qilin（先 sync:upstream）"

# ulimit：签名阶段会递归打开成千上万个文件句柄
if [ "$(ulimit -n)" -lt 10240 ]; then
  ulimit -n 10240 || warn "无法提升 ulimit -n"
fi

# 签名身份必须在钥匙串里可见，否则后面会以晦涩的方式失败
if ! security find-identity -v -p codesigning | grep -q "$KS_SIGN_IDENTITY"; then
  die "钥匙串里找不到签名身份：$KS_SIGN_IDENTITY（security find-identity -v -p codesigning）"
fi
log "签名身份可用：$KS_SIGN_IDENTITY"

# ── 1. 构建运行时分发束（闭包 + 插件 + presets + ABI 冒烟门禁）──────
# 2.0 起：引擎以 symlink-free 闭包 tar.gz 随包（桌面壳用 Electron 内置
# Node 直跑）。注意：公证会解压 tar.gz 校验内部 Mach-O，闭包树必须先做
# Developer ID 预签（build-runtime-bundle.sh 内置该步骤）。
log "构建运行时分发束（build-runtime-bundle.sh，含 ABI 冒烟 + 闭包预签）"
APPLE_SIGNING_IDENTITY="Developer ID Application: $KS_SIGN_IDENTITY" \
  bash "$ROOT/scripts/build-runtime-bundle.sh"

# ── 2. 签名打包 ─────────────────────────────────────────────────────
export PATH="$DESKTOP/node_modules/.bin:/opt/homebrew/bin:$PATH"
export CSC_IDENTITY_AUTO_DISCOVERY=true
# default-keychain 输出形如 `    "/Users/.../login.keychain-db"`（前导空格 +
# 引号）——只去引号会把带空格的路径传给 electron-builder，security 查不到
# 身份，报 "0 identities found" 静默跳过签名。这里空格引号一起剥。
export CSC_KEYCHAIN="$(security default-keychain -d user | tr -d '"' | xargs)"
export CSC_NAME="$KS_SIGN_IDENTITY"
unset CSC_LINK CSC_KEY_PASSWORD   # 见坑 3：设了 CSC_LINK 就会走坏掉的临时钥匙串分支

export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
# dmg-builder 工具包（dmgbuild-bundle）默认从 github releases 下载，网络
# 抖动即 read ETIMEDOUT。指到 npmmirror 镜像。
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://registry.npmmirror.com/-/binary/electron-builder-binaries/}"
# electron-builder 的根证书钥匙串落在 ELECTRON_BUILDER_CACHE；留在工作区内
# 可避免每次改写用户钥匙串搜索列表。
export ELECTRON_BUILDER_CACHE="${ELECTRON_BUILDER_CACHE:-$ROOT/.tools/eb-cache}"
export APP_BUILDER_TMP_DIR="${APP_BUILDER_TMP_DIR:-$ROOT/.tools/app-builder-tmp}"
mkdir -p "$ELECTRON_BUILDER_CACHE" "$APP_BUILDER_TMP_DIR"

LOG_DIR="$ROOT/.release-logs"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/local-signed-$(date +%Y%m%d-%H%M%S).log"

log "编译主进程（esbuild → dist-electron/main.cjs）"
(cd "$DESKTOP" && pnpm run build:electron-main > "$LOG.build" 2>&1) || {
  tail -20 "$LOG.build" >&2; die "主进程编译失败"; }

log "electron-builder 签名打包（日志 $LOG）"
cd "$DESKTOP"
if [ "${KSTOCK_SKIP_NOTARIZE:-0}" = "1" ]; then
  warn "KSTOCK_SKIP_NOTARIZE=1：只签名，不公证"
  set +e
  node scripts/run.mjs electron-builder --config electron-builder.local.yml --publish never > "$LOG" 2>&1
  set -e
else
  [ -n "$KS_APPLE_ID" ] || [ -n "$KS_NOTARY_PROFILE" ] || die "公证需要 KS_APPLE_ID/KS_APPLE_PASSWORD/KS_TEAM_ID，或 KS_NOTARY_PROFILE"
  export APPLE_ID="$KS_APPLE_ID"
  export APPLE_APP_SPECIFIC_PASSWORD="$KS_APPLE_PASSWORD"
  export APPLE_TEAM_ID="$KS_TEAM_ID"
  set +e
  node scripts/run.mjs electron-builder --config electron-builder.local.yml --publish never > "$LOG" 2>&1
  set -e
fi

# ── 3. 判定成败：看 .app 签名与公证真实状态，而不是只看 exit code ──
[[ -d "$APP" ]] || { tail -30 "$LOG" >&2; die "未产出 $APP"; }

log "校验 .app 签名"
codesign --verify --deep --strict "$APP" || die "签名校验失败（--deep --strict）"
codesign -dv --verbose=2 "$APP" 2>&1 | grep -E "Authority|TeamIdentifier" | sed 's/^/    /'

if [ "${KSTOCK_SKIP_NOTARIZE:-0}" = "1" ]; then
  log "已跳过公证。产物：$APP"
  exit 0
fi

# 坑 4：notarytool 可能"假失败"——Apple 已受理但客户端超时。
# 以 Apple 侧状态为准。history 会混入同账号其他项目（KWorks/KCoder）的
# 提交，必须按 name==KStock.zip 过滤后取最新一条。
log "向 Apple 查询本次 KStock 提交状态"
NOTARY_ARGS=(--apple-id "$KS_APPLE_ID" --password "$KS_APPLE_PASSWORD" --team-id "$KS_TEAM_ID")
latest_kstock() {
  # history 按 newest-first 输出，且每条记录字段顺序为 id → name → status。
  # 只认第一条 name==KStock.zip 的记录（最新）；state 机器防跨记录串位。
  xcrun notarytool history "${NOTARY_ARGS[@]}" 2>/dev/null | awk '
    /^ +id:/{if (state==1) {id=$2; state=2} }
    /^ +name:/{if (state==2) {if ($2=="KStock.zip") state=3; else state=0} }
    /^ +status:/{if (state==3) {print id, $2; exit}}
    { if ($0 ~ /^ +createdDate:/) state=1 }'
}
SUB_ID=""; SUB_STATUS=""
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  read -r SUB_ID SUB_STATUS <<< "$(latest_kstock)"
  log "[$attempt] 提交 $SUB_ID 状态：$SUB_STATUS"
  case "$SUB_STATUS" in
    Accepted) break ;;
    Invalid)
      echo "---- 公证 Invalid，issues 摘要 ----" >&2
      xcrun notarytool log "$SUB_ID" "${NOTARY_ARGS[@]}" 2>/dev/null \
        | python3 -c "import json,sys; d=json.load(sys.stdin); [print(i.get('severity'), i.get('path'), '|', i.get('message')) for i in d.get('issues', [])[:12]]" >&2
      die "公证被拒（见上），修复后重跑"
      ;;
  esac
  sleep 45
done
[ "$SUB_STATUS" = "Accepted" ] || { warn "10 轮后仍非 Accepted（$SUB_STATUS）；可稍后重跑本脚本续 staple/dmg"; exit 2; }

# ── 4. staple：把公证票据钉进 .app（刚 Accepted 时票据查询有传播延迟，重试）─
log "staple 公证票据"
STAPLED=0
for attempt in 1 2 3 4 5 6; do
  if xcrun stapler staple "$APP" 2>&1 | tail -2 && xcrun stapler validate "$APP" > /dev/null 2>&1; then
    STAPLED=1
    break
  fi
  warn "staple 第 $attempt 次未就绪（Record not found 多为票据传播延迟），45s 后重试"
  sleep 45
done
[ "$STAPLED" = "1" ] || die "staple 多次失败"
log "staple 校验通过"

# ── 5. 用已签好的 .app 出 dmg/zip（不重新打包/签名/公证）────────────
# `--prepackaged` 会让 electron-builder 跳过 doPack+sig，直接
# packageInDistributableFormat（macPackager.packMacTargets）。
# 注意两点：
#   a. 必须清掉公证环境变量——否则 --prepackaged 会对新 zip 再走一轮
#      notarytool（几分钟 + 无谓消耗）；app 已 staple，票据已在包内。
#   b. dmg 的 hdiutil 依赖 DiskImages 系统服务，沙箱/受限环境会报
#      "操作不被允许"，此时需以完整权限运行本脚本。
log "生成 dmg/zip"
env -u APPLE_ID -u APPLE_APP_SPECIFIC_PASSWORD -u APPLE_TEAM_ID \
  node scripts/run.mjs electron-builder --config electron-builder.local.yml \
  --publish never --prepackaged "$APP" > "$LOG.packaging" 2>&1 \
  || warn "打包返回非 0，请查看 $LOG.packaging"

log "Gatekeeper 评估"
spctl --assess --type execute --verbose=2 "$APP" 2>&1 | sed 's/^/    /' || true

log "产物清单位于 $DESKTOP/release"
ls -la "$DESKTOP/release" | sed 's/^/    /'
log "完成"
