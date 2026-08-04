import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";

/**
 * 通用运行时配置编辑卡（受控 + dirty 检测 + 保存）。
 *
 * - 用 fields 描述声明字段（label/type/options/min/max/step）
 * - value 是当前编辑值（对象），onSave 持久化
 * - dirty 检测：与 initialValue 浅层 key 对比（字段级深比较由调用方保证值规范化）
 * - 保存中 / 错误回显 / 重置到初始值
 *
 * 字段类型：
 *   boolean        开关
 *   string         文本输入
 *   nullable-string 留空 = null
 *   number         数字输入
 *   select         下拉（options: {value,label}[]）
 *   context-size   type + value 组合（trigger/keep 用）
 *   string-list    逗号分隔 → string[]
 */

export type FieldType =
  | "boolean"
  | "string"
  | "nullable-string"
  | "number"
  | "select"
  | "context-size"
  | "string-list";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  /** 嵌套字段路径前缀（如 "backend_config."），用于读写深层对象 */
  prefix?: string;
  /** 是否禁用该字段（灰色不可交互）。用于依赖其他字段的联动场景 */
  disabled?: boolean;
  /** 禁用原因：在字段下方以警告样式显示，解释为什么不能编辑 */
  disabledReason?: string;
}

export interface RuntimeConfigCardProps {
  title: string;
  description?: string;
  fields: FieldDef[];
  initialValue: Record<string, unknown>;
  onSave: (value: Record<string, unknown>) => Promise<void>;
  /** 保存成功的额外提示（外部联动如「引擎将热重载」），可选 */
  savedHint?: string;
  busy?: boolean;
}

export function RuntimeConfigCard({
  title,
  description,
  fields,
  initialValue,
  onSave,
  savedHint,
  busy = false,
}: RuntimeConfigCardProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => deepClone(initialValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const didMountRef = useRef(false);

  // initialValue 外部变化（如重新加载）→ 重置 draft
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setDraft(deepClone(initialValue));
    setError(null);
    setFieldErrors({});
  }, [initialValue]);

  const dirty = useMemo(() => !shallowEqual(draft, initialValue), [draft, initialValue]);

  const handleFieldChange = useCallback((field: FieldDef, rawValue: unknown) => {
    setFieldErrors({});
    setDraft((prev) => setNested(prev, fieldToPath(field), rawValue));
  }, []);

  const handleReset = useCallback(() => {
    setDraft(deepClone(initialValue));
    setError(null);
    setFieldErrors({});
  }, [initialValue]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSave(draft);
      setSavedAt(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // 若 err 带字段级错误（RuntimeConfigApiError.fieldErrors），回填到对应字段
      const fe = (err as { fieldErrors?: Array<{ field: string; message: string }> }).fieldErrors;
      if (fe && fe.length > 0) {
        const map: Record<string, string> = {};
        for (const e of fe) map[e.field] = e.message;
        setFieldErrors(map);
      }
    } finally {
      setSaving(false);
    }
  }, [draft, onSave]);

  const disabled = busy || saving || !dirty;

  return (
    <section className="settings-card runtime-config-card" aria-label={title}>
      <div className="runtime-config-header">
        <div>
          <strong>{title}</strong>
          {description && <p className="runtime-config-desc">{description}</p>}
        </div>
        <div className="runtime-config-actions">
          <button
            className="link-button"
            type="button"
            disabled={!dirty || saving}
            onClick={handleReset}
            title="放弃修改"
          >
            <RotateCcw size={13} /> 重置
          </button>
          <button
            className="hero-primary"
            type="button"
            disabled={disabled}
            onClick={handleSave}
          >
            <Save size={13} /> {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      {error && (
        <p className="auth-error" role="alert">{error}</p>
      )}
      {savedAt && !error && savedHint && (
        <p className="runtime-config-saved">{savedHint}</p>
      )}

      <div className="runtime-config-grid">
        {fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={getNested(draft, fieldToPath(field))}
            error={fieldErrors[fieldFullKey(field)]}
            onChange={(v) => handleFieldChange(field, v)}
          />
        ))}
      </div>
    </section>
  );
}

// ── 字段渲染 ────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const id = `rcf-${field.key.replace(/\./g, "-")}`;

  const labelEl = (
    <label className="rcf-label" htmlFor={id}>
      <span className="rcf-label-text">{field.label}</span>
      {field.hint && <span className="rcf-hint">{field.hint}</span>}
    </label>
  );

  let control: React.ReactNode;
  switch (field.type) {
    case "boolean":
      control = (
        <label className="rcf-toggle" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            disabled={field.disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? "开启" : "关闭"}</span>
        </label>
      );
      break;
    case "select":
      control = (
        <select
          id={id}
          value={String(value ?? "")}
          disabled={field.disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
      break;
    case "number":
      control = (
        <input
          id={id}
          type="number"
          value={value === null || value === undefined ? "" : Number(value)}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          disabled={field.disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
      break;
    case "nullable-string":
      control = (
        <input
          id={id}
          type="text"
          value={value === null || value === undefined ? "" : String(value)}
          placeholder={field.placeholder ?? "留空 = 使用默认"}
          disabled={field.disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
      break;
    case "string-list":
      control = (
        <input
          id={id}
          type="text"
          value={Array.isArray(value) ? value.join(", ") : ""}
          placeholder={field.placeholder ?? "逗号分隔"}
          disabled={field.disabled}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        />
      );
      break;
    case "context-size": {
      const cs = normalizeContextSize(value);
      control = (
        <div className="rcf-context-size">
          <select
            value={cs.type}
            disabled={field.disabled}
            onChange={(e) => onChange({ type: e.target.value, value: cs.value })}
          >
            <option value="messages">按消息数</option>
            <option value="tokens">按 token 数</option>
            <option value="fraction">按比例</option>
          </select>
          <input
            type="number"
            value={cs.value}
            min={0}
            step={cs.type === "fraction" ? 0.1 : 1}
            disabled={field.disabled}
            onChange={(e) => onChange({ type: cs.type, value: Number(e.target.value) })}
          />
        </div>
      );
      break;
    }
    default:
      control = (
        <input
          id={id}
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          disabled={field.disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div className={`rcf-field ${error ? "has-error" : ""} ${field.disabled ? "is-disabled" : ""}`}>
      {labelEl}
      <div className="rcf-control">{control}</div>
      {error && <span className="rcf-error">{error}</span>}
      {field.disabled && field.disabledReason && (
        <span className="rcf-disabled-reason">⚠ {field.disabledReason}</span>
      )}
    </div>
  );
}

// ── 工具函数 ────────────────────────────────────────────────────────

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** field 的嵌套路径：prefix + key，用 "." 分割。 */
function fieldToPath(field: FieldDef): string[] {
  const full = field.prefix ? `${field.prefix}${field.key}` : field.key;
  return full.split(".");
}

/** 用于 fieldErrors 匹配的完整 key（点分字符串）。 */
function fieldFullKey(field: FieldDef): string {
  return fieldToPath(field).join(".");
}

function getNested(obj: Record<string, unknown>, path: string[]): unknown {
  let node: unknown = obj;
  for (const key of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function setNested(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): Record<string, unknown> {
  const clone = deepClone(obj);
  let node: Record<string, unknown> = clone;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = node[key];
    if (typeof next !== "object" || next === null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1]] = value;
  return clone;
}

interface NormalizedContextSize {
  type: "fraction" | "tokens" | "messages";
  value: number;
}

function normalizeContextSize(value: unknown): NormalizedContextSize {
  if (value && typeof value === "object" && "type" in value && "value" in value) {
    const v = value as { type: string; value: number };
    if (v.type === "fraction" || v.type === "tokens" || v.type === "messages") {
      return { type: v.type, value: Number(v.value) || 0 };
    }
  }
  return { type: "messages", value: 10 };
}

// ── 共享字段定义 ──────────────────────────────────────────────────────

/** token 预算段字段（主代理 RuntimeSettings 与子代理 SubagentsSettings 共用）。 */
export const TOKEN_BUDGET_FIELDS: FieldDef[] = [
  {
    key: "enabled",
    label: "启用预算限制",
    type: "boolean",
    hint: "超过硬停止阈值时中止请求；预算耗尽时按续跑次数清零重计",
  },
  {
    key: "max_tokens",
    label: "最大 Token 总量",
    type: "number",
    min: 1000,
    step: 1000,
    hint: "一次会话的 token 预算总量（输入+输出）",
  },
  {
    key: "max_input_tokens",
    label: "最大输入 Token",
    type: "number",
    min: 1,
    step: 1000,
    hint: "留空 = 不单独限制输入",
    placeholder: "留空 = 不限制",
  },
  {
    key: "max_output_tokens",
    label: "最大输出 Token",
    type: "number",
    min: 1,
    step: 1000,
    hint: "留空 = 不单独限制输出",
    placeholder: "留空 = 不限制",
  },
  {
    key: "warn_threshold",
    label: "告警阈值",
    type: "number",
    min: 0,
    max: 1,
    step: 0.1,
    hint: "占比，如 0.8 = 80% 时记录告警日志",
  },
  {
    key: "hard_stop_threshold",
    label: "硬停止阈值",
    type: "number",
    min: 0,
    max: 1,
    step: 0.1,
    hint: "占比，如 1.0 = 100% 时中止请求",
  },
  {
    key: "max_budget_extensions",
    label: "预算续跑次数",
    type: "number",
    min: 0,
    step: 1,
    hint: "预算耗尽后清零重计继续执行的最大次数；0 = 禁用续跑，超限即硬停",
  },
];
