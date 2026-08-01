import { useRef } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import type { UploadedFileRef } from "../lib/turnsClient";

/**
 * 附件选择按钮（放 composer-toolbar 内）。
 *
 * 只渲染隐藏 input + 「附件」按钮；点击触发文件选择。
 * 已选附件的 chips 列表由 {@link AttachmentChips} 单独渲染（放 textarea 上方），
 * 让按钮和 chips 各自占位、互不干扰。
 *
 * 状态由父组件（Home）管理——本组件只做：onClick → 触发 input.click()，
 * onChange → 回调 onPickFiles(FileList)。
 */
interface AttachmentPickerProps {
  loading: boolean;
  /** 无可用会话 / 流式生成中时禁用选择按钮。 */
  disabled: boolean;
  disabledReason?: string;
  onPickFiles: (files: FileList) => void;
}

export function AttachmentPicker({
  loading,
  disabled,
  disabledReason,
  onPickFiles,
}: AttachmentPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <button
        type="button"
        className="attachment-pick-button"
        disabled={disabled || loading}
        title={disabled ? (disabledReason || "不可用") : "添加附件"}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={15} />
        <span>附件</span>
      </button>
    </div>
  );
}

/**
 * 已选附件 chips 列表（放 composer-dock 的 textarea 上方）。
 *
 * 有附件或上传中时渲染，无附件时返回 null（不占位）。
 * 点 × 移除附件（回调 onRemove → 父组件删除引擎文件并移除 chip）。
 */
interface AttachmentChipsProps {
  attachments: UploadedFileRef[];
  loading: boolean;
  onRemove: (filename: string) => void;
}

export function AttachmentChips({ attachments, loading, onRemove }: AttachmentChipsProps) {
  if (attachments.length === 0 && !loading) return null;
  return (
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
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
