// Markdown 渲染：把 LLM 输出的 markdown 源文本解析为富文本 React 节点。
// 不再返回原始字符串（避免 ##、**、` 等语法符号泄露到 UI）。
//
// 设计：
// - Markdown 组件：用 react-markdown + remark-gfm，解析标准 markdown +
//   GFM（表格/删除线/任务列表/自动链接），渲染成语义 HTML。
// - normalizeMarkdown：保留给 ReportPanel <pre> 等纯文本场景（只做 trim +
//   压缩空行，不做语法清理——那种场景就是要显示源文本）。
//
// 安全：react-markdown 默认不执行 HTML（raw HTML 会被转义显示），
// 无需额外 sanitize。如未来需要嵌入受信 HTML，再单独评估。

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  /** 自定义渲染组件映射（可选，如覆盖 a/code 的样式）。 */
  components?: React.ComponentProps<typeof ReactMarkdown>["components"];
}

/** 内部默认渲染组件映射：统一 a 链接行为 + 代码块样式钩子。 */
const defaultComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  a(props) {
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

export const Markdown = memo(function Markdown({ children, components }: MarkdownProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components ?? defaultComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
});

/**
 * 纯文本场景的简单清洗：trim + 压缩连续空行。
 * 用于 ReportPanel `<pre>` 等需要显示源文本的地方（不解析语法）。
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown.trim().replace(/\n{3,}/g, "\n\n");
}
