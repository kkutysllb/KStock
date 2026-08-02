// 交互式澄清卡片：当 agent 调用 ask_clarification（choice_with_other 模式）
// 时渲染可点选的选项 + "其他"补充输入，用户选择后回填到输入框。
//
// 引擎 ClarificationMiddleware 生成结构化 payload 放在
// ToolMessage.artifact.human_input，turnReducer 已提取到 ToolCall.artifact。
// 本组件消费 payload.input_mode === "choice_with_other"：
//   - 渲染 question（标题）+ 可选 context（副标题）
//   - options → 复选框列表（toggle 选中态）
//   - "其他" 单行输入框（用户补充自定义文本）
//   - "回复并确认" 按钮：选中 value + 其他文本用 \n 拼接，调 onPick，
//     由父级弹出 ClarifyInputDialog 供用户确认后发送
// form / free_text 模式本期不渲染选项，显示退化提示。

import { useState } from "react";
import { Check, MessageSquarePlus } from "lucide-react";
import type { HumanInputPayload } from "../lib/sessionStore";

interface ClarificationCardProps {
  payload: HumanInputPayload;
  /** 用户点击"回复并确认"后回调，参数为拼接好的文本。 */
  onPick: (text: string) => void;
}

export function ClarificationCard({ payload, onPick }: ClarificationCardProps) {
  // 仅处理 choice_with_other；其他模式退化为提示。
  if (payload.input_mode !== "choice_with_other") {
    return (
      <div className="clarification-card clarification-fallback" role="note">
        <p className="clarification-question">{payload.question}</p>
        <p className="clarification-hint">请在下方输入框直接回复。</p>
      </div>
    );
  }

  const options = payload.options ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");

  const toggle = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handlePick = () => {
    const parts: string[] = [];
    for (const opt of options) {
      if (selected.has(opt.value)) parts.push(opt.value);
    }
    const trimmedOther = otherText.trim();
    if (trimmedOther) parts.push(trimmedOther);
    if (parts.length === 0) return;
    onPick(parts.join("\n"));
    // 提交后清空选中态，避免重复提交。
    setSelected(new Set());
    setOtherText("");
  };

  const hasSelection = selected.size > 0 || otherText.trim().length > 0;

  return (
    <div className="clarification-card" role="form" aria-label="澄清选项">
      {payload.context && (
        <p className="clarification-context">{payload.context}</p>
      )}
      <p className="clarification-question">{payload.question}</p>

      <ul className="clarification-options" role="group" aria-label="可选项">
        {options.map((opt) => {
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
        onClick={handlePick}
        disabled={!hasSelection}
      >
        <MessageSquarePlus size={13} />
        回复并确认
      </button>
    </div>
  );
}
