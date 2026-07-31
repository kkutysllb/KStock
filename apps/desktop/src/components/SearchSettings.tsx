import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type ToolSearchConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, type FieldDef } from "./RuntimeConfigCard";
import { McpExtensionsCard } from "./McpExtensionsCard";

/**
 * 搜索与来源设置页。
 *
 * 组合两个功能：
 *   - tool_search 段：工具延迟加载配置（enabled + auto_promote_top_k）
 *   - MCP extensions：Server 完整 CRUD（McpExtensionsCard 独立组件）
 */
export function SearchSettings() {
  const [toolSearchCfg, setToolSearchCfg] = useState<ToolSearchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setToolSearchCfg(rc.tool_search);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载搜索配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSaveToolSearch = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("tool_search", value);
    setToolSearchCfg(value as unknown as ToolSearchConfig);
  }, []);

  if (loading) {
    return (
      <div className="search-settings">
        <p className="memory-loading">加载搜索配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!toolSearchCfg) return null;

  return (
    <div className="search-settings">
      <section className="settings-card database-notice-card" aria-label="注意事项">
        <div className="database-notice">
          <AlertTriangle size={16} />
          <p>
            <strong>MCP server 变更需重启 gateway 生效。</strong>
            新增/修改/删除 MCP server 后写入 extensions_config.json，
            但运行中的 MCP 连接不会切换。tool_search 开关也需重启生效。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="工具延迟加载"
        description="开启后 MCP 工具不预加载到上下文，而是通过 tool_search 工具按需发现。减少上下文占用。"
        fields={TOOL_SEARCH_FIELDS}
        initialValue={toolSearchCfg as unknown as Record<string, unknown>}
        onSave={handleSaveToolSearch}
        savedHint="已写入 runtime.yaml。需重启 gateway 生效。"
      />

      <McpExtensionsCard />
    </div>
  );
}

// ── 字段定义 ────────────────────────────────────────────────────────

const TOOL_SEARCH_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用延迟加载",
    type: "boolean",
    hint: "MCP 工具不预加载，通过 tool_search 按需发现",
  },
  {
    key: "auto_promote_top_k",
    label: "自动提升上限",
    type: "number",
    min: 1,
    max: 5,
    step: 1,
    hint: "每次模型调用自动提升的 MCP 工具 schema 最大数（1-5）",
  },
];
