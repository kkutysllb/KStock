// 对话流聚合骨架：user 右对齐气泡 + assistant 无气泡 turn。
// 自动滚动：流式时跟随到底，用户上滚（距底 > 80px）时暂停跟随，
// 并通过 onAtBottomChange 通知父级（用于显示「回到底部」浮动按钮）。
// 父级可通过 ref 调用 scrollToBottom() 强制滚回底部。
// 空状态：优先渲染 emptySlot（Home 传入 quick-prompt 区），否则简单文案。

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage } from "../lib/sessionStore";
import { UserBubble } from "./UserBubble";
import { AssistantTurn } from "./AssistantTurn";

/** ChatFeed 向外暴露的命令式接口（用于「回到底部」按钮）。 */
export interface ChatFeedHandle {
  /** 滚到底部。behavior 默认 auto，可传 smooth 平滑滚动。 */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

interface ChatFeedProps {
  messages: ChatMessage[];
  /** 流式中的 assistant turn id（高亮 + 滚动跟随）。 */
  streamingId?: string;
  /** 空状态插槽（Home 的 quick-prompt 区）。 */
  emptySlot?: ReactNode;
  /** 贴底状态变化回调（true=在底部，false=用户上滚）。 */
  onAtBottomChange?: (atBottom: boolean) => void;
  /** ask_clarification 选项被选中并点“加入输入框”时回调（透传给 AssistantTurn）。 */
  onClarifyPick?: (text: string) => void;
}

const STICK_THRESHOLD_PX = 80;

export const ChatFeed = forwardRef<ChatFeedHandle, ChatFeedProps>(
  function ChatFeed({ messages, streamingId, emptySlot, onAtBottomChange, onClarifyPick }, ref) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    const [atBottom, setAtBottom] = useState(true);

    const computeAtBottom = useCallback((el: HTMLElement) => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      return distance < STICK_THRESHOLD_PX;
    }, []);

    const handleScroll = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const next = computeAtBottom(el);
      stickToBottom.current = next;
      if (next !== atBottom) {
        setAtBottom(next);
        onAtBottomChange?.(next);
      }
    }, [atBottom, computeAtBottom, onAtBottomChange]);

    // 滚到底部（外部命令式调用）
    const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      stickToBottom.current = true;
      if (!atBottom) {
        setAtBottom(true);
        onAtBottomChange?.(true);
      }
    }, [atBottom, onAtBottomChange]);

    useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

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
              <AssistantTurn
                key={m.id}
                msg={m}
                isStreaming={m.id === streamingId}
                onClarifyPick={onClarifyPick}
              />
            )
          )}
        </div>
      </div>
    );
  }
);
