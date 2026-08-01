import { useRef } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import type { UploadedFileRef } from "../lib/turnsClient";

/**
 * 输入区附件选择器：渲染已选附件 chips + 文件选择按钮。
 *
 * 状态由父组件（Home）管理——本组件只做展示 + 回调：
 *   onPickFiles(FileList) → 父组件上传并追加 pendingAttachments
 *   onRemove(filename)    → 父组件删除引擎文件并移除 chip
 *
 * 无附件时仍渲染「附件」按钮（紧凑模式）；有附件或 loading 时展开 chips 区。
 */
interface AttachmentPickerProps {
  attachments: UploadedFileRef[];
  loading: boolean;
  /** 无可用会话 / 流式生成中时禁用选择按钮。 */
  disabled: boolean;
  disabledReason?: string;
  onPickFiles: (files: FileList) => void;
  onRemove: (filename: string) => void;
}

export function AttachmentPicker({
  attachments,
  loading,
  disabled,
  disabledReason,
  onPickFiles,
  onRemove,
}: AttachmentPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAttachments = attachments.length > 0;

  return (
    <div className="attachment-picker">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="attachment-file-input"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onPickFiles(e.target.files);
          }
          // 清空 value 允许重复选择同一文件
          e.target.value = "";
        }}
      />
      {(hasAttachments || loading) && (
        <div className="attachment-chips">
          {attachments.map((att) => (
            <span key={att.filename} className="attachment-chip" title={att.filename}>
              <Paperclip size={12} className="attachment-chip-icon" />
              <span className="attachment-chip-name">{att.filename}</span>
              <span className="attachment-chip-size">{formatFileSize(att.size)}</span>
              <button
                type="button"
                className="attachment-chip-remove"
                onClick={() => onRemove(att.filename)}
                aria-label={`移除附件 ${att.filename}`}
                disabled={loading}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {loading && (
            <span className="attachment-chip attachment-chip-loading">
              <Loader2 size={12} className="spin" />
              <span>上传中…</span>
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        className="attachment-pick-button"
        disabled={disabled}
        title={disabled ? (disabledReason || "不可用") : "添加附件"}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={15} />
        <span>附件</span>
      </button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
