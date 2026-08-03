#!/usr/bin/env bash
# KStock release lifecycle manager.
#
# 本地脚本只负责准备 release commit/tag，并把真正的跨平台桌面打包、签名、
# 上传交给 GitHub Actions 的 .github/workflows/release.yml。
set -euo pipefail

cd "$(dirname "$0")"

SCRIPT_NAME="$(basename "$0")"
VERSION=""
TAG=""
REMOTE="origin"
EXPECTED_BRANCH="main"
RELEASE_WORKFLOW="release.yml"
RELEASE_LOG_DIR=".release-logs"
REPO_SLUG=""

PUSH=true
WATCH=true
YES=false
DRY_RUN=false
SKIP_CHECKS=false
SKIP_LOCK=false
NO_COMMIT=false
NO_TAG=false
ALLOW_DIRTY=false
NO_FETCH=false
RESUME=false
DELETE_TAG=false
WATCH_LATEST=false

VERSION_FILES=(
  "package.json"
  "apps/desktop/package.json"
  "apps/desktop/src-tauri/tauri.conf.json"
  "apps/desktop/src-tauri/Cargo.toml"
  "pyproject.toml"
)

LOCK_FILES=(
  "pnpm-lock.yaml"
  "uv.lock"
  "apps/desktop/src-tauri/Cargo.lock"
)

usage() {
  cat <<'EOF'
Usage:
  ./build-release.sh <version|vversion> [options]
  ./build-release.sh --watch
  ./build-release.sh --delete-tag <version|vversion>

Examples:
  ./build-release.sh v0.1.1 --yes
  ./build-release.sh 0.1.1 --no-watch
  ./build-release.sh v0.1.1 --resume --yes
  ./build-release.sh v0.1.1 --skip-checks --no-push

Options:
  --push              Atomic-push current branch and tag. Default: true.
  --no-push           Prepare local commit/tag only.
  --watch             Watch release workflow. Without a version, watch latest run.
  --no-watch          Do not wait for GitHub Actions after push.
  --resume            Do not update/commit/tag/push; watch an existing remote tag run.
  --yes               Auto-confirm prompts.
  --dry-run           Print plan and commands without changing files.
  --skip-checks       Skip local pre-release checks. Alias: --skip-check.
  --skip-lock         Do not refresh lockfiles.
  --no-commit         Update files and run checks, but do not commit.
  --no-tag            Do not create a tag.
  --allow-dirty       Allow starting from a dirty worktree. Alias: --force.
  --no-fetch          Do not fetch remote tags before checking conflicts.
  --delete-tag        Delete local and remote tag, then exit.
  --remote <name>     Git remote. Default: origin.
  --branch <name>     Expected release branch. Default: main.
  --workflow <name>   GitHub Actions workflow file/name. Default: release.yml.
  -h, --help          Show help.
EOF
}

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
  if [[ "$DRY_RUN" == true ]]; then
    return 0
  fi
  "$@"
}

run_shell() {
  local command="$1"
  printf '+ %s\n' "$command"
  if [[ "$DRY_RUN" == true ]]; then
    return 0
  fi
  bash -lc "$command"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

confirm() {
  local prompt="$1"
  if [[ "$YES" == true ]]; then
    return 0
  fi
  local answer
  read -r -p "$prompt [y/N] " answer
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

normalize_version() {
  local value="$1"
  value="${value#v}"
  [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || die "Invalid version: $1"
  VERSION="$value"
  TAG="v$value"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      --push) PUSH=true ;;
      --no-push) PUSH=false ;;
      --watch) WATCH=true; WATCH_LATEST=true ;;
      --no-watch) WATCH=false ;;
      --resume) RESUME=true; PUSH=false ;;
      --yes) YES=true ;;
      --dry-run) DRY_RUN=true ;;
      --skip-check|--skip-checks) SKIP_CHECKS=true ;;
      --skip-lock) SKIP_LOCK=true ;;
      --no-commit) NO_COMMIT=true ;;
      --no-tag) NO_TAG=true ;;
      --force|--allow-dirty) ALLOW_DIRTY=true ;;
      --no-fetch) NO_FETCH=true ;;
      --delete-tag) DELETE_TAG=true ;;
      --remote) [[ $# -ge 2 ]] || die "--remote requires a value"; REMOTE="$2"; shift ;;
      --branch) [[ $# -ge 2 ]] || die "--branch requires a value"; EXPECTED_BRANCH="$2"; shift ;;
      --workflow) [[ $# -ge 2 ]] || die "--workflow requires a value"; RELEASE_WORKFLOW="$2"; shift ;;
      --*) die "Unknown option: $1" ;;
      *)
        [[ -z "$VERSION" ]] || die "Only one version argument is allowed"
        normalize_version "$1"
        WATCH_LATEST=false
        ;;
    esac
    shift
  done

  if [[ -z "$VERSION" && "$WATCH_LATEST" != true ]]; then
    local current
    current="$(python3 -c 'import json;print(json.load(open("apps/desktop/src-tauri/tauri.conf.json"))["version"])')"
    normalize_version "$current"
    echo "未指定版本，使用当前版本: $TAG"
  fi
}

repo_slug() {
  local url slug
  url="$(git remote get-url "$REMOTE")" || die "Unknown git remote: $REMOTE"
  case "$url" in
    git@github.com:*) slug="${url#git@github.com:}" ;;
    ssh://git@github.com/*) slug="${url#ssh://git@github.com/}" ;;
    https://github.com/*) slug="${url#https://github.com/}" ;;
    http://github.com/*) slug="${url#http://github.com/}" ;;
    *) die "Cannot infer GitHub repo from remote URL: $url" ;;
  esac
  slug="${slug%.git}"
  [[ "$slug" == */* ]] || die "Cannot infer GitHub repo from remote URL: $url"
  printf '%s\n' "$slug"
}

remote_tag_exists() {
  git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$TAG" >/dev/null 2>&1
  local status=$?
  case "$status" in
    0) return 0 ;;
    2) return 1 ;;
    *) die "Could not check remote tag $TAG on $REMOTE" ;;
  esac
}

previous_release_tag() {
  git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-creatordate | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$' | head -1 || true
}

ensure_repo_state() {
  need_cmd git
  need_cmd python3
  git remote get-url "$REMOTE" >/dev/null || die "Unknown git remote: $REMOTE"
  REPO_SLUG="$(repo_slug)"

  if [[ "$WATCH_LATEST" == true && -z "$VERSION" ]]; then
    need_cmd gh
    return 0
  fi

  local current_branch
  current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
  if [[ "$RESUME" != true && "$DELETE_TAG" != true ]]; then
    [[ -n "$current_branch" ]] || die "Detached HEAD is not supported for release tagging"
    if [[ "$current_branch" != "$EXPECTED_BRANCH" ]]; then
      confirm "Current branch is '$current_branch', expected '$EXPECTED_BRANCH'. Continue anyway?" || die "Release aborted"
    fi
  fi

  local status
  status="$(git status --porcelain --untracked-files=normal)"
  if [[ -n "$status" && "$ALLOW_DIRTY" != true && "$RESUME" != true && "$DELETE_TAG" != true ]]; then
    die "Worktree is not clean. Commit/stash changes or pass --allow-dirty"$'\n'"$status"
  fi
  if [[ -n "$status" && "$RESUME" == true ]]; then
    warn "Resume mode ignores current worktree changes:"
    printf '%s\n' "$status" >&2
  fi

  if [[ "$NO_FETCH" != true ]]; then
    log "Fetching tags from $REMOTE"
    run git fetch "$REMOTE" --tags
  fi

  if [[ "$DELETE_TAG" == true ]]; then
    return 0
  fi

  if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    [[ "$RESUME" == true ]] || die "Local tag already exists: $TAG"
  fi
  if remote_tag_exists; then
    [[ "$RESUME" == true ]] || die "Remote tag already exists on $REMOTE: $TAG"
  elif [[ "$RESUME" == true ]]; then
    die "Cannot resume; remote tag does not exist on $REMOTE: $TAG"
  fi

  if [[ "$WATCH" == true || "$RESUME" == true ]]; then
    need_cmd gh
  fi
}

delete_tag() {
  [[ -n "$TAG" ]] || die "--delete-tag requires a version"
  confirm "Delete local and remote tag $TAG from $REMOTE?" || die "Delete aborted"
  run git tag -d "$TAG" || true
  run git push "$REMOTE" --delete "refs/tags/$TAG" || true
  log "Tag delete command finished for $TAG"
}

print_plan() {
  local branch previous_tag
  branch="$(git symbolic-ref --quiet --short HEAD || true)"
  previous_tag="$(previous_release_tag)"
  log "Release plan"
  cat <<EOF
  Mode:           $([[ "$RESUME" == true ]] && echo "resume existing tag" || echo "prepare new tag")
  Tag:            $TAG
  Repo:           $REPO_SLUG
  Branch:         ${branch:-<detached>}
  Previous tag:   ${previous_tag:-<none>}
  Refresh locks:  $([[ "$SKIP_LOCK" == true ]] && echo no || echo yes)
  Run checks:     $([[ "$SKIP_CHECKS" == true ]] && echo no || echo yes)
  Commit:         $([[ "$NO_COMMIT" == true || "$RESUME" == true ]] && echo no || echo yes)
  Tag:            $([[ "$NO_TAG" == true || "$RESUME" == true ]] && echo no || echo yes)
  Push:           $([[ "$PUSH" == true ]] && echo "atomic branch+tag" || echo no)
  Watch:          $([[ "$WATCH" == true ]] && echo yes || echo no)
  Workflow:       $RELEASE_WORKFLOW
EOF
}

update_versions() {
  log "Updating version files to $VERSION"
  python3 - "$VERSION" <<'PY'
import json
import re
import sys
from pathlib import Path

version = sys.argv[1]
json_files = [
    Path("package.json"),
    Path("apps/desktop/package.json"),
    Path("apps/desktop/src-tauri/tauri.conf.json"),
]
for path in json_files:
    data = json.loads(path.read_text(encoding="utf-8"))
    old = data.get("version")
    if old != version:
        data["version"] = version
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"updated {path}: {old} -> {version}")
    else:
        print(f"unchanged {path}: {version}")

for path in [Path("apps/desktop/src-tauri/Cargo.toml"), Path("pyproject.toml")]:
    text = path.read_text(encoding="utf-8")
    new_text, count = re.subn(r'^version = "[^"]*"', f'version = "{version}"', text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f"Could not update version in {path}")
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print(f"updated {path}: {version}")
    else:
        print(f"unchanged {path}: {version}")
PY
}

refresh_lockfiles() {
  if [[ "$SKIP_LOCK" == true ]]; then
    log "Skipping lockfile refresh"
    return 0
  fi
  need_cmd pnpm
  need_cmd uv
  log "Refreshing lockfiles"
  run pnpm install --lockfile-only --ignore-scripts
  run uv lock
}

run_checks() {
  if [[ "$SKIP_CHECKS" == true ]]; then
    log "Skipping checks"
    return 0
  fi
  log "Running release checks"
  run_shell "python scripts/verify_package_resources.py --source-only"
  run_shell "bash scripts/check-ci.sh"
}

release_notes() {
  local previous_tag range
  previous_tag="$(previous_release_tag)"
  range="HEAD"
  if [[ -n "$previous_tag" && "$previous_tag" != "$TAG" ]]; then
    range="$previous_tag..HEAD"
  fi
  git log --pretty=format:'- %s (%h)' --no-merges "$range" || true
}

commit_and_tag() {
  if [[ "$NO_COMMIT" == true ]]; then
    log "Skipping commit because --no-commit was provided"
    return 0
  fi
  log "Creating release commit"
  local paths=()
  for path in "${VERSION_FILES[@]}" "${LOCK_FILES[@]}"; do
    [[ -e "$path" ]] && paths+=("$path")
  done
  run git add "${paths[@]}"
  if git diff --cached --quiet --; then
    warn "No release metadata changes to commit; tagging current HEAD."
  else
    run git commit -m "chore(release): $TAG"
  fi

  if [[ "$NO_TAG" == true ]]; then
    log "Skipping tag because --no-tag was provided"
    return 0
  fi
  log "Creating annotated tag $TAG"
  local notes
  notes="$(release_notes)"
  [[ -n "$notes" ]] || notes="- Version metadata update."
  run git tag -a "$TAG" -m "KStock $TAG" -m "$notes"
}

push_release() {
  if [[ "$PUSH" != true ]]; then
    log "Local release is ready"
    cat <<EOF
Next manual command:
  git push --atomic $REMOTE $(git symbolic-ref --short HEAD) $TAG
EOF
    return 0
  fi
  confirm "Atomic-push branch and tag $TAG to $REMOTE now?" || die "Push aborted"
  local branch
  branch="$(git symbolic-ref --short HEAD)"
  if [[ "$NO_TAG" == true ]]; then
    run git push "$REMOTE" "$branch"
  else
    run git push --atomic "$REMOTE" "$branch" "$TAG"
  fi
}

find_release_run_id() {
  local runs_json="$1"
  RUNS_JSON="$runs_json" TAG="$TAG" python3 <<'PY'
import json
import os

runs = json.loads(os.environ.get("RUNS_JSON") or "[]")
tag = os.environ["TAG"]
# tag push 触发的 run 的 headBranch 就是 tag 名，重推同一 tag 后列表里会
# 出现多个同 tag 的 run；必须跳过已完成的旧 run，否则会 watch 到上一次
# 的失败 run（曾误命中 30834340557 导致 watch 立即失败）。
for run in runs:
    if run.get("headBranch") == tag and run.get("status") != "completed":
        print(run.get("databaseId", ""))
        break
PY
}

save_failure_logs() {
  local run_id="$1"
  mkdir -p "$RELEASE_LOG_DIR"
  local summary_path="$RELEASE_LOG_DIR/run-$run_id.json"
  local log_path="$RELEASE_LOG_DIR/run-$run_id.log"
  gh run view "$run_id" --repo "$REPO_SLUG" --json status,conclusion,jobs,url,name,displayTitle,event,headSha,createdAt,updatedAt >"$summary_path" 2>/dev/null || true
  gh run view "$run_id" --repo "$REPO_SLUG" --log-failed >"$log_path" 2>&1 || true
  warn "Saved failed run diagnostics:"
  warn "  $summary_path"
  warn "  $log_path"
}

watch_latest_run() {
  need_cmd gh
  local run_id
  run_id="$(gh run list --repo "$REPO_SLUG" --workflow "$RELEASE_WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
  [[ -n "$run_id" ]] || die "No release workflow runs found"
  log "Watching latest release run $run_id"
  if ! gh run watch "$run_id" --repo "$REPO_SLUG" --exit-status; then
    save_failure_logs "$run_id"
    exit 1
  fi
}

wait_for_release_run() {
  if [[ "$WATCH" != true || "$NO_TAG" == true || "$DRY_RUN" == true ]]; then
    return 0
  fi
  log "Waiting for GitHub Actions release run for $TAG"
  local run_id="" output=""
  for attempt in $(seq 1 30); do
    output="$(gh run list --repo "$REPO_SLUG" --workflow "$RELEASE_WORKFLOW" --limit 30 --json databaseId,event,headBranch,status,conclusion,displayTitle,createdAt)"
    run_id="$(find_release_run_id "$output")"
    if [[ -n "$run_id" ]]; then
      break
    fi
    printf 'Still waiting for run (%s/30)...\n' "$attempt"
    sleep 10
  done
  [[ -n "$run_id" ]] || die "No GitHub Actions run appeared for $TAG in $RELEASE_WORKFLOW"

  log "Watching GitHub Actions run $run_id"
  if ! gh run watch "$run_id" --repo "$REPO_SLUG" --exit-status; then
    save_failure_logs "$run_id"
    die "GitHub Actions release run failed: $run_id"
  fi
}

verify_release_assets() {
  if [[ "$DRY_RUN" == true || "$WATCH" != true || "$NO_TAG" == true ]]; then
    return 0
  fi
  log "Verifying GitHub Release assets for $TAG"
  local release_json
  release_json="$(gh release view "$TAG" --repo "$REPO_SLUG" --json tagName,url,assets)"
  RELEASE_JSON="$release_json" VERSION="$VERSION" python3 <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RELEASE_JSON"])
version = os.environ["VERSION"]
assets = [asset.get("name", "") for asset in data.get("assets", [])]

def has_suffix(suffix):
    return any(name.endswith(suffix) and (version in name or suffix == ".json") for name in assets)

checks = [
    ("macOS dmg", has_suffix(".dmg")),
    ("macOS updater archive", any(name.endswith(".app.tar.gz") for name in assets)),
    ("Windows installer", has_suffix(".msi") or has_suffix(".exe")),
    ("Linux package", has_suffix(".deb") or has_suffix(".rpm") or has_suffix(".AppImage")),
    ("latest.json", "latest.json" in assets),
]
missing = [label for label, ok in checks if not ok]
if missing:
    print(f"Release {data.get('tagName')} is missing expected assets:", file=sys.stderr)
    for label in missing:
        print(f"  - {label}", file=sys.stderr)
    print("Assets found:", file=sys.stderr)
    for name in sorted(assets):
        print(f"  - {name}", file=sys.stderr)
    sys.exit(1)

print(f"Release assets verified: {data.get('url', '<no url>')}")
for name in sorted(assets):
    print(f"  - {name}")
PY
}

main() {
  parse_args "$@"
  ensure_repo_state

  if [[ "$WATCH_LATEST" == true && -z "$VERSION" ]]; then
    watch_latest_run
    exit 0
  fi
  if [[ "$DELETE_TAG" == true ]]; then
    delete_tag
    exit 0
  fi

  print_plan
  if [[ "$DRY_RUN" == true ]]; then
    log "Dry run only; no files changed"
    exit 0
  fi
  if [[ "$RESUME" == true ]]; then
    wait_for_release_run
    verify_release_assets
    log "Release lifecycle complete for $TAG"
    exit 0
  fi
  confirm "Proceed with release $TAG?" || die "Release aborted"

  update_versions
  refresh_lockfiles
  run_checks
  commit_and_tag
  push_release
  if [[ "$PUSH" == true ]]; then
    wait_for_release_run
    verify_release_assets
  fi
  log "Release lifecycle complete for $TAG"
}

main "$@"
