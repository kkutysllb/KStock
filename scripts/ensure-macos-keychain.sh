#!/usr/bin/env bash
# CI macOS 签名钥匙串引导（设计为被 source）：把 MAC_CERTIFICATE（base64 .p12）
# 导入专用钥匙串，导出 CSC_KEYCHAIN + CSC_NAME——闭包预签（codesign）与
# .app 签名（electron-builder）共用同一身份来源。
#
# 为什么不用 CSC_LINK：electron-builder 的临时钥匙串分支有上游缺陷（坑 3，
# scripts/local/build-signed-macos.sh 实测创建后必失败），本地签名流水线同样
# 走 CSC_KEYCHAIN + CSC_NAME。代码签名身份不在钥匙串时 codesign 直接
# 「no identity found」（v2.0.0-rc.1 演练实测）。
#
# 幂等：签名身份已在钥匙串可见则跳过导入。依赖环境变量：
#   MAC_CERTIFICATE（base64 .p12）、MAC_CERTIFICATE_PWD、APPLE_SIGNING_IDENTITY
if [ "$(uname -s)" != "Darwin" ]; then
  return 0 2>/dev/null || exit 0
fi

KSTOCK_KC_PASS="kstock-ci-keychain"
KSTOCK_TMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

if [ -n "${APPLE_SIGNING_IDENTITY:-}" ] && security find-identity -v -p codesigning 2>/dev/null | grep -qF "$APPLE_SIGNING_IDENTITY"; then
  echo "==> 签名身份已在钥匙串可见，跳过导入"
  KSTOCK_KC="$(security default-keychain -d user | tr -d '"' | xargs)"
else
  [ -n "${MAC_CERTIFICATE:-}" ] || { echo "ERROR: 缺 MAC_CERTIFICATE（base64 .p12）" >&2; return 1 2>/dev/null || exit 1; }
  KSTOCK_KC="$KSTOCK_TMP/kstock-sign.keychain-db"
  CERT_FILE="$KSTOCK_TMP/kstock-sign.p12"
  python3 -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.buffer.read()))' \
    <<<"$MAC_CERTIFICATE" > "$CERT_FILE"
  security create-keychain -p "$KSTOCK_KC_PASS" "$KSTOCK_KC" > /dev/null
  security set-keychain-settings -lut 21600 "$KSTOCK_KC"
  security unlock-keychain -p "$KSTOCK_KC_PASS" "$KSTOCK_KC"
  security import "$CERT_FILE" -k "$KSTOCK_KC" -P "${MAC_CERTIFICATE_PWD:-}" \
    -T /usr/bin/codesign -T /usr/bin/security -T /usr/bin/productbuild -T /usr/bin/pkgbuild > /dev/null
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KSTOCK_KC_PASS" "$KSTOCK_KC" > /dev/null
  rm -f "$CERT_FILE"
  # 搜索列表保留既有钥匙串，专用钥匙串插到最前。
  security list-keychains -d user -s "$KSTOCK_KC" $(security list-keychains -d user | tr -d '"')
  echo "==> 专用钥匙串就绪，签名身份："
  security find-identity -v -p codesigning | head -3
fi

export CSC_KEYCHAIN="$KSTOCK_KC"
# CSC_NAME 要短名（electron-builder 实测：带 "Developer ID Application:" 前缀
# 直接报「Please remove prefix … appropriate certificate will be chosen
# automatically」）；codesign 侧继续用完整 APPLE_SIGNING_IDENTITY。
export CSC_NAME="${APPLE_SIGNING_IDENTITY#Developer ID Application: }"
unset CSC_LINK CSC_KEY_PASSWORD
