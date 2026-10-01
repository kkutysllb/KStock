/**
 * kstock profile 的 bundle 叠层与幂等迁移（纯函数：不依赖 electron，便于单测）。
 *
 * 叠层顺序即 patch 应用顺序，末位最权威：
 *   @qilin/base → @qilin/web-app → dsh-animations（上游内置动效技能库）
 *   → @qilin/experimental-schedule-bundle（3.0.7 原生调度三件套）
 *   → @kstock/web（KStock 产品层，可覆写上面任意一行）
 *
 * 引擎 3.0.5 起把 dsh-animations 种在 web / qilin 两个 shipped 模板里；kstock
 * profile 名不在引擎的 PROFILE_TEMPLATES 内（app-boot/src/profile.ts:997 直接
 * 返回），因此必须由本模块显式补层——否则动效技能库对产品不可见。
 * 3.0.7 起调度三件套（time-context / schedule / ui-schedule）撤入
 * @qilin/experimental-schedule-bundle（OPTIONAL_BUNDLES 第四项），同理补层
 * ——它是 KStock 2.x 的定时任务承载（替代已退役的 @kstock/automation）。
 */

/** 上游内置动效技能库的包名（与引擎 ANIMATIONS_BUNDLE 同值）。 */
export const ANIMATIONS_BUNDLE = "dsh-animations";

/**
 * 引擎原生调度 bundle（3.0.7 `OPTIONAL_BUNDLES` 成员）：随包挂载
 * time-context / schedule / ui-schedule 三行开启态组合——KStock 2.x 的
 * 定时任务承载（替代已退役的 @kstock/automation）。
 */
export const SCHEDULE_BUNDLE = "@qilin/experimental-schedule-bundle";

/** 产品 bundle 叠层：新 profile 的初始值，也是空列表的回退。 */
export const PROFILE_BUNDLES = [
  "@qilin/base",
  "@qilin/web-app",
  ANIMATIONS_BUNDLE,
  SCHEDULE_BUNDLE,
  "@kstock/web",
] as const;

/**
 * 幂等补上动效技能库层。缺失时插到 `@qilin/web-app` 之后（对齐上游模板位置），
 * 保留用户或引擎追加的其它条目与原顺序；已存在时**返回同一引用**表示无需写盘，
 * 使启动期的写入收敛（不会每次启动都改 profile 清单）。
 *
 * @param bundles - profile 现有的 `qilin.profile.bundles`。
 * @returns 下一次应写入的列表；与入参同一引用即无需改动。
 */
export function withAnimationsBundle(bundles: readonly string[]): readonly string[] {
  if (bundles.length === 0) return PROFILE_BUNDLES;
  if (bundles.includes(ANIMATIONS_BUNDLE)) return bundles;
  const anchor = bundles.indexOf("@qilin/web-app");
  const next = [...bundles];
  next.splice(anchor >= 0 ? anchor + 1 : next.length, 0, ANIMATIONS_BUNDLE);
  return next;
}

/**
 * 幂等补上引擎调度层。缺失时插到 `dsh-animations` 之后（无动效层则锚定
 * `@qilin/web-app` 之后），保证 `@kstock/web` 始终末位最权威；已存在时
 * 返回同一引用表示无需写盘（与 withAnimationsBundle 同收敛语义）。
 *
 * @param bundles - profile 现有的 `qilin.profile.bundles`。
 * @returns 下一次应写入的列表；与入参同一引用即无需改动。
 */
export function withScheduleBundle(bundles: readonly string[]): readonly string[] {
  if (bundles.length === 0) return PROFILE_BUNDLES;
  if (bundles.includes(SCHEDULE_BUNDLE)) return bundles;
  const animations = bundles.indexOf(ANIMATIONS_BUNDLE);
  const anchor = animations >= 0 ? animations : bundles.indexOf("@qilin/web-app");
  const next = [...bundles];
  next.splice(anchor >= 0 ? anchor + 1 : next.length, 0, SCHEDULE_BUNDLE);
  return next;
}
