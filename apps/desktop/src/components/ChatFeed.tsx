// 对话流聚合骨架：user 右对齐气泡 + assistant 无气泡 turn。
// 自动滚动：流式时跟随到底，用户上滚（距底 > 80px）时暂停跟随。
// 空状态：优先渲染 emptySlot（Home 传入 quick-prompt 区），否则简单文案。

import { useEffect, useRef, type ReactNode } from "react";
import type { ChatMessage } from "../lib/sessionStore";
import { UserBubble } from "./UserBubble";
import { AssistantTurn } from "./AssistantTurn";

interface ChatFeedProps {
  messages: ChatMessage[];
  /** 流式中的 assistant turn id（高亮 + 滚动跟随）。 */
  streamingId?: string;
  /** 空状态插槽（Home 的 quick-prompt 区）。 */
  emptySlot?: ReactNode;
}

export function ChatFeed({ messages, streamingId, emptySlot }: ChatFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < 80;
  };

  // 消息变化时若贴底则滚动到底（流式跟随）
  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return <div className="chat-feed empty">{emptySlot}</div>;
  }

  return (
    <div className="chat-feed" ref={scrollRef} onScroll={handleScroll}>
      <div className="chat-feed-inner">
        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} msg={m} />
          ) : (
            <AssistantTurn key={m.id} msg={m} isStreaming={m.id === streamingId} />
          )
        )}
      </div>
    </div>
  );
}
