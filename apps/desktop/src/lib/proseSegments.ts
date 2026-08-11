/**
 * proseSegments — 把长 markdown 文本按 H1/H2 标题切分成多段。
 *
 * 用途：AssistantTurn 渲染报告类消息时，把单一 markdown blob 拆为多个
 * 视觉独立的卡片，提升可读性（如可转债周报 6 章节、行业深度 4 章节）。
 *
 * 切分规则：
 *   - 仅按 H1（#）/ H2（##）切；H3 及以下保留在父段内（避免过碎）。
 *   - 标题前的开场白（首个标题之前的内容）作为 title=null 的首段。
 *   - 跳过代码块（```...```）与行内代码（`...`）内的 #，避免误切。
 *   - 流式安全：未闭合的代码块按"已闭合"处理，下次 chunk 重算。
 *
 * 性能：O(n) 单次扫描，5KB 文本 < 1ms。配合 useMemo 依赖 msg.text。
 */

export interface ProseSlice {
  /**
   * 段落标题文本（去掉 # 前缀），null 表示首段无标题（开场白/引言）。
   * 例："## 一、市场温度" → title = "一、市场温度"
   */
  title: string | null;
  /** 标题层级：1 = H1，2 = H2，0 = 无标题首段。 */
  level: 0 | 1 | 2;
  /** 该段 markdown 正文（不含标题行）。 */
  content: string;
}

const HEADING_RE = /^(#{1,2})\s+(.+?)\s*$/;

/**
 * 把 markdown 文本切分为 ProseSlice[]。
 *
 * @param text 完整 markdown 文本（msg.text）
 * @returns ProseSlice[]。无任何 H1/H2 时返回单元素数组 [{title:null, level:0, content:text}]。
 */
export function splitProseByHeading(text: string): ProseSlice[] {
  if (!text || !text.trim()) {
    return [{ title: null, level: 0, content: text ?? "" }];
  }

  const slices: ProseSlice[] = [];
  const lines = text.split("\n");

  // 状态：是否在代码块内
  let inCodeFence = false;
  // 当前累积的段（content 累积行）
  let currentTitle: string | null = null;
  let currentLevel: 0 | 1 | 2 = 0;
  let currentLines: string[] = [];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (content || currentTitle !== null) {
      slices.push({
        title: currentTitle,
        level: currentLevel,
        content,
      });
    }
    currentTitle = null;
    currentLevel = 0;
    currentLines = [];
  };

  for (const line of lines) {
    // 代码块开关检测（``` 或 ~~~）
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      inCodeFence = !inCodeFence;
      currentLines.push(line);
      continue;
    }

    // 在代码块内：所有行都进当前段，不识别标题
    if (inCodeFence) {
      currentLines.push(line);
      continue;
    }

    // 行内代码（`...`）内的 # 不识别——简单粗暴：整行被反引号包围则跳过
    // 这种边界情况罕见，正则覆盖即可，不必精确解析 inline code
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch && !line.startsWith("`")) {
      // 遇到新标题：flush 当前段，开启新段
      flush();
      currentLevel = (headingMatch[1].length as 1 | 2);
      currentTitle = headingMatch[2];
    } else {
      currentLines.push(line);
    }
  }

  // flush 最后一段
  flush();

  // 若没有任何标题切分（slices 只有 1 个且 level=0），返回原文本单段
  if (slices.length === 0) {
    return [{ title: null, level: 0, content: text }];
  }

  // 边界：首段可能为空 content（如文本以 # 开头，第一行就是标题），
  // 此时 slices[0] 是 {title: null, level: 0, content: ""}，删除避免空段
  if (slices.length > 1 && slices[0].level === 0 && !slices[0].content) {
    return slices.slice(1);
  }

  return slices;
}

/**
 * 判断文本是否值得分段——至少 2 个 H1/H2 标题才算。
 * 用于 AssistantTurn 决定走原单 markdown 路径还是分段路径。
 */
export function shouldSplitProse(text: string): boolean {
  if (!text || text.length < 200) return false;
  // 快速扫描：行首 # 或 ## 的数量（粗略，不处理代码块边界，结果是上界）
  let count = 0;
  for (const line of text.split("\n")) {
    if (/^#{1,2}\s/.test(line)) {
      count++;
      if (count >= 2) return true;
    }
  }
  return false;
}
