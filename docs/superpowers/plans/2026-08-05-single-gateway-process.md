# Single Gateway Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Tauri -> Python supervisor -> Python worker` with one Rust-owned `Tauri -> gateway --serve` process in development and release builds.

**Architecture:** `GatewayProcess` is the only desktop lifecycle owner and directly launches the PyInstaller/source gateway with `--serve`. Python only hosts uvicorn. Settings restart invokes a Rust command and retains the current health polling.

**Tech Stack:** Tauri 2, Rust `std::process::Command`, PyInstaller, Python/FastAPI, React/TypeScript, Vitest, pytest.

---

## File Map

- Modify `apps/desktop/src-tauri/src/gateway.rs`: direct startup, port conflict handling, restart command, exit diagnostics.
- Modify `apps/desktop/src-tauri/src/main.rs`: register `gateway_restart`.
- Modify `apps/desktop/src/lib/gatewayControlClient.ts`: restart through Tauri invoke.
- Create `apps/desktop/tests/gatewayControlClient.spec.ts`: test invoke restart.
- Modify `scripts/run_gateway.py`: run uvicorn directly and remove supervisor routing.
- Delete `scripts/kstock_gateway_control.py`: remove the obsolete supervisor protocol.
- Delete `tests/test_kstock_gateway_control.py`: remove obsolete endpoint tests.
- Modify `tests/test_release_packaging.py`: lock the cross-language packaging contract.
- Modify `tests/test_run_gateway.py`: update lifecycle wording while preserving configuration tests.

### Task 1: Lock The Single-Process Contract

**Files:**
- Modify: `tests/test_release_packaging.py`

- [ ] **Step 1: Write failing source-contract tests**

```python
def test_tauri_starts_gateway_directly_in_serve_mode_without_stdin():
    source = Path("apps/desktop/src-tauri/src/gateway.rs").read_text(encoding="utf-8")
    assert '.arg("--serve")' in source
    assert ".stdin(Stdio::null())" in source
    assert "CREATE_NO_WINDOW" in source


def test_tauri_registers_gateway_restart_command():
    gateway = Path("apps/desktop/src-tauri/src/gateway.rs").read_text(encoding="utf-8")
    main = Path("apps/desktop/src-tauri/src/main.rs").read_text(encoding="utf-8")
    assert "pub fn gateway_restart(" in gateway
    assert "gateway::gateway_restart" in main


def test_packaged_gateway_has_no_python_supervisor_layer():
    source = Path("scripts/run_gateway.py").read_text(encoding="utf-8")
    assert "def _run_supervisor" not in source
    assert "KSTOCK_SUPERVISOR_PID" not in source
    assert "kstock_gateway_control" not in source
```

- [ ] **Step 2: Run tests and verify RED**

```bash
python -m pytest tests/test_release_packaging.py -q \
  -k 'starts_gateway_directly or registers_gateway_restart or no_python_supervisor'
```

Expected: three failures because Rust does not pass `--serve`, no restart command exists, and `_run_supervisor` remains.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/test_release_packaging.py
git commit -m "test: lock single gateway process contract"
```

### Task 2: Make Rust The Lifecycle Owner

**Files:**
- Modify: `apps/desktop/src-tauri/src/gateway.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Test: `tests/test_release_packaging.py`

- [ ] **Step 1: Launch one direct server child**

Keep the managed-child check first. If there is no live managed child and port 18001 is already open, return:

```rust
return Err(format!(
  "gateway 端口 {GATEWAY_PORT} 已被非托管进程占用；请先结束该进程后重试"
));
```

Configure the child with:

```rust
cmd
  .arg("--serve")
  .env("KSTOCK_APP_DATA_DIR", app_data_dir)
  .stdin(Stdio::null())
  .stdout(Stdio::from(log_file))
  .stderr(Stdio::from(stderr_file));
```

Preserve Unix process groups and Windows `CREATE_NO_WINDOW`. During the readiness loop, fail immediately if `child.try_wait()` returns a status, and include `desktop-gateway.log` in the error. On timeout, retain the child in state but return an error rather than reporting startup success.

- [ ] **Step 2: Add restart API and command**

```rust
pub fn restart(&self, app: &AppHandle) -> Result<String, String> {
  self.stop()?;
  self.ensure_started(app)
}

#[tauri::command]
pub fn gateway_restart(
  app: AppHandle,
  state: State<'_, GatewayProcess>,
) -> Result<String, String> {
  state.restart(&app)
}
```

Register `gateway::gateway_restart` in `tauri::generate_handler!` in `main.rs`.

- [ ] **Step 3: Verify Rust and focused tests GREEN**

```bash
python -m pytest tests/test_release_packaging.py -q \
  -k 'starts_gateway_directly or registers_gateway_restart'
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: focused pytest tests pass and `cargo check` exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/gateway.rs apps/desktop/src-tauri/src/main.rs
git commit -m "fix: let Tauri own the gateway process"
```

### Task 3: Remove The Python Supervisor

**Files:**
- Modify: `scripts/run_gateway.py`
- Delete: `scripts/kstock_gateway_control.py`
- Delete: `tests/test_kstock_gateway_control.py`
- Modify: `tests/test_run_gateway.py`

- [ ] **Step 1: Remove supervisor-only code**

Delete `_run_supervisor`, remove the `kstock_gateway_control` import/router, and make the executable entry direct:

```python
if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8", errors="replace")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8", errors="replace")
    _setup_bundled_python_env()
    _run_server()
```

Delete `scripts/kstock_gateway_control.py` and its tests. Update `tests/test_run_gateway.py` comments from “supervisor restarts child” to “Rust restarts executable”; keep the persistence assertions unchanged.

- [ ] **Step 2: Verify Python tests GREEN**

```bash
python -m pytest tests/test_release_packaging.py tests/test_run_gateway.py -q
```

Expected: all selected tests pass.

- [ ] **Step 3: Verify protocol removal**

```bash
rg -n "_run_supervisor|KSTOCK_SUPERVISOR_PID|RESTART_EXIT_CODE|kstock_gateway_control" \
  scripts apps/desktop/src tests -g '*.py' -g '*.rs' -g '*.ts' -g '*.tsx'
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add scripts/run_gateway.py scripts/kstock_gateway_control.py \
  tests/test_kstock_gateway_control.py tests/test_run_gateway.py
git commit -m "refactor: remove Python gateway supervisor"
```

### Task 4: Restart Through Tauri

**Files:**
- Create: `apps/desktop/tests/gatewayControlClient.spec.ts`
- Modify: `apps/desktop/src/lib/gatewayControlClient.ts`

- [ ] **Step 1: Write failing Vitest tests**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("gatewayControlClient", () => {
  beforeEach(() => invoke.mockReset());

  it("restarts through the Tauri owner", async () => {
    invoke.mockResolvedValue("gateway 已启动");
    const { restartGateway } = await import("../src/lib/gatewayControlClient");
    await expect(restartGateway()).resolves.toBe("gateway 已启动");
    expect(invoke).toHaveBeenCalledWith("gateway_restart");
  });

  it("reports a missing Tauri host", async () => {
    invoke.mockRejectedValue(new Error("not in Tauri"));
    const { restartGateway } = await import("../src/lib/gatewayControlClient");
    await expect(restartGateway()).rejects.toEqual({
      message: "无法请求桌面端重启 gateway",
      status: 0,
    });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm -C apps/desktop exec vitest run tests/gatewayControlClient.spec.ts
```

Expected: failures because restart still uses HTTP.

- [ ] **Step 3: Replace HTTP restart**

```typescript
export async function restartGateway(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("gateway_restart");
  } catch {
    throw {
      message: "无法请求桌面端重启 gateway",
      status: 0,
    } satisfies GatewayControlApiError;
  }
}
```

Keep `waitForGateway` unchanged and update comments to describe Rust ownership.

- [ ] **Step 4: Run and verify GREEN**

```bash
pnpm -C apps/desktop exec vitest run tests/gatewayControlClient.spec.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/gatewayControlClient.ts \
  apps/desktop/tests/gatewayControlClient.spec.ts
git commit -m "fix: restart gateway through Tauri"
```

### Task 5: Full Verification

**Files:** Verify only.

- [ ] **Step 1: Run focused Python tests**

```bash
python -m pytest tests/test_release_packaging.py tests/test_run_gateway.py -q
```

- [ ] **Step 2: Run all desktop tests**

```bash
pnpm -C apps/desktop test
```

- [ ] **Step 3: Compile and build without bundles**

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm -C apps/desktop exec tauri build --no-bundle --debug
```

- [ ] **Step 4: Check the diff**

```bash
git diff --check
```

Expected for all steps: exit 0 and no test failures.

- [ ] **Step 5: Record Windows-only verification**

After the next Windows build, run:

```powershell
Get-Process kstock-gateway -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,Path
Test-NetConnection localhost -Port 18001
```

Expected after startup and two settings restarts: one gateway process, port 18001 reachable, and no terminal window.
