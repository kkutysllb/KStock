// user 消息气泡：右对齐、主题色背景、圆角、max-width 70%。

import type { ChatMessage } from "../lib/sessionStore";

interface UserBubbleProps {
  msg: ChatMessage;
}

export function UserBubble({ msg }: UserBubbleProps) {
  return (
    <article className="user-bubble" aria-label="用户消息">
      <p>{msg.content}</p>
    </article>
  );
}
