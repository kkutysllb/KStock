import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type GuardrailsConfig,
  type AuthorizationConfig,
  type InputPolishConfig,
  type LoopDetectionConfig,
  type SafetyFinishReasonConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, type FieldDef } from "./RuntimeConfigCard";

/**
 * 权限与护栏设置页。
 *
 * 编辑 runtime.yaml 的五个安全相关段：
 *   - guardrails：工具调用前 provider 审批
 *   - authorization：RBAC 细粒度资源授权
 *   - input_polish：发送前输入清洗
 *   - loop_detection：重复调用循环检测
 *   - safety_finish_reason：provider 安全 finish_reason 拦截
 *
 * 所有中间件在启动时初始化，保存后需重启 gateway 生效。
 * provider / detectors 等嵌套结构不暴露到 UI（太复杂），用户需直接编辑 yaml。
 */
export function GuardrailsSettings() {
  const [guardrailsCfg, setGuardrailsCfg] = useState<GuardrailsConfig | null>(null);
  const [authzCfg, setAuthzCfg] = useState<AuthorizationConfig | null>(null);
  const [inputPolishCfg, setInputPolishCfg] = useState<InputPolishConfig | null>(null);
  const [loopCfg, setLoopCfg] = useState<LoopDetectionConfig | null>(null);
  const [safetyCfg, setSafetyCfg] = useState<SafetyFinishReasonConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setGuardrailsCfg(rc.guardrails);
      setAuthzCfg(rc.authorization);
      setInputPolishCfg(rc.input_polish);
      setLoopCfg(rc.loop_detection);
      setSafetyCfg(rc.safety_finish_reason);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载护栏配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSaveGuardrails = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("guardrails", value);
    setGuardrailsCfg(value as unknown as GuardrailsConfig);
  }, []);

  const handleSaveAuthz = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("authorization", value);
    setAuthzCfg(value as unknown as AuthorizationConfig);
  }, []);

  const handleSaveInputPolish = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("input_polish", value);
    setInputPolishCfg(value as unknown as InputPolishConfig);
  }, []);

  const handleSaveLoop = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("loop_detection", value);
    setLoopCfg(value as unknown as LoopDetectionConfig);
  }, []);

  const handleSaveSafety = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("safety_finish_reason", value);
    setSafetyCfg(value as unknown as SafetyFinishReasonConfig);
  }, []);

  // authorization.enabled 依赖 provider：provider 未配置时禁用开关，
  // 避免 enabled=true + provider=null 的自相矛盾状态导致 gateway 每请求报错。
  // useMemo 必须在所有 early return 之前调用（React Hooks 顺序规则）。
  const authorizationFields = useMemo(
    () => buildAuthorizationFields(authzCfg?.provider ?? null),
    [authzCfg?.provider],
  );

  if (loading) {
    return (
      <div className="guardrails-settings">
        <p className="memory-loading">加载护栏配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guardrails-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!guardrailsCfg || !authzCfg || !inputPolishCfg || !loopCfg || !safetyCfg) {
    return null;
  }

  const authzProviderMissing = authzCfg.provider == null;

  return (
    <div className="guardrails-settings">
      <section className="settings-card database-notice-card" aria-label="注意事项">
        <div className="database-notice">
          <AlertTriangle size={16} />
          <p>
            <strong>护栏配置需重启 gateway 生效。</strong>
            所有安全中间件在启动时初始化，保存后写入 runtime.yaml，
            但运行中的中间件不会切换。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="护栏中间件"
        description="工具调用前过 provider 审批。provider 配置（类路径 + kwargs）需直接编辑 yaml。"
        fields={GUARDRAILS_FIELDS}
        initialValue={guardrailsCfg as unknown as Record<string, unknown>}
        onSave={handleSaveGuardrails}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="资源授权"
        description={
          authzProviderMissing
            ? "RBAC 细粒度资源权限控制。当前未配置 provider——需先在 runtime.yaml 添加 authorization.provider.use 才能启用。"
            : "RBAC 细粒度资源权限控制。provider 配置需直接编辑 yaml。"
        }
        fields={authorizationFields}
        initialValue={authzCfg as unknown as Record<string, unknown>}
        onSave={handleSaveAuthz}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="输入清洗"
        description="发送前润色和结构化用户输入，提升 agent 理解质量。"
        fields={INPUT_POLISH_FIELDS}
        initialValue={inputPolishCfg as unknown as Record<string, unknown>}
        onSave={handleSaveInputPolish}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="循环检测"
        description="检测重复工具调用循环。相同工具集达到告警阈值时注入警告，达到硬停止阈值时中止。"
        fields={LOOP_DETECTION_FIELDS}
        initialValue={loopCfg as unknown as Record<string, unknown>}
        onSave={handleSaveLoop}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="安全 finish_reason 拦截"
        description="provider 返回 content_filter 等安全终止信号时，抑制半截断的工具调用。"
        fields={SAFETY_FINISH_FIELDS}
        initialValue={safetyCfg as unknown as Record<string, unknown>}
        onSave={handleSaveSafety}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />
    </div>
  );
}

// ── 字段定义 ────────────────────────────────────────────────────────

const GUARDRAILS_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用护栏",
    type: "boolean",
    hint: "工具调用前过 provider 审批",
  },
  {
    key: "fail_closed",
    label: "失败即拒绝",
    type: "boolean",
    hint: "provider 报错时阻断工具调用",
  },
  {
    key: "passport",
    label: "Passport",
    type: "nullable-string",
    hint: "OAP passport 路径或 hosted agent ID",
    placeholder: "留空 = 不使用 passport",
  },
];

/**
 * 构造 authorization 字段定义。enabled 依赖 provider：
 * provider 为 null 时禁用开关并显示警告，防止写入 enabled=true + provider=null
 * 的自相矛盾状态（会导致 gateway 每次路由请求报错）。
 */
function buildAuthorizationFields(provider: AuthorizationConfig["provider"]): FieldDef[] {
  const providerMissing = provider == null;
  return [
    {
      key: "enabled",
      label: "启用资源授权",
      type: "boolean",
      hint: "RBAC 细粒度资源权限控制",
      disabled: providerMissing,
      disabledReason: providerMissing
        ? "需先在 runtime.yaml 配置 authorization.provider.use（如 qilin.authz.rbac:RbacAuthorizationProvider）才能启用"
        : undefined,
    },
    {
      key: "fail_closed",
      label: "失败即拒绝",
      type: "boolean",
      hint: "provider 报错或身份未解析时阻断访问",
    },
    {
      key: "default_role",
      label: "默认角色",
      type: "string",
      hint: "未识别身份时分配的角色（如 user / admin）",
    },
  ];
}

const INPUT_POLISH_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用清洗",
    type: "boolean",
    hint: "发送前润色和结构化用户输入",
  },
  {
    key: "max_chars",
    label: "最大字符数",
    type: "number",
    min: 1,
    step: 100,
    hint: "清洗端点接受的草稿最大长度",
  },
  {
    key: "model_name",
    label: "模型名",
    type: "nullable-string",
    hint: "留空 = 用默认模型",
    placeholder: "留空 = 使用默认模型",
  },
];

const LOOP_DETECTION_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用检测",
    type: "boolean",
    hint: "检测重复工具调用循环",
  },
  {
    key: "warn_threshold",
    label: "告警阈值",
    type: "number",
    min: 1,
    step: 1,
    hint: "相同工具集出现 N 次后注入警告",
  },
  {
    key: "hard_limit",
    label: "硬停止阈值",
    type: "number",
    min: 1,
    step: 1,
    hint: "相同工具集出现 N 次后强制停止（必须 >= 告警阈值）",
  },
  {
    key: "window_size",
    label: "窗口大小",
    type: "number",
    min: 1,
    step: 1,
    hint: "每个线程追踪的最近工具集数量",
  },
  {
    key: "max_tracked_threads",
    label: "最大追踪线程数",
    type: "number",
    min: 1,
    step: 10,
    hint: "内存中保留的线程历史数量",
  },
  {
    key: "tool_freq_warn",
    label: "工具频率告警",
    type: "number",
    min: 1,
    step: 1,
    hint: "同一工具调用 N 次后注入频率警告",
  },
  {
    key: "tool_freq_hard_limit",
    label: "工具频率硬停止",
    type: "number",
    min: 1,
    step: 1,
    hint: "同一工具调用 N 次后强制停止",
  },
];

const SAFETY_FINISH_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用拦截",
    type: "boolean",
    hint: "provider 返回 content_filter 时抑制半截断的工具调用",
  },
];
