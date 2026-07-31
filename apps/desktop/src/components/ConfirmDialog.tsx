// 通用确认对话框：替代 window.confirm（Tauri webview 中可能不弹窗或被屏蔽）。
//
// 设计：
// - 受控组件：open + title + description + confirmText/cancelText + onConfirm/onCancel
// - Esc 取消、Enter 确认、点遮罩取消
// - confirm 风格（危险操作用 tone="danger" 红色按钮）
// - 自动 focus 到取消按钮（防误触），危险操作时 focus 取消更安全

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  /** danger 統一紅色；primary 绿色。默认 danger。 */
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  tone = "danger",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 打开时自动 focus 取消按钮（防误触确认）。
  useEffect(() => {
    if (open) {
      // 延迟一帧让 DOM 渲染完成。
      const timer = setTimeout(() => cancelRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Esc 取消 / Enter 确认。
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onCancel, onConfirm]);

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
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <div className="confirm-header">
          <AlertTriangle size={18} className="confirm-icon" />
          <h3 id="confirm-title">{title}</h3>
        </div>
        <p id="confirm-desc" className="confirm-desc">
          {description}
        </p>
        <div className="confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-btn cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-btn ${tone === "danger" ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
