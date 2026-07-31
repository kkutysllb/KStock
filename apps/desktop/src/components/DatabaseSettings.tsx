import { useCallback, useEffect, useState } from "react";
import { Database, AlertTriangle } from "lucide-react";
import {
  type DatabaseConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, type FieldDef } from "./RuntimeConfigCard";

/**
 * 数据与持久化设置页。
 *
 * 编辑 runtime.yaml 的 database 段。引擎热重载能更新部分字段（如
 * pool_size），但 backend / checkpoint_channel_mode 等是 restart-required，
 * 保存后需要重启 gateway 才真正切换后端。
 */
export function DatabaseSettings() {
  const [dbConfig, setDbConfig] = useState<DatabaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setDbConfig(rc.database);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载数据库配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = useCallback(async (value: Record<string, unknown>) => {
    await updateRuntimeConfigSection("database", value as unknown as DatabaseConfig);
    setDbConfig(value as unknown as DatabaseConfig);
  }, []);

  if (loading) {
    return (
      <div className="database-settings">
        <p className="memory-loading">加载数据库配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="database-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!dbConfig) {
    return null;
  }

  return (
    <div className="database-settings">
      <section className="settings-card database-notice-card" aria-label="注意事项">
        <div className="database-notice">
          <AlertTriangle size={16} />
          <p>
            <strong>后端切换需重启 gateway 生效。</strong>
            backend、checkpoint_channel_mode 等是 restart-required 字段；
            保存后写入 runtime.yaml，但运行中的连接池不会切换。pool_recycle、
            command_timeout 等可热重载。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="数据库配置"
        description="统一存储后端：memory（开发，不持久化）/ sqlite（单节点）/ postgres（多节点）。"
        fields={DATABASE_FIELDS}
        initialValue={dbConfig as unknown as Record<string, unknown>}
        onSave={handleSave}
        savedHint="已写入 runtime.yaml。backend 等字段需重启 gateway 生效。"
      />

      <section className="settings-card database-current-card" aria-label="当前生效配置">
        <div className="database-current-header">
          <Database size={16} />
          <strong>当前 runtime.yaml 值</strong>
        </div>
        <dl className="database-current-list">
          <div>
            <dt>后端</dt>
            <dd>{dbConfig.backend}</dd>
          </div>
          {dbConfig.backend === "sqlite" && (
            <div>
              <dt>SQLite 目录</dt>
              <dd className="mono">{dbConfig.sqlite_dir}</dd>
            </div>
          )}
          {dbConfig.backend === "postgres" && (
            <div>
              <dt>Postgres URL</dt>
              <dd className="mono">{maskUrl(dbConfig.postgres_url)}</dd>
            </div>
          )}
          <div>
            <dt>Checkpoint 模式</dt>
            <dd>{dbConfig.checkpoint_channel_mode}</dd>
          </div>
          <div>
            <dt>连接池大小</dt>
            <dd>{dbConfig.pool_size}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

// ── 字段定义 ────────────────────────────────────────────────────────

const DATABASE_FIELDS: FieldDef[] = [
  {
    key: "backend",
    label: "存储后端",
    type: "select",
    hint: "memory 不持久化 / sqlite 单节点 / postgres 多节点",
    options: [
      { value: "memory", label: "memory（开发，重启丢失）" },
      { value: "sqlite", label: "sqlite（单节点）" },
      { value: "postgres", label: "postgres（多节点）" },
    ],
  },
  {
    key: "sqlite_dir",
    label: "SQLite 目录",
    type: "string",
    hint: "backend=sqlite 时生效。默认 .qilin/data",
    placeholder: ".qilin/data",
  },
  {
    key: "postgres_url",
    label: "Postgres URL",
    type: "string",
    hint: "backend=postgres 时生效。推荐用 $DATABASE_URL 引用 secrets.env",
    placeholder: "$DATABASE_URL",
  },
  {
    key: "checkpoint_channel_mode",
    label: "Checkpoint 通道模式",
    type: "select",
    hint: "full 完整消息 / delta 增量。重启生效",
    options: [
      { value: "full", label: "full（完整消息快照）" },
      { value: "delta", label: "delta（DeltaChannel 增量）" },
    ],
  },
  {
    key: "pool_size",
    label: "连接池大小",
    type: "number",
    min: 1,
    step: 1,
    hint: "postgres ORM 连接池",
  },
  {
    key: "pool_recycle",
    label: "连接回收秒数",
    type: "number",
    min: 1,
    step: 1,
    hint: "postgres 连接闲置回收",
  },
  {
    key: "command_timeout",
    label: "命令超时（秒）",
    type: "number",
    min: 1,
    step: 1,
    hint: "postgres 命令超时，留空禁用",
  },
];

/** 遮蔽 postgres_url 中的密码（展示用）。 */
function maskUrl(url: string): string {
  if (!url) return "—";
  if (url.startsWith("$")) return url;
  // postgresql://user:pass@host:5432/db → postgresql://user:***@host:5432/db
  return url.replace(/(\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}
