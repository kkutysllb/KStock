import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, Users } from "lucide-react";
import {
  type SubagentsConfig,
  type CustomSubagentConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, TOKEN_BUDGET_FIELDS, type FieldDef } from "./RuntimeConfigCard";

/**
 * 子代理设置页。
 *
 * 上半部分：全局参数（timeout_seconds / max_turns / max_total_per_run）—— 复用
 * RuntimeConfigCard 做受控编辑 + dirty 检测 + 保存。
 *
 * 中部：Token 预算（subagents.token_budget）—— 子代理每次运行的独立预算，与主代理
 * 分开；未配置时引擎默认开启（200 万兑底）。保存时写入显式配置段。
 *
 * 下半部分：预置角色卡片列表（custom_agents）—— 只读展示。每个角色可展开看
 * 完整 system_prompt。暂不做 custom_agents 的 CRUD（角色由产品模板定义，用户级
 * 编辑低频，后续按需加）。
 *
 * 预置角色来自 config/qilin.config.yaml 模板的 subagents.custom_agents 段，首次
 * 启动复制到 runtime.yaml，老用户走增量合并（_generate_runtime_config）。
 */
export function SubagentsSettings() {
  const [subagentsCfg, setSubagentsCfg] = useState<SubagentsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setSubagentsCfg(rc.subagents);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载子代理配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSaveGlobal = useCallback(
    async (value: Record<string, unknown>) => {
      await updateRuntimeConfigSection("subagents", value);
      // 重载以反映后端回填的默认值
      await reload();
    },
    [reload]
  );

  const handleSaveBudget = useCallback(
    async (value: Record<string, unknown>) => {
      await updateRuntimeConfigSection("subagents", {
        ...extractGlobalFields(subagentsCfg!),
        token_budget: value,
      });
      await reload();
    },
    [reload, subagentsCfg]
  );

  const customAgentsEntries = useMemo(() => {
    if (!subagentsCfg?.custom_agents) return [];
    return Object.entries(subagentsCfg.custom_agents).sort(([a], [b]) => a.localeCompare(b));
  }, [subagentsCfg]);

  if (loading) {
    return (
      <div className="subagents-settings">
        <p className="memory-loading">加载子代理配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subagents-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!subagentsCfg) return null;

  return (
    <div className="subagents-settings">
      <section className="settings-card database-notice-card" aria-label="子代理说明">
        <div className="database-notice">
          <Info size={16} />
          <p>
            <strong>预置角色由产品模板定义。</strong>
            以下 5 个角色覆盖 KStock 全业务线（行情 / 个股 / 缠论 / 回测 / 报告），
            首次启动自动写入 runtime.yaml。Lead Agent 在任务编排时会按角色精准分派。
            角色定义权威，模板升级时自动同步（用户改动会被覆盖）。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="全局参数"
        description="子代理系统的默认超时、最大轮次和每轮总上限。各角色的独立超时/轮次在其卡片内展示。"
        fields={GLOBAL_FIELDS}
        initialValue={extractGlobalFields(subagentsCfg)}
        onSave={handleSaveGlobal}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <RuntimeConfigCard
        title="Token 预算"
        description="子代理每次运行的独立 token 预算（与主代理分开，未配置时引擎默认开启 200 万兑底）。关闭 = 子代理不设预算限制，极端任务可能烧大量 token，不建议。需重启 gateway 生效。"
        fields={TOKEN_BUDGET_FIELDS}
        initialValue={(subagentsCfg.token_budget ?? {}) as unknown as Record<string, unknown>}
        onSave={handleSaveBudget}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <section className="settings-card subagents-roles-card" aria-label="预置角色">
        <div className="subagents-roles-header">
          <Users size={18} />
          <h2>预置角色（{customAgentsEntries.length} 个）</h2>
        </div>
        {customAgentsEntries.length === 0 ? (
          <p className="memory-loading">
            未加载到预置角色。请重启 gateway 触发 runtime.yaml 增量合并。
          </p>
        ) : (
          <div className="subagents-roles-list">
            {customAgentsEntries.map(([name, agent]) => (
              <SubagentRoleCard key={name} name={name} agent={agent} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── 角色卡片（只读 + 可展开 system_prompt）──────────────────────────

function SubagentRoleCard({
  name,
  agent,
}: {
  name: string;
  agent: CustomSubagentConfig;
}) {
  const [expanded, setExpanded] = useState(false);

  const toolsLabel = agent.tools === null
    ? "继承全部工具"
    : agent.tools.length === 0
      ? "无工具"
      : agent.tools.join(", ");
  const skillsLabel = agent.skills === null
    ? "继承全部技能"
    : agent.skills.length === 0
      ? "无技能"
      : agent.skills.join(", ");

  return (
    <div className="subagent-role-card" role="article" aria-label={name}>
      <button
        type="button"
        className="subagent-role-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="subagent-role-chevron">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="subagent-role-title">
          <strong className="subagent-role-name">{name}</strong>
          <span className="subagent-role-desc">
            {agent.description.split("\n")[0]}
          </span>
        </div>
        <span className="subagent-role-meta">
          {agent.model === "inherit" ? "继承模型" : agent.model} ·{" "}
          {agent.max_turns} 轮 · {agent.timeout_seconds}s
        </span>
      </button>

      <div className="subagent-role-badges">
        <span className="subagent-badge subagent-badge-tools">
          工具：{toolsLabel}
        </span>
        <span className="subagent-badge subagent-badge-skills">
          技能：{skillsLabel}
        </span>
        {agent.disallowed_tools && agent.disallowed_tools.length > 0 && (
          <span className="subagent-badge subagent-badge-disallowed">
            禁用：{agent.disallowed_tools.join(", ")}
          </span>
        )}
      </div>

      {expanded && (
        <div className="subagent-role-prompt">
          <p className="subagent-role-prompt-label">System Prompt</p>
          <pre className="subagent-role-prompt-text">{agent.system_prompt}</pre>
        </div>
      )}
    </div>
  );
}

// ── 字段定义与工具 ────────────────────────────────────────────────────

const GLOBAL_FIELDS: FieldDef[] = [
  {
    key: "timeout_seconds",
    label: "默认超时（秒）",
    type: "number",
    min: 1,
    step: 60,
    hint: "内置子代理的默认超时（custom_agents 用各自的 timeout_seconds）",
  },
  {
    key: "max_turns",
    label: "默认最大轮次",
    type: "number",
    min: 1,
    step: 1,
    hint: "留空（0）= 保持引擎内置默认值",
  },
  {
    key: "max_total_per_run",
    label: "每轮总上限",
    type: "number",
    min: 1,
    max: 50,
    step: 1,
    hint: "一次 Lead Agent 运行中允许的子代理分派总数（1-50）",
  },
];

/** 从 SubagentsConfig 提取全局参数子集（RuntimeConfigCard 只编辑这三个字段）。
 * 完整回传 token_budget / agents / custom_agents，避免保存时整段替换丢掉未编辑字段。 */
function extractGlobalFields(cfg: SubagentsConfig): Record<string, unknown> {
  return {
    timeout_seconds: cfg.timeout_seconds,
    max_turns: cfg.max_turns ?? 0,
    max_total_per_run: cfg.max_total_per_run,
    // 保留 token_budget / agents / custom_agents，保存时回传给后端
    token_budget: cfg.token_budget,
    agents: cfg.agents,
    custom_agents: cfg.custom_agents,
  };
}
