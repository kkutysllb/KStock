import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeDescriptor } = require("../scripts/generate.js");

test("normalizes a line chart into an offline descriptor", () => {
  const descriptor = normalizeDescriptor({
    tool: "generate_line_chart",
    args: { data: [{ date: "2026-01", close: 10 }, { date: "2026-02", close: 12 }] },
  });
  assert.equal(descriptor.mode, "offline");
  assert.equal(descriptor.status, "ready");
  assert.deepEqual(descriptor.args.data, [
    { time: "2026-01", value: 10, group: "close" },
    { time: "2026-02", value: 12, group: "close" },
  ]);
});

test("normalization does not call the network", () => {
  globalThis.fetch = () => { throw new Error("network must not be used"); };
  const descriptor = normalizeDescriptor({
    tool: "generate_bar_chart",
    args: { data: [{ category: "A", value: 1 }] },
  });
  assert.equal(descriptor.type, "bar");
});

test("map charts fall back without embedded offline geography", () => {
  const descriptor = normalizeDescriptor({
    tool: "generate_district_map",
    args: { title: "地区", data: [{ name: "华东", value: 1 }] },
  });
  assert.equal(descriptor.status, "fallback");
  assert.match(descriptor.reason, /离线地理数据/);
});

test("rejects unknown argument fields", () => {
  assert.throws(
    () => normalizeDescriptor({ tool: "generate_line_chart", args: { data: [], unsupported: true } }),
    /Unknown args field/,
  );
});
