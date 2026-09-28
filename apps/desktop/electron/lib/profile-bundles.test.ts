import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANIMATIONS_BUNDLE,
  PROFILE_BUNDLES,
  withAnimationsBundle,
} from "./profile-bundles";

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
