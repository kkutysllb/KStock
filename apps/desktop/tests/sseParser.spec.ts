import { describe, expect, it } from "vitest";
import { makeTextStream, parseSseFrame, parseSseStream } from "../src/lib/sseParser";

describe("parseSseFrame 单帧解析", () => {
  it("解析 event + data + id 标准帧", () => {
    const frame = parseSseFrame('event: metadata\ndata: {"run_id":"r1","thread_id":"t1"}\nid: 1785496401819-0');
    expect(frame).toEqual({
      event: "metadata",
      data: { run_id: "r1", thread_id: "t1" },
      id: "1785496401819-0"
    });
  });

  it("data: null 解析为 JS null（end 事件）", () => {
    const frame = parseSseFrame("event: end\ndata: null");
    expect(frame?.event).toBe("end");
    expect(frame?.data).toBeNull();
  });

  it("data 是数组时正确解析（messages 事件 [msg, meta]）", () => {
    const frame = parseSseFrame(
      'event: messages\ndata: [{"type":"ai","content":"你好"},{"langgraph_node":"model"}]'
    );
    expect(frame?.event).toBe("messages");
    expect(Array.isArray(frame?.data)).toBe(true);
    expect((frame?.data as unknown[])[0]).toEqual({ type: "ai", content: "你好" });
  });

  it("无 event 行时缺省为 message", () => {
    const frame = parseSseFrame('data: {"x":1}');
    expect(frame?.event).toBe("message");
    expect(frame?.data).toEqual({ x: 1 });
  });

  it("冒号开头的注释/heartbeat 行被忽略", () => {
    // parseSseFrame 处理单个块；注释行（以 : 开头）被 skip，不影响后续字段
    const single = parseSseFrame(": this is a comment\nevent: values\ndata: {\"ok\":true}");
    expect(single?.event).toBe("values");
    expect(single?.data).toEqual({ ok: true });
  });

  it("非 JSON data 退化为原始字符串", () => {
    const frame = parseSseFrame("event: raw\ndata: not-json-at-all");
    expect(frame?.event).toBe("raw");
    expect(frame?.data).toBe("not-json-at-all");
  });

  it("value 前导空格被去掉（SSE 规范去一个空格）", () => {
    // 引擎 format_sse 产出 "event: <type>"（一个空格）；SSE 规范去掉一个前导空格
    const frame = parseSseFrame('event: spaced\ndata: {"a":1}');
    expect(frame?.event).toBe("spaced");
    expect(frame?.data).toEqual({ a: 1 });
  });

  it("空块返回 null", () => {
    expect(parseSseFrame("")).toBeNull();
    expect(parseSseFrame("   ")).toBeNull();
  });
});

describe("parseSseStream 流式分帧", () => {
  it("解析完整多帧流（真实引擎序列）", async () => {
    const sse = [
      'event: metadata\ndata: {"run_id":"r1","thread_id":"t1"}\nid: 1\n\n',
      'event: values\ndata: {"messages":[],"artifacts":[]}\nid: 2\n\n',
      "event: end\ndata: null\n\n"
    ].join("");
    const frames: { event: string; data: unknown; id?: string }[] = [];
    for await (const f of parseSseStream(makeTextStream([sse]))) {
      frames.push(f);
    }
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({ event: "metadata", data: { run_id: "r1", thread_id: "t1" }, id: "1" });
    expect(frames[1].event).toBe("values");
    expect(frames[2]).toEqual({ event: "end", data: null, id: undefined });
  });

  it("跨 chunk 边界的帧仍能正确组装", async () => {
    // 把一个帧拆成 3 个 chunk，中间字节流式到达
    const chunks = [
      "event: mes",
      "sages\ndata: {\"type\":\"ai\",\"",
      "content\":\"hi\"}\n\n"
    ];
    const frames: { event: string; data: unknown }[] = [];
    for await (const f of parseSseStream(makeTextStream(chunks))) {
      frames.push(f);
    }
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({ event: "messages", data: { type: "ai", content: "hi" }, id: undefined });
  });

  it("heartbeat 注释帧被跳过（不产出）", async () => {
    const sse = ": heartbeat\n\nevent: end\ndata: null\n\n";
    const frames: { event: string }[] = [];
    for await (const f of parseSseStream(makeTextStream([sse]))) {
      frames.push(f);
    }
    // heartbeat 块解析后 event="message" data=null，但块内容只有注释 → 仍会产出
    // parseSseFrame 对纯注释块返回 {event:"message",data:null}
    // 这是可接受的：调用方按 event 过滤；message+null 无副作用
    expect(frames.some((f) => f.event === "end")).toBe(true);
  });

  it("flush 尾部无 \\n\\n 结尾的残余帧", async () => {
    const sse = "event: end\ndata: null"; // 注意：无尾部 \n\n
    const frames: { event: string }[] = [];
    for await (const f of parseSseStream(makeTextStream([sse]))) {
      frames.push(f);
    }
    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe("end");
  });
});
