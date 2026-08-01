import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Keyboard, LayoutPanelLeft, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_GENERAL_PREFERENCES,
  isGeneralSettingsApiError,
  updateGeneralPreferences,
  type GeneralPreferences,
} from "../lib/generalSettingsClient";

interface GeneralSettingsProps {
  initialValue: GeneralPreferences;
  onSaved: (preferences: GeneralPreferences) => void;
}

export function GeneralSettings({ initialValue, onSaved }: GeneralSettingsProps) {
  const [draft, setDraft] = useState<GeneralPreferences>(() => ({ ...initialValue }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft({ ...DEFAULT_GENERAL_PREFERENCES, ...initialValue });
    setError(null);
  }, [initialValue]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialValue), [draft, initialValue]);
  const update = <K extends keyof GeneralPreferences>(key: K, value: GeneralPreferences[K]) => {
    setSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setDraft({ ...initialValue });
    setError(null);
    setSaved(false);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateGeneralPreferences(draft);
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(isGeneralSettingsApiError(err) ? err.message : "常规设置保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="general-settings">
      <div className="general-settings-toolbar">
        <span>{dirty ? "有未保存的修改" : "设置会同步到当前用户数据空间"}</span>
        <div>
          <button className="link-button" type="button" disabled={!dirty || saving} onClick={reset}>
            <RotateCcw size={13} /> 重置
          </button>
          <button className="hero-primary" type="button" disabled={!dirty || saving} onClick={save}>
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saving ? "保存中…" : saved ? "已保存" : "保存设置"}
          </button>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <GeneralSection icon={LayoutPanelLeft} title="界面与侧栏" description="控制工作台的布局密度和启动时的侧栏状态。">
        <SelectField
          label="界面密度"
          hint="紧凑模式会减少列表和消息之间的留白"
          value={draft.density}
          options={[{ value: "comfortable", label: "舒适" }, { value: "compact", label: "紧凑" }]}
          onChange={(value) => update("density", value as GeneralPreferences["density"])}
        />
        <ToggleField
          label="减少动态效果"
          hint="保留状态变化，关闭非必要动画和过渡"
          checked={draft.reduce_motion}
          onChange={(value) => update("reduce_motion", value)}
        />
        <ToggleField
          label="启动时折叠侧边栏"
          hint="工作区进入时使用更宽的对话区域"
          checked={draft.sidebar_collapsed}
          onChange={(value) => update("sidebar_collapsed", value)}
        />
        <ToggleField
          label="启动时折叠历史任务"
          hint="保留侧栏导航，但默认收起历史列表"
          checked={draft.history_collapsed}
          onChange={(value) => update("history_collapsed", value)}
        />
      </GeneralSection>

      <GeneralSection icon={Eye} title="研究过程" description="选择消息流中需要保留的过程信息。关闭展示只影响界面，不会删除原始数据。">
        <ToggleField
          label="自动跟随最新消息"
          hint="用户手动上滚后不会被强制拉回底部"
          checked={draft.auto_scroll}
          onChange={(value) => update("auto_scroll", value)}
        />
        <ToggleField
          label="显示任务阶段"
          hint="在助手消息顶部显示研究阶段"
          checked={draft.show_stage}
          onChange={(value) => update("show_stage", value)}
        />
        <ToggleField
          label="显示思考过程"
          hint="显示引擎返回的 reasoning 区块"
          checked={draft.show_reasoning}
          onChange={(value) => update("show_reasoning", value)}
        />
        <ToggleField
          label="显示工具调用"
          hint="显示主代理和子代理的工具调用卡片"
          checked={draft.show_tool_calls}
          onChange={(value) => update("show_tool_calls", value)}
        />
      </GeneralSection>

      <GeneralSection icon={Keyboard} title="会话与输入" description="设置会话恢复方式，以及消息输入区的发送行为。">
        <ToggleField
          label="恢复上次打开的任务"
          hint="优先打开该用户上次查看且仍存在的任务"
          checked={draft.restore_last_session}
          onChange={(value) => update("restore_last_session", value)}
        />
        <ToggleField
          label="无历史任务时自动新建"
          hint="首次进入空工作区时直接创建新研究会话"
          checked={draft.create_session_when_empty}
          onChange={(value) => update("create_session_when_empty", value)}
        />
        <SelectField
          label="发送快捷键"
          hint="Shift + Enter 始终换行"
          value={draft.send_shortcut}
          options={[{ value: "mod_enter", label: "Cmd / Ctrl + Enter" }, { value: "enter", label: "Enter" }]}
          onChange={(value) => update("send_shortcut", value as GeneralPreferences["send_shortcut"])}
        />
        <ToggleField
          label="发送后保留草稿"
          hint="适合继续编辑或重复提交相近问题"
          checked={draft.keep_draft_after_send}
          onChange={(value) => update("keep_draft_after_send", value)}
        />
        <ToggleField
          label="发送后保留附件"
          hint="已上传文件继续留在下一条消息中"
          checked={draft.keep_attachments_after_send}
          onChange={(value) => update("keep_attachments_after_send", value)}
        />
      </GeneralSection>
    </div>
  );
}

function GeneralSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof LayoutPanelLeft;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-card general-settings-section">
      <div className="general-settings-section-header">
        <div className="general-settings-section-icon"><Icon size={16} /></div>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </div>
      <div className="general-settings-grid">{children}</div>
    </section>
  );
}

function SelectField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="general-settings-field">
      <span className="general-settings-label"><strong>{label}</strong><em>{hint}</em></span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="general-settings-field general-settings-toggle">
      <span className="general-settings-label"><strong>{label}</strong><em>{hint}</em></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="general-settings-switch" aria-hidden="true"><span /></span>
    </label>
  );
}
