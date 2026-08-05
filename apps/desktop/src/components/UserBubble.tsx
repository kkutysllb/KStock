import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil, Send, X } from "lucide-react";
import type { ChatMessage } from "../lib/sessionStore";

interface UserBubbleProps {
  msg: ChatMessage;
  canEdit?: boolean;
  editDisabled?: boolean;
  onEditResend?: (messageId: string, replacementText: string) => Promise<void>;
}

export function UserBubble({ msg, canEdit = false, editDisabled = false, onEditResend }: UserBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content ?? "");
      setError(null);
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setError("复制失败，请稍后重试");
    }
  };

  const handleSubmit = async () => {
    const replacementText = editText.trim();
    if (!replacementText || !onEditResend || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onEditResend(msg.id, replacementText);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新发送失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (editing) {
    return (
      <div
        className="user-message user-message-editing"
        data-testid={`user-${msg.id}`}
        data-editable={canEdit}
      >
        <div className="user-message-editor">
          <textarea
            aria-label="编辑用户消息"
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            disabled={submitting}
            autoFocus
          />
          <div className="user-message-editor-footer">
            <button
              className="user-message-editor-button user-message-editor-cancel"
              type="button"
              onClick={() => {
                setEditText(msg.content ?? "");
                setError(null);
                setEditing(false);
              }}
              disabled={submitting}
            >
              <X size={14} aria-hidden="true" />
              取消
            </button>
            <button
              className="user-message-editor-button user-message-editor-submit"
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !editText.trim() || !onEditResend}
            >
              <Send size={14} aria-hidden="true" />
              {submitting ? "准备中" : "重新发送"}
            </button>
          </div>
        </div>
        {error && <p className="user-message-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="user-message" data-testid={`user-${msg.id}`} data-editable={canEdit}>
      <article className="user-bubble" aria-label="用户消息">
        <p>{msg.content}</p>
      </article>
      <div className="user-message-actions" aria-label="消息操作">
        <button
          className="user-message-action"
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? "已复制" : "复制消息"}
          title={copied ? "已复制" : "复制消息"}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
        <button
          className="user-message-action"
          type="button"
          onClick={() => {
            setEditText(msg.content ?? "");
            setError(null);
            setEditing(true);
          }}
          aria-label="编辑消息"
          title={canEdit ? "编辑消息" : "该消息暂不可编辑"}
          disabled={!canEdit || editDisabled || !onEditResend}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="user-message-error" role="alert">{error}</p>}
    </div>
  );
}
