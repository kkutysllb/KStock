// 澄清确认对话框：ask_clarification 选项被选中后弹出，预填拼接文本，
// 用户可在其中编辑确认，确认后直接作为消息发送（不再回填主输入框）。
//
// 设计（与 ConfirmDialog 一致）：
// - 受控组件：open + initialText + onConfirm(text)/onCancel
// - 打开时 textarea 预填 initialText 并自动 focus；Esc 取消、⌘/Ctrl+Enter 确认
// - 点遮罩取消；确认按钮在文本为空时禁用

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

interface ClarifyInputDialogProps {
  open: boolean;
  /** 打开时预填的文本（用户选中选项的拼接结果）。 */
  initialText: string;
  /** 澄清问题（可选，展示在输入框上方，帮助用户回忆上下文）。 */
  question?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function ClarifyInputDialog({
  open,
  initialText,
  question,
  confirmText = "确认发送",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: ClarifyInputDialogProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 打开时重置文本并自动 focus（延迟一帧让 DOM 渲染完成）。
  useEffect(() => {
    if (!open) return;
    setText(initialText);
    const timer = setTimeout(() => textareaRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open, initialText]);

  const handleConfirm = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }, [text, onConfirm]);

  // Esc 取消 / ⌘+Enter、Ctrl+Enter 确认。
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onCancel, handleConfirm]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="confirm-dialog clarify-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarify-title"
      >
        <div className="confirm-header">
          <MessageSquarePlus size={18} className="clarify-dialog-icon" />
          <h3 id="clarify-title">确认回复</h3>
        </div>
        {question && (
          <p className="clarify-dialog-question">{question}</p>
        )}
        <textarea
          ref={textareaRef}
          className="clarify-dialog-input"
          aria-label="回复内容"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
        />
        <p className="clarify-dialog-hint">
          确认后将作为消息发送给 KStock；⌘/Ctrl+Enter 快捷发送。
        </p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="confirm-btn primary"
            onClick={handleConfirm}
            disabled={!text.trim()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
