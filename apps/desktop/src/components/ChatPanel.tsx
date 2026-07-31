import { RefreshCw, Send } from "lucide-react";
import type { ChatSession } from "../lib/sessionStore";

interface ChatPanelProps {
  session: ChatSession | undefined;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onRefresh: () => void;
}

export function ChatPanel({ session, draft, onDraftChange, onSend, onRefresh }: ChatPanelProps) {
  const messages = session?.messages ?? [];

  return (
    <section className="panel chat-panel" aria-label="聊天工作台">
      <div className="panel-heading">
        <div>
          <h1>KStock</h1>
          <p>股票量化智能体桌面端</p>
        </div>
        <button className="text-button" type="button" onClick={onRefresh}>
          <RefreshCw size={16} />
          <span>新会话</span>
        </button>
      </div>
      <div className="message-feed" aria-label="消息列表">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>把你的研究问题直接告诉我</h2>
            <p>我会调用精选技能，生成分析和报告。</p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble ${message.role}`}
              aria-label={message.role === "user" ? "用户消息" : "助手消息"}
            >
              <strong>{message.role === "user" ? "你" : "KStock"}</strong>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>
      <div className="composer">
        <label className="message-label" htmlFor="message-input">
          消息输入
        </label>
        <textarea
          id="message-input"
          className="message-input"
          value={draft}
          placeholder="例如：分析贵州茅台最近一季财报，并生成研究报告。"
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <div className="composer-actions">
        <span className="inline-chip">本地 sidecar 已连接</span>
        <button className="primary-button" type="button" onClick={onSend}>
          <Send size={16} />
          <span>发送</span>
          </button>
        </div>
      </div>
    </section>
  );
}
