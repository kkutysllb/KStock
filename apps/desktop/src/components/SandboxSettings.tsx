import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type SandboxConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, type FieldDef } from "./RuntimeConfigCard";

/**
 * 工具与沙箱设置页。
 *
 * 编辑 runtime.yaml 的 sandbox 段。sandbox 是启动时初始化的，保存后需要
 * 重启 gateway 才能切换 provider 或更新运行时参数（配合设置页的「重启后端」按钮）。
 */
export function SandboxSettings() {
  const [sandboxConfig, setSandboxConfig] = useState<SandboxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setSandboxConfig(rc.sandbox);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载沙箱配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("sandbox", value);
    setSandboxConfig(value as unknown as SandboxConfig);
  }, []);

  if (loading) {
    return (
      <div className="sandbox-settings">
        <p className="memory-loading">加载沙箱配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sandbox-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!sandboxConfig) {
    return null;
  }

  return (
    <div className="sandbox-settings">
      <section className="settings-card database-notice-card" aria-label="注意事项">
        <div className="database-notice">
          <AlertTriangle size={16} />
          <p>
            <strong>沙箱配置需重启 gateway 生效。</strong>
            sandbox provider 和命令超时在启动时初始化，保存后写入 runtime.yaml，
            但运行中的沙箱不会切换。修改后请点设置页顶部的「重启后端」。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="沙箱配置"
        description="LocalSandboxProvider（本地执行）/ AioSandboxProvider（Docker 隔离）。控制 Host Bash 开关、命令超时和工具输出上限。"
        fields={SANDBOX_FIELDS}
        initialValue={sandboxConfig as unknown as Record<string, unknown>}
        onSave={handleSave}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />
    </div>
  );
}

// ── 字段定义 ────────────────────────────────────────────────────────

const SANDBOX_FIELDS: FieldDef[] = [
  {
    key: "use",
    label: "Sandbox Provider",
    type: "string",
    hint: "沙箱提供者类路径，默认 qilin.sandbox.local:LocalSandboxProvider",
    placeholder: "qilin.sandbox.local:LocalSandboxProvider",
  },
  {
    key: "allow_host_bash",
    label: "Host Bash",
    type: "boolean",
    hint: "允许 bash 直接在宿主机执行（危险，仅信任环境）",
  },
  {
    key: "bash_command_timeout",
    label: "命令超时（秒）",
    type: "number",
    min: 1,
    step: 1,
    hint: "bash 命令最长运行时间，超时自动终止进程组",
  },
  {
    key: "bash_output_max_chars",
    label: "Bash 输出上限（字符）",
    type: "number",
    min: 0,
    step: 1000,
    hint: "超出则中部截断（保留首尾），0 = 不截断",
  },
  {
    key: "read_file_output_max_chars",
    label: "读文件输出上限（字符）",
    type: "number",
    min: 0,
    step: 1000,
    hint: "超出则头部截断，0 = 不截断",
  },
  {
    key: "ls_output_max_chars",
    label: "LS 输出上限（字符）",
    type: "number",
    min: 0,
    step: 1000,
    hint: "超出则头部截断，0 = 不截断",
  },
];
