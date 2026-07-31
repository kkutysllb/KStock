import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw, Trash2, Plus, Pencil, Download, Upload, X } from "lucide-react";
import {
  type MemoryConfig,
  type MemoryData,
  type MemoryFact,
  getMemoryConfig,
  getMemoryStatus,
  reloadMemory,
  clearMemory,
  createFact,
  deleteFact,
  patchFact,
  exportMemory,
  importMemory,
  isMemoryApiError,
} from "../lib/memoryClient";
import {
  type RuntimeConfig,
  type MemoryRuntimeConfig,
  type SummarizationConfig,
  type TitleConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { ConfirmDialog } from "./ConfirmDialog";
import { RuntimeConfigCard, type FieldDef } from "./RuntimeConfigCard";

/**
 * 记忆与配置管理面板。
 *
 * 对接引擎 /api/memory/* 与 /api/memory/config：
 * - 顶部展示后端记忆配置（enabled / mode / injection / manager / backend knobs）
 * - 列表展示 user/history 上下文摘要 + facts（支持增删改）
 * - 危险操作（清空 / 导入覆盖）走 ConfirmDialog 二次确认
 * - GET /memory 在 minimal backend 下返回 501 → 配置区仍展示，数据区降级提示
 */
export function MemorySettings() {
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupportedData, setUnsupportedData] = useState(false);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [addingFact, setAddingFact] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<MemoryData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [refreshEffectedAt, setRefreshEffectedAt] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    setUnsupportedData(false);
    try {
      // 优先用 /memory/status 一次性拿 config + data
      try {
        const status = await getMemoryStatus();
        setConfig(status.config);
        setData(status.data);
      } catch (err) {
        if (isMemoryApiError(err) && err.status === 501) {
          // minimal backend：config 可读，data 不支持
          setUnsupportedData(true);
          const cfg = await getMemoryConfig();
          setConfig(cfg);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(isMemoryApiError(err) ? err.message : "加载记忆失败");
    } finally {
      setLoading(false);
    }
    // runtime.yaml 配置（读写层），独立加载，失败不阻断记忆事实面板
    try {
      const rc = await getRuntimeConfig();
      setRuntimeConfig(rc);
    } catch {
      // 忽略：配置编辑卡将在 runtimeConfig === null 时不渲染
    }
  }, []);

  // 保存 runtime.yaml 某段后，轮询刷新引擎只读生效值（热重载 1-2s 内生效）
  useEffect(() => {
    if (refreshEffectedAt === 0) return;
    let cancelled = false;
    const poll = async () => {
      // 重试 3 次，每次间隔 800ms
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 800));
        if (cancelled) return;
        try {
          const cfg = await getMemoryConfig();
          if (!cancelled) setConfig(cfg);
          return;
        } catch {
          // 继续重试
        }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [refreshEffectedAt]);

  const handleSaveSection = useCallback(
    async <S extends keyof RuntimeConfig>(section: S, value: RuntimeConfig[S]) => {
      await updateRuntimeConfigSection(section, value);
      setRuntimeConfig((prev) => (prev ? { ...prev, [section]: value } : prev));
      setRefreshEffectedAt(Date.now());
    },
    []
  );

  const handleSaveMemory = useCallback(
    (value: Record<string, unknown>) =>
      handleSaveSection("memory", value as unknown as MemoryRuntimeConfig),
    [handleSaveSection]
  );

  const handleSaveSummarization = useCallback(
    (value: Record<string, unknown>) =>
      handleSaveSection("summarization", value as unknown as SummarizationConfig),
    [handleSaveSection]
  );

  const handleSaveTitle = useCallback(
    (value: Record<string, unknown>) =>
      handleSaveSection("title", value as unknown as TitleConfig),
    [handleSaveSection]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // ── 操作包装：统一 busy/error 处理，成功后更新 data ──
  const runWithFeedback = useCallback(
    async (label: string, fn: () => Promise<MemoryData>) => {
      setBusy(true);
      setActionError(null);
      try {
        const next = await fn();
        setData(next);
        return true;
      } catch (err) {
        setActionError(isMemoryApiError(err) ? err.message : `${label}失败`);
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const handleReloadFromStore = useCallback(
    () => runWithFeedback("重新加载", () => reloadMemory()),
    [runWithFeedback]
  );

  const handleClearAll = useCallback(async () => {
    const ok = await runWithFeedback("清空记忆", () => clearMemory());
    if (ok) setPendingClear(false);
  }, [runWithFeedback]);

  const handleCreateFact = useCallback(
    async (payload: { content: string; category: string; confidence: number }) => {
      const ok = await runWithFeedback("新增记忆", () =>
        createFact(payload)
      );
      if (ok) setAddingFact(false);
    },
    [runWithFeedback]
  );

  const handleUpdateFact = useCallback(
    async (factId: string, patch: { content?: string; category?: string; confidence?: number }) => {
      const ok = await runWithFeedback("保存记忆", () => patchFact(factId, patch));
      if (ok) setEditingFactId(null);
    },
    [runWithFeedback]
  );

  const handleDeleteFact = useCallback(
    async (factId: string) => {
      await runWithFeedback("删除记忆", () => deleteFact(factId));
    },
    [runWithFeedback]
  );

  // ── 导出：下载 JSON ──
  const handleExport = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const exported = await exportMemory();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `kstock-memory-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(isMemoryApiError(err) ? err.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }, []);

  // ── 导入：读取文件 → 二次确认 → 覆盖 ──
  const handleImportFile = useCallback((file: File) => {
    setActionError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as MemoryData;
        setPendingImport(parsed);
      } catch {
        setActionError("文件不是有效的记忆 JSON");
      }
    };
    reader.onerror = () => setActionError("读取文件失败");
    reader.readAsText(file);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport) return;
    const ok = await runWithFeedback("导入记忆", () => importMemory(pendingImport));
    if (ok) setPendingImport(null);
  }, [pendingImport, runWithFeedback]);

  if (loading) {
    return (
      <div className="memory-settings">
        <p className="memory-loading">加载记忆配置…</p>
      </div>
    );
  }

  return (
    <div className="memory-settings">
      {(error || actionError) && (
        <p className="auth-error" role="alert">{error ?? actionError}</p>
      )}

      {config && <MemoryConfigCard config={config} />}

      {runtimeConfig && (
        <>
          <RuntimeConfigCard
            title="记忆机制配置"
            description="改写 runtime.yaml 的 memory 段。保存后引擎 1-2 秒内热重载，上方「生效值」随之刷新。"
            fields={MEMORY_FIELDS}
            initialValue={runtimeConfig.memory as unknown as Record<string, unknown>}
            onSave={handleSaveMemory}
            savedHint="已写入 runtime.yaml，引擎将在 1-2 秒内热重载。"
          />
          <RuntimeConfigCard
            title="摘要配置"
            description="长会话达到阈值时自动压缩历史。trigger 为 OR 逻辑（任一满足即触发）。"
            fields={SUMMARIZATION_FIELDS}
            initialValue={runtimeConfig.summarization as unknown as Record<string, unknown>}
            onSave={handleSaveSummarization}
            savedHint="已写入 runtime.yaml，引擎将在 1-2 秒内热重载。"
          />
          <RuntimeConfigCard
            title="标题生成配置"
            description="自动为每个会话生成标题。model_name 留空则用本地快途回退。"
            fields={TITLE_FIELDS}
            initialValue={runtimeConfig.title as unknown as Record<string, unknown>}
            onSave={handleSaveTitle}
            savedHint="已写入 runtime.yaml，引擎将在 1-2 秒内热重载。"
          />
        </>
      )}

      <section className="settings-card memory-actions-card" aria-label="记忆操作">
        <div className="memory-actions-header">
          <strong>数据操作</strong>
          <span className="memory-hint">
            {data ? `共 ${data.facts.length} 条记忆` : "当前后端不支持完整记忆文档"}
          </span>
        </div>
        <div className="memory-actions">
          <button
            className="pill-control"
            type="button"
            disabled={busy || unsupportedData}
            onClick={handleReloadFromStore}
            title="从存储文件重新加载（刷新缓存）"
          >
            <RefreshCw size={13} /> 重新加载
          </button>
          <button
            className="pill-control"
            type="button"
            disabled={busy || unsupportedData}
            onClick={handleExport}
            title="导出当前记忆为 JSON"
          >
            <Download size={13} /> 导出
          </button>
          <label
            className={`pill-control ${busy || unsupportedData ? "disabled" : ""}`}
            title="从 JSON 文件导入并覆盖当前记忆"
          >
            <Upload size={13} /> 导入
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy || unsupportedData}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          <button
            className="pill-control danger"
            type="button"
            disabled={busy || unsupportedData}
            onClick={() => setPendingClear(true)}
            title="清空所有记忆数据（不可恢复）"
          >
            <Trash2 size={13} /> 清空全部
          </button>
        </div>
      </section>

      {unsupportedData ? (
        <section className="settings-card memory-empty-card" aria-label="记忆数据不可用">
          <p className="memory-empty">
            当前后端记忆后端（{config?.manager_class ?? "unknown"}）不支持完整记忆文档读写。
            记忆事实的增删改依赖后端实现，已禁用。
          </p>
        </section>
      ) : data ? (
        <>
          <ContextSummaryCard data={data} />

          <section className="settings-card memory-facts-card" aria-label="记忆事实列表">
            <div className="memory-actions-header">
              <strong>记忆事实</strong>
              <button
                className="pill-control"
                type="button"
                disabled={busy}
                onClick={() => setAddingFact(true)}
              >
                <Plus size={13} /> 新增
              </button>
            </div>
            {data.facts.length === 0 ? (
              <p className="memory-empty">暂无记忆事实。点击「新增」手动添加一条。</p>
            ) : (
              <ul className="memory-fact-list">
                {data.facts.map((fact) => (
                  <FactRow
                    key={fact.id}
                    fact={fact}
                    editing={editingFactId === fact.id}
                    busy={busy}
                    onEdit={() => setEditingFactId(fact.id)}
                    onCancelEdit={() => setEditingFactId(null)}
                    onSave={(patch) => handleUpdateFact(fact.id, patch)}
                    onDelete={() => handleDeleteFact(fact.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {addingFact && (
        <FactEditDialog
          title="新增记忆事实"
          onCancel={() => setAddingFact(false)}
          onSubmit={handleCreateFact}
          busy={busy}
        />
      )}

      <ConfirmDialog
        open={pendingClear}
        title="清空所有记忆？"
        description="这将永久删除所有已保存的用户上下文、历史摘要与记忆事实。该操作不可恢复。"
        confirmText="清空"
        cancelText="取消"
        onConfirm={handleClearAll}
        onCancel={() => setPendingClear(false)}
      />

      <ConfirmDialog
        open={pendingImport !== null}
        title="导入并覆盖记忆？"
        description="导入的 JSON 将完全覆盖当前所有记忆数据（用户上下文、历史摘要与事实）。建议先导出当前记忆备份。"
        confirmText="覆盖导入"
        cancelText="取消"
        onConfirm={handleConfirmImport}
        onCancel={() => setPendingImport(null)}
      />
    </div>
  );
}

// ── 子组件：配置展示卡 ──────────────────────────────────────────────

function MemoryConfigCard({ config }: { config: MemoryConfig }) {
  const backendKnobs = useMemo(
    () => Object.entries(config.backend_config ?? {}),
    [config.backend_config]
  );

  return (
    <section className="settings-card memory-config-card" aria-label="记忆配置">
      <div className="memory-config-title">
        <Brain size={18} />
        <strong>记忆配置</strong>
        <em className={`memory-config-status ${config.enabled ? "on" : "off"}`}>
          {config.enabled ? "已启用" : "已停用"}
        </em>
      </div>
      <div className="memory-config-grid">
        <div className="memory-config-item">
          <span className="memory-config-key">运行模式</span>
          <span className="memory-config-val">
            {config.mode === "middleware" ? "中间件（被动摘要）" : "工具（模型主动调用）"}
          </span>
        </div>
        <div className="memory-config-item">
          <span className="memory-config-key">注入到系统提示</span>
          <span className="memory-config-val">{config.injection_enabled ? "开启" : "关闭"}</span>
        </div>
        <div className="memory-config-item">
          <span className="memory-config-key">关闭刷新超时</span>
          <span className="memory-config-val">{config.shutdown_flush_timeout_seconds}s</span>
        </div>
        <div className="memory-config-item">
          <span className="memory-config-key">后端</span>
          <span className="memory-config-val">{config.manager_class}</span>
        </div>
      </div>
      {backendKnobs.length > 0 && (
        <details className="memory-config-backend">
          <summary>后端私有配置（{backendKnobs.length}）</summary>
          <dl>
            {backendKnobs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{formatBackendValue(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

function formatBackendValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

// ── 子组件：上下文摘要（user / history）──────────────────────────────

function ContextSummaryCard({ data }: { data: MemoryData }) {
  const sections = useMemo(() => {
    const out: Array<{ label: string; summary: string; updatedAt: string }> = [];
    const push = (label: string, sec?: { summary?: string; updatedAt?: string }) => {
      if (sec && (sec.summary || sec.updatedAt)) {
        out.push({ label, summary: sec.summary ?? "（空）", updatedAt: sec.updatedAt ?? "" });
      }
    };
    if (data.user) {
      push("工作上下文", data.user.workContext);
      push("个人上下文", data.user.personalContext);
      push("当前关注", data.user.topOfMind);
    }
    if (data.history) {
      push("近月动态", data.history.recentMonths);
      push("更早上下文", data.history.earlierContext);
      push("长期背景", data.history.longTermBackground);
    }
    return out;
  }, [data]);

  if (sections.length === 0) return null;

  return (
    <section className="settings-card memory-context-card" aria-label="上下文摘要">
      <strong>上下文摘要</strong>
      <ul className="memory-context-list">
        {sections.map((s) => (
          <li key={s.label}>
            <div className="memory-context-label">
              <span>{s.label}</span>
              {s.updatedAt && <time>{formatTimestamp(s.updatedAt)}</time>}
            </div>
            <p className="memory-context-summary">{s.summary || "（空）"}</p>
          </li>
        ))}
      </ul>
      {data.lastUpdated && (
        <p className="memory-meta">最后更新：{formatTimestamp(data.lastUpdated)}</p>
      )}
    </section>
  );
}

// ── 子组件：单条 fact 行（展示/编辑/删除）────────────────────────────

function FactRow({
  fact,
  editing,
  busy,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  fact: MemoryFact;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: { content?: string; category?: string; confidence?: number }) => Promise<void>;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);

  if (editing) {
    return (
      <FactEditDialog
        title="编辑记忆事实"
        initial={fact}
        onCancel={onCancelEdit}
        onSubmit={onSave}
        busy={busy}
      />
    );
  }

  return (
    <li className="memory-fact-row">
      <div className="memory-fact-main">
        <p className="memory-fact-content">{fact.content}</p>
        <div className="memory-fact-meta">
          <span className="memory-fact-cat">{fact.category}</span>
          <span className="memory-fact-conf" title="置信度">
            置信度 {(fact.confidence * 100).toFixed(0)}%
          </span>
          {fact.createdAt && <time>{formatTimestamp(fact.createdAt)}</time>}
          {fact.source && fact.source !== "unknown" && (
            <span className="memory-fact-source" title="来源">来源：{fact.source}</span>
          )}
        </div>
      </div>
      <div className="memory-fact-actions">
        <button
          className="link-button"
          type="button"
          disabled={busy}
          onClick={onEdit}
          aria-label="编辑"
        >
          <Pencil size={13} />
        </button>
        <button
          className="link-button danger"
          type="button"
          disabled={busy}
          onClick={() => setConfirmDel(true)}
          aria-label="删除"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <ConfirmDialog
        open={confirmDel}
        title="删除该记忆？"
        description="删除后该事实将不再注入到后续对话的上下文中。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={() => { setConfirmDel(false); onDelete(); }}
        onCancel={() => setConfirmDel(false)}
      />
    </li>
  );
}

// ── 子组件：fact 新增/编辑弹层 ───────────────────────────────────────

const FACT_CATEGORIES = [
  "context",
  "preference",
  "instruction",
  "goal",
  "project",
  "other",
];

function FactEditDialog({
  title,
  initial,
  onCancel,
  onSubmit,
  busy,
}: {
  title: string;
  initial?: Pick<MemoryFact, "content" | "category" | "confidence">;
  onCancel: () => void;
  onSubmit: (payload: { content: string; category: string; confidence: number }) => Promise<void>;
  busy: boolean;
}) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial?.category ?? "context");
  const [confidence, setConfidence] = useState(initial?.confidence ?? 0.5);

  return (
    <div className="confirm-overlay" role="presentation">
      <div className="memory-fact-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="memory-fact-dialog-header">
          <strong>{title}</strong>
          <button className="link-button" type="button" onClick={onCancel} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
        <label className="memory-fact-field">
          <span>内容</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例如：用户偏好简洁回复，倾向使用 TypeScript"
            rows={4}
            autoFocus
          />
        </label>
        <div className="memory-fact-row-fields">
          <label className="memory-fact-field">
            <span>分类</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {FACT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="memory-fact-field">
            <span>置信度（{(confidence * 100).toFixed(0)}%）</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="memory-fact-dialog-actions">
          <button className="link-button" type="button" onClick={onCancel}>取消</button>
          <button
            className="hero-primary"
            type="button"
            disabled={busy || !content.trim()}
            onClick={() => onSubmit({ content: content.trim(), category, confidence })}
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 工具：时间格式化 ──

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── 配置字段定义（记忆/摘要/标题三段）──────────────────────────────

const MEMORY_FIELDS: FieldDef[] = [
  { key: "enabled", label: "启用记忆机制", type: "boolean", hint: "总开关（call-site gate）" },
  {
    key: "mode", label: "运行模式", type: "select",
    hint: "middleware 被动摘要 / tool 模型主动调用",
    options: [
      { value: "middleware", label: "中间件（被动摘要）" },
      { value: "tool", label: "工具（模型主动调用）" },
    ],
  },
  { key: "injection_enabled", label: "注入系统提示", type: "boolean", hint: "把记忆注入到 system prompt" },
  {
    key: "shutdown_flush_timeout_seconds", label: "关闭刷新超时", type: "number",
    min: 1, max: 300, step: 1, hint: "优雅关闭时刷入记忆的最大秒数",
  },
  {
    key: "manager_class", label: "后端选择器", type: "string",
    hint: "deermem / noop / mem0 或点分路径",
  },
];

const SUMMARIZATION_FIELDS: FieldDef[] = [
  { key: "enabled", label: "启用摘要", type: "boolean", hint: "长会话压缩" },
  {
    key: "model_name", label: "摘要模型", type: "nullable-string",
    hint: "留空 = 用运行模型生成",
  },
  {
    key: "trigger", label: "触发阈值", type: "context-size",
    hint: "达到阈值时触发压缩",
  },
  {
    key: "keep", label: "保留策略", type: "context-size",
    hint: "压缩后保留多少历史",
  },
  {
    key: "trim_tokens_to_summarize", label: "截断 token 上限", type: "number",
    min: 0, step: 100, hint: "准备消息时的最大 token 数",
  },
];

const TITLE_FIELDS: FieldDef[] = [
  { key: "enabled", label: "启用标题生成", type: "boolean" },
  { key: "max_words", label: "最大词数", type: "number", min: 1, max: 20, step: 1 },
  { key: "max_chars", label: "最大字符数", type: "number", min: 10, max: 200, step: 1 },
  {
    key: "model_name", label: "标题模型", type: "nullable-string",
    hint: "留空 = 本地快速回退",
  },
];
