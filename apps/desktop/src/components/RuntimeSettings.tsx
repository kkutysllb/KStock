import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type TokenUsageConfig,
  type TokenBudgetConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  updateTopLevelField,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, TOKEN_BUDGET_FIELDS, type FieldDef } from "./RuntimeConfigCard";
import { TokenStats } from "./TokenStats";

/**
 * 运行与预算设置页。
 *
 * 合并编辑 runtime.yaml 的三个运行时控制项：
 *   - token_usage 段：是否统计 token 用量
 *   - token_budget 段：硬预算限制（max_tokens / 阈值 / 预算耗尽自动续跑次数）
 *   - max_recursion_limit 顶层标量：agent 递归上限
 *
 * token 中间件在启动时初始化，保存后需重启 gateway 生效；
 * max_recursion_limit 是运行时参数，mtime 热重载即可生效。
 */
export function RuntimeSettings() {
  const [usageConfig, setUsageConfig] = useState<TokenUsageConfig | null>(null);
  const [budgetConfig, setBudgetConfig] = useState<TokenBudgetConfig | null>(null);
  const [recursionLimit, setRecursionLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setUsageConfig(rc.token_usage);
      setBudgetConfig(rc.token_budget);
      setRecursionLimit(rc.max_recursion_limit);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载运行预算配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSaveUsage = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("token_usage", value);
    setUsageConfig(value as unknown as TokenUsageConfig);
  }, []);

  const handleSaveBudget = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("token_budget", value);
    setBudgetConfig(value as unknown as TokenBudgetConfig);
  }, []);

  const handleSaveRecursion = useCallback(async (value: Record<string, unknown>) => {
    const num = value.max_recursion_limit as number;
    await updateTopLevelField("max_recursion_limit", num);
    setRecursionLimit(num);
  }, []);

  if (loading) {
    return (
      <div className="runtime-settings">
        <p className="memory-loading">加载运行预算配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="runtime-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!usageConfig || !budgetConfig || recursionLimit === null) {
    return null;
  }

  return (
    <div className="runtime-settings">
      <TokenStats />

      <section className="settings-card database-notice-card" aria-label="注意事项">
        <div className="database-notice">
          <AlertTriangle size={16} />
          <p>
            <strong>token 用量/预算需重启 gateway 生效。</strong>
            token_usage / token_budget 中间件在启动时初始化，保存后写入
            runtime.yaml，但运行中的中间件不会切换。<strong>max_recursion_limit</strong>
            是运行时参数，热重载即可生效。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="Token 用量统计"
        description="开启后引擎统计每次请求的输入/输出/总 token 数。需重启 gateway 生效。"
        fields={TOKEN_USAGE_FIELDS}
        initialValue={usageConfig as unknown as Record<string, unknown>}
        onSave={handleSaveUsage}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="Token 预算限制"
        description="超过告警阈值时记录日志；超过硬停止阈值时若续跑次数未耗尽则清零重计继续执行，否则中止请求。需重启 gateway 生效。"
        fields={TOKEN_BUDGET_FIELDS}
        initialValue={budgetConfig as unknown as Record<string, unknown>}
        onSave={handleSaveBudget}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="递归深度上限"
        description="agent 图单次会话的最大递归轮数。运行时参数，热重载即生效，无需重启。"
        fields={RECURSION_LIMIT_FIELDS}
        initialValue={{ max_recursion_limit: recursionLimit }}
        onSave={handleSaveRecursion}
        savedHint="已写入 runtime.yaml。引擎热重载即生效。"
      />
    </div>
  );
}

// ── 字段定义 ────────────────────────────────────────────────────────

const TOKEN_USAGE_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用统计",
    type: "boolean",
    hint: "统计每次请求的输入/输出/总 token",
  },
];

const RECURSION_LIMIT_FIELDS: FieldDef[] = [
  {
    key: "max_recursion_limit",
    label: "最大递归轮数",
    type: "number",
    min: 1,
    step: 1,
    hint: "agent 图单次会话的最大递归深度，防止无限循环",
  },
];
