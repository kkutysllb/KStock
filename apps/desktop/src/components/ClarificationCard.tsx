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

import { useMemo, useState } from "react";
import { Check, MessageSquarePlus } from "lucide-react";
import type { HumanInputPayload } from "../lib/sessionStore";

interface ClarificationCardProps {
  payload: HumanInputPayload;
  /** 用户点击"回复并确认"后回调，参数为拼接好的文本。 */
  onPick: (text: string) => void;
  /**
   * 该澄清的回复文本（来自其后紧邻的用户消息）。非空时卡片进入
   * 只读回显态：控件显示用户当时的选择而非默认占位符。
   */
  answer?: string | null;
}

/** form 模式字段值：select/text 为 string，checkbox 为 boolean，multi_select 为数组。 */
type FormValue = string | boolean | string[];

/** buildFormSummary 的逆操作：把 "label: value" 行解析回映射（容忍全角冒号）。 */
function parseAnswerMap(answer: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawLine of answer.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const halfwidth = line.indexOf(":");
    const fullwidth = line.indexOf("：");
    const at =
      halfwidth === -1 ? fullwidth : fullwidth === -1 ? halfwidth : Math.min(halfwidth, fullwidth);
    if (at <= 0) continue;
    map.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  return map;
}

type NormalizedOption = {
  key: string;
  label: string;
  value: string;
};

function normalizeOption(option: unknown, index: number): NormalizedOption {
  // 兜底：Agent 生成澄清表单时可能把 Python dict 用 repr() / JSON.stringify
  // 塞进 options（形如 "{'label': '...'}"），前端若按普通字符串渲染会原样
  // 显示语法字面量。这里尝试解析后再走常规逻辑。
  if (typeof option === "string") {
    const trimmed = option.trim();
    if (
      trimmed.length > 0 &&
      (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
      (trimmed.endsWith("}") || trimmed.endsWith("]"))
    ) {
      try {
        // 兼容 Python repr（单引号）→ JSON（双引号）
        const asJson = /^\{'\w/.test(trimmed) ? trimmed.replace(/'/g, '"') : trimmed;
        const parsed = JSON.parse(asJson);
        if (typeof parsed === "string") {
          return { key: `${index}:${parsed}`, label: parsed, value: parsed };
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeOption(parsed[0], index);
        }
        if (parsed && typeof parsed === "object") {
          option = parsed; // 走到下面的 object 分支
        }
      } catch {
        /* fall through to plain string */
      }
    }
    if (typeof option === "string") {
      const value = option;
      return { key: `${index}:${value}`, label: value, value };
    }
  }
  if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
    const value = String(option);
    return { key: `${index}:${value}`, label: value, value };
  }
  if (option && typeof option === "object") {
    const record = option as Record<string, unknown>;
    const rawValue = record.value ?? record.id ?? record.label ?? index;
    const rawLabel = record.label ?? record.value ?? record.id ?? rawValue;
    const value = String(rawValue);
    const label = String(rawLabel);
    return { key: `${index}:${value}`, label, value };
  }
  const value = String(option ?? "");
  return { key: `${index}:${value}`, label: value, value };
}

function normalizeOptions(options: unknown[] | undefined): NormalizedOption[] {
  return (options ?? []).map(normalizeOption).filter((option) => option.value || option.label);
}

export function ClarificationCard({ payload, onPick, answer }: ClarificationCardProps) {
  // hooks 一律前置（三种模式共用），避免模式切换时 hooks 顺序变化。
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [freeText, setFreeText] = useState("");
  const [formValues, setFormValues] = useState<Record<string, FormValue>>({});

  const mode = payload.input_mode;

  // 已回复态：控件回显 answer 解析出的值，交互禁用。
  const answered = typeof answer === "string" && answer.trim().length > 0;
  const answerMap = useMemo(
    () => (answered ? parseAnswerMap(answer as string) : null),
    [answered, answer],
  );
  const answerLines = useMemo(
    () => (answered ? (answer as string).split("\n").map((l) => l.trim()).filter(Boolean) : []),
    [answered, answer],
  );

  /** form 字段在已回复态的回显值（按 "label: value" 行反解）。 */
  const answeredFieldValue = (
    field: NonNullable<HumanInputPayload["fields"]>[number],
  ): FormValue | undefined => {
    const raw = answerMap?.get(field.label ?? field.name) ?? answerMap?.get(field.name);
    if (raw === undefined || raw === "") return undefined;
    if (field.type === "multi_select") return raw.split("、").map((v) => v.trim()).filter(Boolean);
    if (field.type === "checkbox") return raw === "是";
    return raw;
  };

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
    // 不清空选择：父级确认框可能取消，保留现场；确认后由 answer 回显。
  };

  const hasChoiceSelection = selected.size > 0 || otherText.trim().length > 0;

  // choice 已回复态：命中的选项 + 未命中的行视作"其他"补充。
  const choiceKnown = new Set((payload.options ?? []).map((opt) => opt.value));
  const answeredChoiceSet = useMemo(
    () => new Set(answerLines.filter((v) => choiceKnown.has(v))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answered, answer],
  );
  const answeredOther = answerLines.filter((v) => !choiceKnown.has(v)).join("、");

  // ── free_text ─────────────────────────────────────────────────────
  const pickFreeText = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return;
    onPick(trimmed);
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
    // 不清空表单：父级确认框可能取消，保留现场；确认后由 answer 回显。
  };

  // ── 渲染 ──────────────────────────────────────────────────────────
  return (
    <div className={`clarification-card${answered ? " answered" : ""}`} role="form" aria-label="澄清回复">
      {payload.context && (
        <p className="clarification-context">{payload.context}</p>
      )}
      <p className="clarification-question">
        {payload.question}
        {answered && (
          <span className="clarification-answered-badge">
            <Check size={11} aria-hidden="true" /> 已回复
          </span>
        )}
      </p>

      {mode === "choice_with_other" && (
        <>
          <ul className="clarification-options" role="group" aria-label="可选项">
            {(payload.options ?? []).map((opt) => {
              const checked = answered ? answeredChoiceSet.has(opt.value) : selected.has(opt.value);
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={answered}
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
            value={answered ? answeredOther : otherText}
            readOnly={answered}
            onChange={(e) => setOtherText(e.target.value)}
          />

          {!answered && (
            <button
              type="button"
              className="clarification-pick-btn"
              onClick={pickChoice}
              disabled={!hasChoiceSelection}
            >
              <MessageSquarePlus size={13} />
              回复并确认
            </button>
          )}
        </>
      )}

      {mode === "free_text" && (
        <>
          <textarea
            className="clarification-other clarification-free-text"
            aria-label="回复内容"
            placeholder="在此输入回复…"
            rows={3}
            value={answered ? (answer as string) : freeText}
            readOnly={answered}
            onChange={(e) => setFreeText(e.target.value)}
          />
          {!answered && (
            <button
              type="button"
              className="clarification-pick-btn"
              onClick={pickFreeText}
              disabled={!freeText.trim()}
            >
              <MessageSquarePlus size={13} />
              回复并确认
            </button>
          )}
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
                {renderFormField(
                  f,
                  answered ? answeredFieldValue(f) : formValues[f.name],
                  setField,
                  answered,
                )}
              </label>
            ))}
          </div>
          {!answered && (
            <button
              type="button"
              className="clarification-pick-btn"
              onClick={pickForm}
              disabled={!hasRequiredValues}
            >
              <MessageSquarePlus size={13} />
              回复并确认
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** 按字段类型渲染输入控件（select / multi_select / checkbox / 文本类）。 */
function renderFormField(
  field: NonNullable<HumanInputPayload["fields"]>[number],
  value: FormValue | undefined,
  onChange: (name: string, value: FormValue) => void,
  disabled = false,
) {
  const options = normalizeOptions(field.options as unknown[] | undefined);

  switch (field.type) {
    case "select": {
      // 已回复态若值不在选项里（自定义答案），注入临时选项保证回显。
      const missing =
        disabled && typeof value === "string" && value !== "" &&
        !options.some((opt) => opt.value === value);
      return (
        <select
          className="clarification-form-select"
          aria-label={field.name}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        >
          <option value="">请选择…</option>
          {missing && <option value={value as string}>{value as string}</option>}
          {options.map((opt) => (
            <option key={opt.key} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    case "multi_select": {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div className="clarification-multi" role="group" aria-label={field.name}>
          {options.map((opt) => {
            const checked = picked.includes(opt.value);
            return (
              <button
                key={opt.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={disabled}
                className={`clarification-option ${checked ? "checked" : ""}`}
                onClick={() => {
                  const next = checked ? picked.filter((v) => v !== opt.value) : [...picked, opt.value];
                  onChange(field.name, next);
                }}
              >
                <span className="clarification-option-box" aria-hidden="true">
                  {checked && <Check size={12} />}
                </span>
                <span className="clarification-option-label">{opt.label}</span>
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
            disabled={disabled}
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
          readOnly={disabled}
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
          readOnly={disabled}
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
          readOnly={disabled}
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
          readOnly={disabled}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      );
  }
}
