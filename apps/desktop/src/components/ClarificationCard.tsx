// 交互式澄清卡片：渲染 ask_clarification 的结构化 payload
// （ToolMessage.artifact.human_input，turnReducer 已提取到 ToolCall.artifact）。
//
// 三种 input_mode 均渲染交互卡片，提交后拼接文本调 onPick，
// 由父级弹出 ClarifyInputDialog 供用户确认后发送：
//   - choice_with_other：options 复选框 + "其他"补充输入
//   - form：按 fields 渲染表单（select/text/textarea/number/checkbox/
//     multi_select/date），必填校验，提交时组装 "label: value" 行
//   - free_text：textarea 输入框直接填写回复
//
// form / free_text 模式下引擎 fallback 正文（msg.text）与卡片重复，由
// AssistantTurn 隐藏 fallback 文本（isInteractive 覆盖三种模式）。

import { useState } from "react";
import { Check, MessageSquarePlus } from "lucide-react";
import type { HumanInputPayload } from "../lib/sessionStore";

interface ClarificationCardProps {
  payload: HumanInputPayload;
  /** 用户点击"回复并确认"后回调，参数为拼接好的文本。 */
  onPick: (text: string) => void;
}

/** form 模式字段值：select/text 为 string，checkbox 为 boolean，multi_select 为数组。 */
type FormValue = string | boolean | string[];

export function ClarificationCard({ payload, onPick }: ClarificationCardProps) {
  // hooks 一律前置（三种模式共用），避免模式切换时 hooks 顺序变化。
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [freeText, setFreeText] = useState("");
  const [formValues, setFormValues] = useState<Record<string, FormValue>>({});

  const mode = payload.input_mode;

  // ── choice_with_other ─────────────────────────────────────────────
  const toggle = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const pickChoice = () => {
    const parts: string[] = [];
    for (const opt of payload.options ?? []) {
      if (selected.has(opt.value)) parts.push(opt.value);
    }
    const trimmedOther = otherText.trim();
    if (trimmedOther) parts.push(trimmedOther);
    if (parts.length === 0) return;
    onPick(parts.join("\n"));
    setSelected(new Set());
    setOtherText("");
  };

  const hasChoiceSelection = selected.size > 0 || otherText.trim().length > 0;

  // ── free_text ─────────────────────────────────────────────────────
  const pickFreeText = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return;
    onPick(trimmed);
    setFreeText("");
  };

  // ── form ──────────────────────────────────────────────────────────
  const fields = payload.fields ?? [];
  const setField = (name: string, value: FormValue) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  /** 必填字段是否有值（决定提交按钮禁用态）。 */
  const hasRequiredValues = fields.every((f) => {
    if (!f.required) return true;
    const v = formValues[f.name];
    if (typeof v === "boolean") return true;
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  });

  /** 将字段值组装成可读文本：每行 "label: value"。未填写的可选字段跳过。 */
  const buildFormSummary = (): string => {
    const lines: string[] = [];
    for (const f of fields) {
      const v = formValues[f.name];
      if (typeof v === "boolean") {
        if (f.required || v) lines.push(`${f.label ?? f.name}: ${v ? "是" : "否"}`);
      } else if (Array.isArray(v)) {
        if (v.length > 0) lines.push(`${f.label ?? f.name}: ${v.join("、")}`);
      } else if (typeof v === "string" && v.trim()) {
        lines.push(`${f.label ?? f.name}: ${v.trim()}`);
      }
    }
    return lines.join("\n");
  };

  const pickForm = () => {
    const summary = buildFormSummary();
    if (!summary) return;
    onPick(summary);
    setFormValues({});
  };

  // ── 渲染 ──────────────────────────────────────────────────────────
  return (
    <div className="clarification-card" role="form" aria-label="澄清回复">
      {payload.context && (
        <p className="clarification-context">{payload.context}</p>
      )}
      <p className="clarification-question">{payload.question}</p>

      {mode === "choice_with_other" && (
        <>
          <ul className="clarification-options" role="group" aria-label="可选项">
            {(payload.options ?? []).map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    className={`clarification-option ${checked ? "checked" : ""}`}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className="clarification-option-box" aria-hidden="true">
                      {checked && <Check size={12} />}
                    </span>
                    <span className="clarification-option-label">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <input
            type="text"
            className="clarification-other"
            aria-label="其他补充"
            placeholder="其他（可补充自定义内容）"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
          />

          <button
            type="button"
            className="clarification-pick-btn"
            onClick={pickChoice}
            disabled={!hasChoiceSelection}
          >
            <MessageSquarePlus size={13} />
            回复并确认
          </button>
        </>
      )}

      {mode === "free_text" && (
        <>
          <textarea
            className="clarification-other clarification-free-text"
            aria-label="回复内容"
            placeholder="在此输入回复…"
            rows={3}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
          />
          <button
            type="button"
            className="clarification-pick-btn"
            onClick={pickFreeText}
            disabled={!freeText.trim()}
          >
            <MessageSquarePlus size={13} />
            回复并确认
          </button>
        </>
      )}

      {mode === "form" && (
        <>
          <div className="clarification-fields">
            {fields.map((f) => (
              <label key={f.name} className="clarification-field">
                <span className="clarification-field-label">
                  {f.label ?? f.name}
                  {f.required && <em className="clarification-required" aria-hidden="true">*</em>}
                </span>
                {renderFormField(f, formValues[f.name], setField)}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="clarification-pick-btn"
            onClick={pickForm}
            disabled={!hasRequiredValues}
          >
            <MessageSquarePlus size={13} />
            回复并确认
          </button>
        </>
      )}
    </div>
  );
}

/** 按字段类型渲染输入控件（select / multi_select / checkbox / 文本类）。 */
function renderFormField(
  field: NonNullable<HumanInputPayload["fields"]>[number],
  value: FormValue | undefined,
  onChange: (name: string, value: FormValue) => void
) {
  const options = field.options ?? [];

  switch (field.type) {
    case "select":
      return (
        <select
          className="clarification-form-select"
          aria-label={field.name}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        >
          <option value="">请选择…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case "multi_select": {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div className="clarification-multi" role="group" aria-label={field.name}>
          {options.map((opt) => {
            const checked = picked.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                role="checkbox"
                aria-checked={checked}
                className={`clarification-option ${checked ? "checked" : ""}`}
                onClick={() => {
                  const next = checked ? picked.filter((v) => v !== opt) : [...picked, opt];
                  onChange(field.name, next);
                }}
              >
                <span className="clarification-option-box" aria-hidden="true">
                  {checked && <Check size={12} />}
                </span>
                <span className="clarification-option-label">{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }

    case "checkbox":
      return (
        <label className="clarification-checkbox-row">
          <input
            type="checkbox"
            aria-label={field.name}
            checked={value === true}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
          <span>{field.placeholder ?? "同意"}</span>
        </label>
      );

    case "textarea":
      return (
        <textarea
          className="clarification-form-textarea"
          aria-label={field.name}
          placeholder={field.placeholder}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          className="clarification-form-input"
          aria-label={field.name}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      );

    case "date":
      return (
        <input
          type="date"
          className="clarification-form-input"
          aria-label={field.name}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      );

    default:
      return (
        <input
          type="text"
          className="clarification-form-input"
          aria-label={field.name}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      );
  }
}
