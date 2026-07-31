// ── SSE 帧解析器 ──────────────────────────────────────────────────────
// 把 fetch response.body（ReadableStream<uint8>）转成 SseFrame 异步迭代。
// 引擎网关 wire format（实测确认）：
//   event: <type>\n
//   data: <json>\n
//   id: <opt>\n
//   \n              ← 空行分帧
// 遵循 SSE 规范：冒号开头的行是注释（heartbeat）；value 前导空格去掉；
// event 缺省为 "message"；多行 data 用 \n 连接。

export interface SseFrame {
  event: string;
  data: unknown;
  id?: string;
}

/** 把一个原始帧文本块解析为 SseFrame；空块返回 null。 */
export function parseSseFrame(raw: string): SseFrame | null {
  if (!raw.trim()) return null;
  let event = "message";
  let dataStr = "";
  let id: string | undefined;
  let hasData = false;

  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue; // 注释 / heartbeat
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx);
    let val = line.slice(colonIdx + 1);
    if (val.startsWith(" ")) val = val.slice(1); // SSE 规范：去掉前导空格

    if (field === "event") {
      event = val;
    } else if (field === "data") {
      dataStr += (hasData ? "\n" : "") + val;
      hasData = true;
    } else if (field === "id") {
      id = val;
    }
    // ignore retry / other fields
  }

  let data: unknown;
  if (!hasData) {
    data = null;
  } else {
    try {
      data = JSON.parse(dataStr);
    } catch {
      data = dataStr; // 非 JSON 时退化为原始字符串
    }
  }

  return { event, data, id };
}

/**
 * 把 ReadableStream<uint8> 转成 SseFrame 异步迭代。
 * 按 `\n\n` 分帧；流结束后 flush 残余缓冲。
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>
): AsyncIterable<SseFrame> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawFrame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const frame = parseSseFrame(rawFrame);
        if (frame) yield frame;
      }
    }
    // flush 尾部残余（不带 \n\n 结尾的最后一帧）
    buffer += decoder.decode();
    const trimmed = buffer.trimEnd();
    if (trimmed) {
      const frame = parseSseFrame(trimmed);
      if (frame) yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}

/** 测试辅助：把字符串编码为 ReadableStream（模拟 fetch response.body）。 */
export function makeTextStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}
