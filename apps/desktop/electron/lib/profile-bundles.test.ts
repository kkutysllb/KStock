import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANIMATIONS_BUNDLE,
  PROFILE_BUNDLES,
  SCHEDULE_BUNDLE,
  withAnimationsBundle,
  withScheduleBundle,
} from "./profile-bundles";

test("产品叠层为五层：调度层在动效层之后、@kstock/web 末位最权威", () => {
  assert.deepEqual(PROFILE_BUNDLES, [
    "@qilin/base",
    "@qilin/web-app",
    ANIMATIONS_BUNDLE,
    SCHEDULE_BUNDLE,
    "@kstock/web",
  ]);
});

test("空列表回落到完整产品叠层", () => {
  assert.deepEqual(withAnimationsBundle([]), PROFILE_BUNDLES);
});

test("缺层时插到 @qilin/web-app 之后（对齐上游模板位置）", () => {
  assert.deepEqual(
    withAnimationsBundle(["@qilin/base", "@qilin/web-app", "@kstock/web"]),
    ["@qilin/base", "@qilin/web-app", ANIMATIONS_BUNDLE, "@kstock/web"],
  );
});

test("已存在时返回同一引用（写入收敛，不重复改盘）", () => {
  const current = ["@qilin/base", "@qilin/web-app", ANIMATIONS_BUNDLE, "@kstock/web"];
  assert.equal(withAnimationsBundle(current), current);
});

test("保留用户自加条目与原顺序", () => {
  assert.deepEqual(
    withAnimationsBundle(["@qilin/base", "@qilin/web-app", "user-bundle", "@kstock/web"]),
    ["@qilin/base", "@qilin/web-app", ANIMATIONS_BUNDLE, "user-bundle", "@kstock/web"],
  );
});

test("锚点缺失时追加到末尾", () => {
  assert.deepEqual(withAnimationsBundle(["@qilin/base"]), ["@qilin/base", ANIMATIONS_BUNDLE]);
});

test("缺调度层时插到 dsh-animations 之后（@kstock/web 保持在末位）", () => {
  assert.deepEqual(
    withScheduleBundle(["@qilin/base", "@qilin/web-app", "dsh-animations", "@kstock/web"]),
    ["@qilin/base", "@qilin/web-app", "dsh-animations", SCHEDULE_BUNDLE, "@kstock/web"],
  );
});

test("已含调度层时返回同一引用（写盘收敛）", () => {
  const current = ["@qilin/base", "@qilin/web-app", "dsh-animations", SCHEDULE_BUNDLE, "@kstock/web"];
  assert.equal(withScheduleBundle(current), current);
});

test("无动效层时锚定 @qilin/web-app 之后", () => {
  assert.deepEqual(
    withScheduleBundle(["@qilin/base", "@qilin/web-app", "@kstock/web"]),
    ["@qilin/base", "@qilin/web-app", SCHEDULE_BUNDLE, "@kstock/web"],
  );
});

test("空列表同样回落到五层产品叠层（调度层迁移）", () => {
  assert.deepEqual(withScheduleBundle([]), PROFILE_BUNDLES);
});
