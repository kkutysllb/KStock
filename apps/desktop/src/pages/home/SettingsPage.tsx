/**
 * 设置页：分区菜单 + 各设置面板路由 + 后端维护操作条 + 模型配置 CRUD。
 * 从 Home.tsx 拆出（行为不变）。
 */
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { AccountSettings } from "../../components/AccountSettings";
import { AttachmentSettings } from "../../components/AttachmentSettings";
import { BrandMenu } from "../../components/BrandMenu";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DatabaseSettings } from "../../components/DatabaseSettings";
import { DataSourcesSettings } from "../../components/DataSourcesSettings";
import { GeneralSettings } from "../../components/GeneralSettings";
import { GuardrailsSettings } from "../../components/GuardrailsSettings";
import { McpExtensionsCard } from "../../components/McpExtensionsCard";
import { MemorySettings } from "../../components/MemorySettings";
import { ReportSettings } from "../../components/ReportSettings";
import { RuntimeSettings } from "../../components/RuntimeSettings";
import { SandboxSettings } from "../../components/SandboxSettings";
import { ScheduledTasksSettings } from "../../components/ScheduledTasksSettings";
import { SearchSettings } from "../../components/SearchSettings";
import { SidebarResizeHandle } from "../../components/SidebarResizeHandle";
import { SkillsExtensionsCard } from "../../components/SkillsExtensionsCard";
import { SubagentsSettings } from "../../components/SubagentsSettings";
import { isGatewayControlApiError, restartGateway, waitForGateway } from "../../lib/gatewayControlClient";
import { MODEL_TEMPLATES, SETTING_SECTIONS } from "../../lib/qilinSettings";
import {
  createModel,
  deleteModel,
  isModelsApiError,
  listModels,
  setDefaultModel,
  updateModel,
  type ModelConfig,
  type ModelWritePayload
} from "../../lib/modelsClient";
import type { AuthUser } from "../../lib/authClient";
import type { GeneralPreferences } from "../../lib/generalSettingsClient";
export function SettingsPage({
  activeSection,
  activeSectionId,
  currentUser,
  models,
  generalPreferences,
  sidebarWidth,
  onBack,
  onLogout,
  onSelectSection,
  onModelsChanged,
  onGeneralPreferencesChanged,
  onSidebarWidthChange,
}: {
  activeSection: (typeof SETTING_SECTIONS)[number];
  activeSectionId: string;
  currentUser: AuthUser | null;
  models: ModelConfig[];
  generalPreferences: GeneralPreferences;
  sidebarWidth: number;
  onBack: () => void;
  onLogout: () => void;
  onSelectSection: (id: string) => void;
  onModelsChanged?: (models: ModelConfig[], defaultModel: string | null) => void;
  onGeneralPreferencesChanged: (preferences: GeneralPreferences) => void;
  onSidebarWidthChange: (width: number) => void;
}) {
  const grouped = SETTING_SECTIONS.reduce<Record<string, typeof SETTING_SECTIONS>>((acc, section) => {
    acc[section.group] = [...(acc[section.group] ?? []), section];
    return acc;
  }, {});
  const ActiveIcon = activeSection.icon;

  return (
    <div
      className={`settings-shell density-${generalPreferences.density} ${generalPreferences.reduce_motion ? "reduce-motion" : ""}`}
      style={{ "--settings-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {/* Windows 无框窗口拖拽带（macOS 下 display:none，原生标题栏可拖）。 */}
      <div className="titlebar-drag-strip" aria-hidden="true" />
      <aside className="settings-sidebar" aria-label="设置菜单">
        <div className="settings-brand-row">
          <BrandMenu variant="settings" />
        </div>
        <button className="settings-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>返回应用</span>
        </button>
        <label className="settings-search">
          <Search size={15} />
          <input placeholder="搜索设置..." />
        </label>
        {Object.entries(grouped).map(([group, sections]) => (
          <div key={group} className="settings-group">
            <p>{group}</p>
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  className={section.id === activeSectionId ? "active" : ""}
                  type="button"
                  onClick={() => onSelectSection(section.id)}
                >
                  <Icon size={17} />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <SidebarResizeHandle
        width={sidebarWidth}
        minWidth={190}
        maxWidth={360}
        label="调整设置侧栏宽度"
        onResize={onSidebarWidthChange}
      />

      <main className="settings-content">
        <div className="settings-title">
          <ActiveIcon size={26} />
          <div>
            <h1>{activeSection.title}</h1>
            <p>{activeSection.summary}</p>
          </div>
        </div>

        {/* 后端维护操作条：跨设置 section 的全局按钮 */}
        <BackendControlBar />

        {activeSection.id === "general" ? (
          <GeneralSettings initialValue={generalPreferences} onSaved={onGeneralPreferencesChanged} />
        ) : activeSection.id === "models" ? (
          <ModelSettings onModelsChanged={onModelsChanged} />
        ) : activeSection.id === "memory" ? (
          <MemorySettings />
        ) : activeSection.id === "database" ? (
          <DatabaseSettings />
        ) : activeSection.id === "tools" ? (
          <SandboxSettings />
        ) : activeSection.id === "runtime" ? (
          <RuntimeSettings />
        ) : activeSection.id === "scheduled-tasks" ? (
          <ScheduledTasksSettings />
        ) : activeSection.id === "guardrails" ? (
          <GuardrailsSettings />
        ) : activeSection.id === "search" ? (
          <SearchSettings />
        ) : activeSection.id === "data-sources" ? (
          <DataSourcesSettings />
        ) : activeSection.id === "subagents" ? (
          <SubagentsSettings />
        ) : activeSection.id === "attachments" ? (
          <AttachmentSettings />
        ) : activeSection.id === "auth" ? (
          currentUser ? (
            <AccountSettings currentUser={currentUser} models={models} onLogout={onLogout} />
          ) : (
            <section className="settings-card">
              <p className="auth-error" role="alert">请先登录后查看账户信息。</p>
            </section>
          )
        ) : activeSection.id === "reports" ? (
          <ReportSettings onNavigateToExtensions={() => onSelectSection("integrations")} />
        ) : activeSection.id === "integrations" ? (
          <div className="subagents-settings">
            <McpExtensionsCard />
            <SkillsExtensionsCard />
          </div>
        ) : (
          <section className="settings-card" aria-label={`${activeSection.title}配置`}>
            {activeSection.fields.map((field) => (
              <div key={field.name} className="setting-row">
                <div>
                  <strong>{field.name}</strong>
                  <span>{field.hint}</span>
                </div>
                <button className="pill-control" type="button">{field.value}</button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

/** 后端维护操作条：跨设置 section 的全局按钮，重启 gateway 无需重启整个桌面端。 */
function BackendControlBar() {
  const [state, setState] = useState<"idle" | "restarting" | "success" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  // 二次确认用受控 ConfirmDialog（window.confirm 在桌面端 webview 中不弹窗）。
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRestart = async () => {
    // 点「确认重启」后才走这里；先关对话框，再发起重启。
    setConfirmOpen(false);
    setState("restarting");
    setStatusText("正在发送重启请求…");
    try {
      await restartGateway();
      setStatusText("后端重启中，等待恢复…");
      const ok = await waitForGateway(20000, (n) =>
        setStatusText(`等待后端恢复…（第 ${n} 次）`)
      );
      if (ok) {
        setState("success");
        setStatusText("后端已恢复。");
      } else {
        setState("error");
        setStatusText("后端恢复超时，请检查 gateway 是否正常运行。");
      }
    } catch (err) {
      setState("error");
      setStatusText(isGatewayControlApiError(err) ? err.message : "重启失败");
    }
  };

  return (
    <>
      <section className="settings-card backend-bar" aria-label="后端维护">
        <div className="backend-bar-info">
          <strong>后端引擎（gateway）</strong>
          <span>修改配置后重启 gateway 使变更完全生效（如数据库后端切换），无需重启整个桌面端。</span>
        </div>
        <div className="backend-bar-action">
          {statusText && (
            <span className={`backend-status backend-status--${state}`} role="status">
              {statusText}
            </span>
          )}
          <button
            className="pill-control backend-restart-btn"
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={state === "restarting"}
          >
            {state === "restarting" ? "重启中…" : "重启后端"}
          </button>
        </div>
      </section>
      <ConfirmDialog
        open={confirmOpen}
        title="重启后端"
        description="重启期间对话将短暂不可用，约 2-3 秒恢复。配置文件（模型 / 记忆等）不会丢失。"
        confirmText="确认重启"
        tone="primary"
        onConfirm={handleRestart}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** 模型配置 CRUD 页：列表 + 编辑 + 添加 + 默认模型。 */
function ModelSettings({ onModelsChanged }: { onModelsChanged?: (models: ModelConfig[], defaultModel: string | null) => void }) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addTemplate, setAddTemplate] = useState<typeof MODEL_TEMPLATES[number] | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModels();
      setModels(data.models);
      setDefaultModelState(data.default_model);
      if (data.models.length > 0 && !selectedName) {
        setSelectedName(data.models[0].name);
      }
      // 同步外部（Home 的输入框选择器）：设置页增删改后，输入框选择器需要
      // 反映最新列表，且当前选中的模型被删除时要回退到默认/首个。
      onModelsChanged?.(data.models, data.default_model);
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "加载模型失败");
    } finally {
      setLoading(false);
    }
  }, [selectedName, onModelsChanged]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = models.find((m) => m.name === selectedName) ?? null;

  const handleDelete = async (name: string) => {
    if (!window.confirm(`确认删除模型「${name}」？相关 API key 也会从 secrets.env 移除。`)) return;
    try {
      await deleteModel(name);
      if (selectedName === name) setSelectedName(null);
      await reload();
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "删除失败");
    }
  };

  const handleSetDefault = async (name: string | null) => {
    try {
      await setDefaultModel(name);
      setDefaultModelState(name);
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "设置默认模型失败");
    }
  };

  if (loading) {
    return <div className="model-settings"><p className="model-loading">加载模型配置…</p></div>;
  }

  return (
    <div className="model-settings">
      {error && <p className="auth-error" role="alert">{error}</p>}

      <section className="settings-card model-list-card" aria-label="模型列表">
        <div className="model-list-header">
          <strong>已配置模型</strong>
          <button className="pill-control" type="button" onClick={() => { setAddTemplate(null); setAdding(true); }}>+ 添加模型</button>
        </div>
        {models.length === 0 ? (
          <p className="model-empty">尚未配置任何模型。点击「添加模型」，从模板创建或自定义一个。</p>
        ) : (
          <ul className="model-list">
            {models.map((m) => (
              <li
                key={m.name}
                className={m.name === selectedName ? "active" : ""}
                onClick={() => setSelectedName(m.name)}
              >
                <div>
                  <strong>{m.display_name || m.name}</strong>
                  <span>{m.use}</span>
                </div>
                <div className="model-badges">
                  {m.supports_thinking && <em>思考</em>}
                  {m.supports_vision && <em>视觉</em>}
                  {defaultModel === m.name && <em className="default">默认</em>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleSetDefault(m.name); }} aria-label="设为默认">设默认</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <ModelEditor
          key={selected.name}
          model={selected}
          onSave={async (payload) => {
            try {
              await updateModel(selected.name, payload);
              await reload();
            } catch (err) {
              setError(isModelsApiError(err) ? err.message : "保存失败");
            }
          }}
          onDelete={() => handleDelete(selected.name)}
        />
      )}

      {adding && (
        <ModelAddDialog
          initialTemplate={addTemplate}
          onPickTemplate={(t) => setAddTemplate(t)}
          onCancel={() => setAdding(false)}
          onSubmit={async (payload) => {
            try {
              await createModel(payload);
              setAdding(false);
              await reload();
            } catch (err) {
              setError(isModelsApiError(err) ? err.message : "添加失败");
            }
          }}
        />
      )}
    </div>
  );
}

/** 单个模型编辑面板。api_key 留空表示不修改现有 key。 */
function ModelEditor({ model, onSave, onDelete }: {
  model: ModelConfig;
  onSave: (payload: ModelWritePayload) => Promise<void>;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(model.display_name ?? "");
  const [useClass, setUseClass] = useState(model.use);
  const [modelName, setModelName] = useState(model.model);
  const [apiBase, setApiBase] = useState(model.api_base ?? "");
  const [apiKey, setApiKey] = useState("");
  const [thinking, setThinking] = useState(model.supports_thinking);
  const [vision, setVision] = useState(model.supports_vision);
  const [reasoningEffort, setReasoningEffort] = useState(model.supports_reasoning_effort);
  const [saving, setSaving] = useState(false);

  return (
    <section className="settings-card model-editor" aria-label="编辑模型">
      <h3>{model.name}</h3>
      <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
      <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
      <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
      <label><span>api_key{model.api_key_env ? `（已配置 ${model.api_key_env}）` : ""}</span>
        <input type="password" placeholder="留空不修改" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </label>
      <div className="capability-row">
        <label className="auth-remember"><input type="checkbox" checked={thinking} onChange={(e) => { setThinking(e.target.checked); if (!e.target.checked) setReasoningEffort(false); }} /><span>Thinking</span></label>
        <label className="auth-remember"><input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /><span>Vision</span></label>
        <label className="auth-remember"><input type="checkbox" checked={reasoningEffort} disabled={!thinking} onChange={(e) => setReasoningEffort(e.target.checked)} /><span>Reasoning Effort</span></label>
      </div>
      <div className="model-editor-actions">
        <button className="hero-primary" type="button" disabled={saving} onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              name: model.name,
              display_name: displayName || null,
              use: useClass,
              model: modelName,
              api_base: apiBase || null,
              api_key: apiKey || null,
              supports_thinking: thinking,
              supports_vision: vision,
              supports_reasoning_effort: thinking && reasoningEffort,
            });
          } finally { setSaving(false); }
        }}>{saving ? "保存中…" : "保存"}</button>
        <button className="link-button" type="button" onClick={onDelete}>删除模型</button>
      </div>
    </section>
  );
}

/** 添加模型弹层：先选模板或空白自定义，再填表单提交。 */
function ModelAddDialog({ initialTemplate, onPickTemplate, onCancel, onSubmit }: {
  initialTemplate: typeof MODEL_TEMPLATES[number] | null;
  onPickTemplate: (t: typeof MODEL_TEMPLATES[number] | null) => void;
  onCancel: () => void;
  onSubmit: (payload: ModelWritePayload) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [useClass, setUseClass] = useState("");
  const [modelName, setModelName] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [thinking, setThinking] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState(false);
  const [vision, setVision] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.id);
      setDisplayName(initialTemplate.name);
      setUseClass(initialTemplate.provider);
      setModelName(initialTemplate.model);
      setApiBase(initialTemplate.endpointKey === "native" ? "" : initialTemplate.endpoint);
      setThinking(initialTemplate.thinking);
      setReasoningEffort(Boolean(initialTemplate.reasoningEffort));
      setVision(initialTemplate.vision);
    }
  }, [initialTemplate]);

  return (
    <section className="settings-card model-add-dialog" aria-label="添加模型">
      <div className="model-list-header">
        <strong>添加模型</strong>
        <button className="link-button" type="button" onClick={onCancel}>取消</button>
      </div>
      {!initialTemplate && (
        <div className="template-picker">
          <p className="model-empty">从模板快速创建，或直接空白自定义：</p>
          <div className="template-grid">
            {MODEL_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => onPickTemplate(t)}>
                <strong>{t.name}</strong><span>{t.provider}</span>
              </button>
            ))}
            <button type="button" onClick={() => onPickTemplate(MODEL_TEMPLATES[0])}>
              <strong>空白自定义</strong><span>手动填写全部字段</span>
            </button>
          </div>
        </div>
      )}
      {initialTemplate && (
        <>
          <div className="model-add-fields">
            <label><span>name（唯一标识）</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
            <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
            <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
            <label><span>api_key（明文，存入 secrets.env）</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label>
          </div>
          <div className="capability-row">
            <label className="auth-remember"><input type="checkbox" checked={thinking} onChange={(e) => { setThinking(e.target.checked); if (!e.target.checked) setReasoningEffort(false); }} /><span>Thinking</span></label>
            <label className="auth-remember"><input type="checkbox" checked={reasoningEffort} disabled={!thinking} onChange={(e) => setReasoningEffort(e.target.checked)} /><span>Reasoning Effort</span></label>
            <label className="auth-remember"><input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /><span>Vision</span></label>
          </div>
          <button className="hero-primary" type="button" disabled={submitting} onClick={async () => {
            if (!name || !useClass || !modelName) return;
            setSubmitting(true);
            try {
              await onSubmit({
                name, display_name: displayName || null,
                use: useClass, model: modelName,
                api_base: apiBase || null, api_key: apiKey || null,
                supports_thinking: thinking,
                supports_reasoning_effort: thinking && reasoningEffort,
                supports_vision: vision,
              });
            } finally { setSubmitting(false); }
          }}>{submitting ? "提交中…" : "创建"}</button>
        </>
      )}
    </section>
  );
}
