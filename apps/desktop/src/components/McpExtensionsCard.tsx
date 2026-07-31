import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, RotateCcw, Save, X } from "lucide-react";
import {
  type ExtensionsConfig,
  type McpServerConfig,
  type McpTransportType,
  getExtensions,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  isExtensionsApiError,
} from "../lib/extensionsClient";

/**
 * MCP 扩展配置卡片。
 *
 * 不复用 RuntimeConfigCard——MCP server 是嵌套 dict 结构（type 切换时字段集变化），
 * 需要独立的动态表单。
 *
 * 功能：加载 getExtensions() → 展示 server 列表 → 新增/编辑/删除（CRUD）。
 */
export function McpExtensionsCard() {
  const [config, setConfig] = useState<ExtensionsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 编辑状态：null=列表模式, "new"=新建, string=编辑该 name
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<McpServerConfig | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ext = await getExtensions();
      setConfig(ext);
    } catch (err) {
      setError(isExtensionsApiError(err) ? err.message : "加载 MCP 配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── 编辑操作 ──

  const startCreate = useCallback(() => {
    setEditingName("new");
    setEditName("");
    setEditDraft(makeEmptyServer());
    setEditError(null);
  }, []);

  const startEdit = useCallback((name: string, server: McpServerConfig) => {
    setEditingName(name);
    setEditName(name);
    setEditDraft({ ...server });
    setEditError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingName(null);
    setEditDraft(null);
    setEditName("");
    setEditError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editDraft || !editingName) return;
    if (!editName.trim()) {
      setEditError("Server 名称不能为空");
      return;
    }
    // stdio 必须有 command；http/sse 必须有 url
    if (editDraft.type === "stdio" && !editDraft.command?.trim()) {
      setEditError("stdio 类型必须填写 command");
      return;
    }
    if ((editDraft.type === "http" || editDraft.type === "sse") && !editDraft.url?.trim()) {
      setEditError(`${editDraft.type} 类型必须填写 url`);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      if (editingName === "new") {
        await createMcpServer(editName.trim(), editDraft);
      } else {
        // 名字改了：先删旧的再创新的
        if (editName.trim() !== editingName) {
          await deleteMcpServer(editingName);
          await createMcpServer(editName.trim(), editDraft);
        } else {
          await updateMcpServer(editingName, editDraft);
        }
      }
      await reload();
      cancelEdit();
    } catch (err) {
      setEditError(isExtensionsApiError(err) ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [editDraft, editingName, editName, reload, cancelEdit]);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`确定删除 MCP server "${name}"？`)) return;
    try {
      await deleteMcpServer(name);
      await reload();
    } catch (err) {
      setError(isExtensionsApiError(err) ? err.message : "删除失败");
    }
  }, [reload]);

  const toggleEnabled = useCallback(async (name: string, server: McpServerConfig) => {
    try {
      await updateMcpServer(name, { ...server, enabled: !server.enabled });
      await reload();
    } catch (err) {
      setError(isExtensionsApiError(err) ? err.message : "更新失败");
    }
  }, [reload]);

  if (loading) {
    return (
      <section className="settings-card mcp-extensions-card">
        <p className="memory-loading">加载 MCP 配置…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="settings-card mcp-extensions-card">
        <p className="auth-error" role="alert">{error}</p>
      </section>
    );
  }

  if (!config) return null;

  const servers = Object.entries(config.mcpServers || {});

  return (
    <section className="settings-card mcp-extensions-card" aria-label="MCP 扩展配置">
      <div className="runtime-config-header">
        <div>
          <strong>MCP 扩展（Server 管理）</strong>
          <p className="runtime-config-desc">
            管理 MCP (Model Context Protocol) 扩展服务器。stdio = 本地子进程，http/sse = 远程服务器。
            修改后需重启 gateway 才能加载新 server。
          </p>
        </div>
        {editingName === null && (
          <button className="hero-primary" type="button" onClick={startCreate}>
            <Plus size={13} /> 新增 Server
          </button>
        )}
      </div>

      {/* 编辑/新建表单 */}
      {editingName !== null && editDraft && (
        <McpServerForm
          name={editName}
          onNameChange={setEditName}
          draft={editDraft}
          onDraftChange={setEditDraft}
          isNew={editingName === "new"}
          saving={saving}
          error={editError}
          onSave={handleSave}
          onCancel={cancelEdit}
        />
      )}

      {/* Server 列表 */}
      {editingName === null && (
        servers.length === 0 ? (
          <p className="mcp-empty">暂无 MCP server。点「新增 Server」添加。</p>
        ) : (
          <div className="mcp-server-list">
            {servers.map(([name, server]) => (
              <McpServerRow
                key={name}
                name={name}
                server={server}
                onToggleEnabled={() => toggleEnabled(name, server)}
                onEdit={() => startEdit(name, server)}
                onDelete={() => handleDelete(name)}
              />
            ))}
          </div>
        )
      )}
    </section>
  );
}

// ── Server 列表行 ──────────────────────────────────────────────────

function McpServerRow({
  name,
  server,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  name: string;
  server: McpServerConfig;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mcp-server-row">
      <div className="mcp-server-info">
        <label className="rcf-toggle">
          <input
            type="checkbox"
            checked={server.enabled}
            onChange={onToggleEnabled}
          />
          <span className="mcp-server-name">{name}</span>
        </label>
        <span className={`mcp-server-type mcp-type-${server.type}`}>{server.type}</span>
        {server.description && (
          <span className="mcp-server-desc">{server.description}</span>
        )}
      </div>
      <div className="mcp-server-actions">
        <button className="link-button" type="button" onClick={onEdit}>
          <Pencil size={13} /> 编辑
        </button>
        <button className="link-button" type="button" onClick={onDelete}>
          <Trash2 size={13} /> 删除
        </button>
      </div>
    </div>
  );
}

// ── 编辑表单 ────────────────────────────────────────────────────────

function McpServerForm({
  name,
  onNameChange,
  draft,
  onDraftChange,
  isNew,
  saving,
  error,
  onSave,
  onCancel,
}: {
  name: string;
  onNameChange: (v: string) => void;
  draft: McpServerConfig;
  onDraftChange: (v: McpServerConfig) => void;
  isNew: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const update = useCallback(
    <K extends keyof McpServerConfig>(key: K, value: McpServerConfig[K]) => {
      onDraftChange({ ...draft, [key]: value });
    },
    [draft, onDraftChange]
  );

  return (
    <div className="mcp-server-form">
      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="mcp-name">
          <span className="rcf-label-text">Server 名称</span>
          <span className="rcf-hint">唯一标识符（如 filesystem / brave-search）</span>
        </label>
        <div className="rcf-control">
          <input
            id="mcp-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={!isNew}
            placeholder="my-server"
          />
        </div>
      </div>

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="mcp-type">
          <span className="rcf-label-text">传输类型</span>
        </label>
        <div className="rcf-control">
          <select
            id="mcp-type"
            value={draft.type}
            onChange={(e) => update("type", e.target.value as McpTransportType)}
          >
            <option value="stdio">stdio（本地子进程）</option>
            <option value="http">http（远程 HTTP）</option>
            <option value="sse">sse（远程 SSE）</option>
          </select>
        </div>
      </div>

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="mcp-enabled">
          <span className="rcf-label-text">启用</span>
        </label>
        <div className="rcf-control">
          <label className="rcf-toggle">
            <input
              id="mcp-enabled"
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => update("enabled", e.target.checked)}
            />
            <span>{draft.enabled ? "开启" : "关闭"}</span>
          </label>
        </div>
      </div>

      <div className="rcf-field">
        <label className="rcf-label" htmlFor="mcp-desc">
          <span className="rcf-label-text">描述</span>
        </label>
        <div className="rcf-control">
          <input
            id="mcp-desc"
            type="text"
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="这个 server 提供什么能力？"
          />
        </div>
      </div>

      {/* stdio 字段 */}
      {draft.type === "stdio" && (
        <>
          <div className="rcf-field">
            <label className="rcf-label" htmlFor="mcp-command">
              <span className="rcf-label-text">Command</span>
              <span className="rcf-hint">启动命令（如 npx / node / python）</span>
            </label>
            <div className="rcf-control">
              <input
                id="mcp-command"
                type="text"
                value={draft.command ?? ""}
                onChange={(e) => update("command", e.target.value || null)}
                placeholder="npx"
              />
            </div>
          </div>

          <div className="rcf-field">
            <label className="rcf-label" htmlFor="mcp-args">
              <span className="rcf-label-text">Args</span>
              <span className="rcf-hint">命令参数，逗号分隔</span>
            </label>
            <div className="rcf-control">
              <input
                id="mcp-args"
                type="text"
                value={draft.args.join(", ")}
                onChange={(e) =>
                  update(
                    "args",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="-y, @modelcontextprotocol/server-filesystem"
              />
            </div>
          </div>

          <div className="rcf-field">
            <label className="rcf-label" htmlFor="mcp-env">
              <span className="rcf-label-text">环境变量</span>
              <span className="rcf-hint">KEY=VALUE 格式，每行一个</span>
            </label>
            <div className="rcf-control">
              <textarea
                id="mcp-env"
                rows={3}
                value={entriesToText(draft.env)}
                onChange={(e) => update("env", textToEntries(e.target.value))}
                placeholder={"API_KEY=xxx\nROOT=/tmp"}
              />
            </div>
          </div>
        </>
      )}

      {/* http/sse 字段 */}
      {(draft.type === "http" || draft.type === "sse") && (
        <>
          <div className="rcf-field">
            <label className="rcf-label" htmlFor="mcp-url">
              <span className="rcf-label-text">URL</span>
              <span className="rcf-hint">{draft.type === "http" ? "HTTP" : "SSE"} 端点地址</span>
            </label>
            <div className="rcf-control">
              <input
                id="mcp-url"
                type="text"
                value={draft.url ?? ""}
                onChange={(e) => update("url", e.target.value || null)}
                placeholder="https://api.example.com/mcp"
              />
            </div>
          </div>

          <div className="rcf-field">
            <label className="rcf-label" htmlFor="mcp-headers">
              <span className="rcf-label-text">Headers</span>
              <span className="rcf-hint">HTTP 请求头，KEY: VALUE 格式，每行一个</span>
            </label>
            <div className="rcf-control">
              <textarea
                id="mcp-headers"
                rows={3}
                value={entriesToText(draft.headers, ": ")}
                onChange={(e) => update("headers", textToEntries(e.target.value, ": "))}
                placeholder={"Authorization: Bearer token\nX-API-Version: 1"}
              />
            </div>
          </div>
        </>
      )}

      {/* 公共：超时 */}
      <div className="rcf-field">
        <label className="rcf-label" htmlFor="mcp-timeout">
          <span className="rcf-label-text">工具调用超时（秒）</span>
          <span className="rcf-hint">留空 = 不限制</span>
        </label>
        <div className="rcf-control">
          <input
            id="mcp-timeout"
            type="number"
            min={0}
            step={1}
            value={draft.tool_call_timeout ?? ""}
            onChange={(e) =>
              update("tool_call_timeout", e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="留空 = 不限制"
          />
        </div>
      </div>

      <div className="mcp-form-actions">
        <button className="hero-primary" type="button" onClick={onSave} disabled={saving}>
          <Save size={13} /> {saving ? "保存中…" : "保存"}
        </button>
        <button className="link-button" type="button" onClick={onCancel} disabled={saving}>
          <X size={13} /> 取消
        </button>
      </div>
    </div>
  );
}

// ── 工具函数 ────────────────────────────────────────────────────────

function makeEmptyServer(): McpServerConfig {
  return {
    enabled: true,
    type: "stdio",
    command: null,
    args: [],
    env: {},
    url: null,
    headers: {},
    description: "",
    tool_call_timeout: null,
  };
}

function entriesToText(entries: Record<string, string>, sep = "="): string {
  return Object.entries(entries)
    .map(([k, v]) => `${k}${sep}${v}`)
    .join("\n");
}

function textToEntries(text: string, sep = "="): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(sep);
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + sep.length).trim();
    if (key) result[key] = val;
  }
  return result;
}
