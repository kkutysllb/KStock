#!/usr/bin/env bash
# 「运行时闭包解压端同源」tar 选择器。
#
# 为什么需要它：打包（build-runtime-bundle.sh）与解压（apps/desktop/electron/
# lib/engine.ts 的 ensureRuntimeExtracted，以及 verify-desktop-artifacts.sh 的 V4
# 门禁）必须是**同一个 tar 实现**，否则归档能被打出来、却在真机解不开。
#
# 实机故障（2026-09-30，Windows 打包版首启）：
#   打包端 = Git Bash PATH 上的 GNU tar 1.35；解压端 = Electron spawn 的
#   %SystemRoot%\System32\tar.exe（bsdtar/libarchive 3.8.8）。
#   GNU tar 默认 gnu/ustar 头把路径名按**原始字节**写进 header，libarchive 在
#   中文 Windows 上按 ANSI 代码页(CP936)解码这些字节：
#     - 绝大多数中文名被静默改写成乱码（不报错，落盘名字已错）；
#     - 少数被判成空路径 → `tar: <name>: Invalid empty pathname: Unknown error`；
#     - 硬链接条目的目标名同样错解 → `Hard-link target ... does not exist`
#       （pnpm 硬链接安装会产出硬链接，dsh-animations 示例资源即有）。
#   三者叠加导致「内置运行时解压失败」，引擎起不来。
#
# 修法：用 bsdtar 打包（libarchive 写 pax 记录、按 UTF-8 存名字）。实测同一子树：
#   GNU tar 默认     → bsdtar 解压 exit 1，文件名 0/104 正确
#   GNU tar --format=posix → exit 1，94/104（硬链接目标仍错解）
#   GNU tar posix + --hard-dereference → exit 0，104/104，但体积 +45%
#   bsdtar（本函数选中）  → exit 0，104/104，体积仅 +0.1%
#   且 bsdtar 产出的归档 GNU tar 也能正确解出中文名（Linux/macOS 打包端无虞）。
#
# 覆盖：KSTOCK_RUNTIME_TAR=/path/to/tar
runtime_tar_bin() {
  if [ -n "${KSTOCK_RUNTIME_TAR:-}" ]; then
    printf '%s' "$KSTOCK_RUNTIME_TAR"
    return 0
  fi
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      # Windows 上解压端固定是 System32 的 bsdtar；PATH 上的 tar 是 GNU tar。
      local win_root="${SYSTEMROOT:-C:\\Windows}"
      command -v cygpath >/dev/null 2>&1 && win_root="$(cygpath -u "$win_root")"
      if [ -x "$win_root/System32/tar.exe" ]; then
        printf '%s' "$win_root/System32/tar.exe"
        return 0
      fi
      ;;
  esac
  # macOS 的 /usr/bin/tar 本身就是 bsdtar；Linux 打包/解压两侧同为 GNU tar。
  printf 'tar'
}
