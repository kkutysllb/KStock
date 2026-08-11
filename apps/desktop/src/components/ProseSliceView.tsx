/**
 * ProseSlice — 单个 markdown 段落渲染组件。
 *
 * 用于 AssistantTurn 把长报告按 H1/H2 切分后的多段渲染。
 * 每段独立 <Markdown>，配独立卡片样式，标题用 KStock 绿色高亮。
 *
 * 流式 spinner 仅在最后一段且 streaming=true 时显示。
 */

import { Markdown } from "../lib/markdown";
import type { ProseSlice } from "../lib/proseSegments";

interface ProseSliceViewProps {
  slice: ProseSlice;
  /** 是否为最后一段（用于决定是否显示流式 spinner）。 */
  isLast: boolean;
  /** 整条消息是否在流式输出中。 */
  streaming?: boolean;
}

export function ProseSliceView({ slice, isLast, streaming }: ProseSliceViewProps) {
  const hasTitle = slice.title !== null && slice.level > 0;
  const showSpinner = isLast && streaming;

  if (!hasTitle) {
    // 无标题首段（开场白/引言）——无卡片边框，融入父容器
    return (
      <div className="prose-slice prose-slice-lead">
        {slice.content && <Markdown>{slice.content}</Markdown>}
        {showSpinner && (
          <span className="streaming-candles" aria-hidden="true">
            <span className="candle" />
            <span className="candle" />
            <span className="candle" />
            <span className="candle" />
          </span>
        )}
      </div>
    );
  }

  // 有标题段——独立卡片
  const headingTag = slice.level === 1 ? "h2" : "h3"; // H1 在视觉上作为段标题用 h2，H2 用 h3
  const HeadingComponent = headingTag;

  return (
    <section className={`prose-slice prose-slice-level-${slice.level}`}>
      <header className="prose-slice-header">
        <HeadingComponent className="prose-slice-title">
          {slice.title}
        </HeadingComponent>
      </header>
      <div className="prose-slice-body">
        {slice.content && <Markdown>{slice.content}</Markdown>}
        {showSpinner && (
          <span className="streaming-candles" aria-hidden="true">
            <span className="candle" />
            <span className="candle" />
            <span className="candle" />
            <span className="candle" />
          </span>
        )}
      </div>
    </section>
  );
}

export default ProseSliceView;
