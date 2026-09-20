/**
 * KStock 品牌层客户端插件：token 覆盖 + 环境背景 + 品牌标记 + 品牌文案，一次挂载。
 *
 * 层叠语义与上游 @qilin/client-ui-theme-brand 一致：品牌层叠加在用户
 * 已选明/暗方案之上，插件卸载时整层撤销（ctx.effect 清理函数）。
 */

import type { Context as ClientContext } from '@qilin/kylin'
import type {} from '@qilin/client-ui-conversation/client'
import type {} from '@qilin/client-ui-sidebar/client'
import type {} from '@qilin/client-ui-theme/client'
import { applyBackgroundCss } from './background.ts'
import { KStockArtistMark, KStockHeroMark, KStockMark, KStockWordmark } from './Marks.tsx'
import { KSTOCK_THEME_SOURCE, KSTOCK_TOKENS } from './tokens.ts'
import { applyThemeWatcher, applyUiFixesCss, applyWindowChromeCss } from './windowChrome.ts'

/** 必需服务：槽位注册表（品牌标记）、主题注册表（token 覆盖）、locale 注册表（品牌文案）。 */
export const inject = ['slots', 'theme', 'locale']

/**
 * KStock 语言策略：不注册任何语言与字典。
 *
 * locale.register 对「同一 namespace + 同一 locale」重复注册直接抛错（上游
 * locale 插件已注册 common/conversation 的 zh/en），addLanguage 则会把
 * 「KStock 中文/English」加进语言菜单——两者都不可用。产品文案以
 * KStockHeroMark 等品牌槽位呈现（上游 web-brand 同款做法：品牌=标记层，
 * 文案烙在出厂字典）。唯一保留的行为：未显式选择语言时产品默认中文。
 */
function applyBrandLocale(ctx: ClientContext): () => void {
  const active = ctx.locale.getSnapshot().active
  if (active !== 'zh' && active !== 'en') {
    // 产品默认中文；用户此后在设置里显式选择的语言会在会话间保持。
    ctx.locale.setLocale('zh')
  }
  return () => {}
}

/**
 * 挂载 KStock 品牌层。品牌标记与品牌名的槽位注册方式与上游
 * @qilin/client-ui-brand 同构：侧栏标记/名字与 hero 标记共用一组嵌套
 * 注册（slots.inject 等待 ui-sidebar 的声明），关于页标记独立注册。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposeTokens = ctx.theme.overrideTokens(KSTOCK_THEME_SOURCE, KSTOCK_TOKENS)
    const disposeBackground = applyBackgroundCss()
    const disposeUiFixes = applyUiFixesCss()
    const disposeWindowChrome = applyWindowChromeCss()
    // 壳主题探测（仅 Electron）：明暗切换上报主进程，驱动窗口底色与
    // Windows WCO overlay 热切换（chrome.ts 壳主题桥）。
    const disposeThemeWatcher = applyThemeWatcher()
    const disposeMarks = ctx.slots.inject('sidebar.brand.mark', () =>
      ctx.slots.inject('sidebar.brand.name', () =>
        ctx.slots.inject('conversation.hero.brand.mark', function* () {
          yield ctx.slots.register({ name: 'sidebar.brand.mark' }, KStockMark)
          yield ctx.slots.register({ name: 'sidebar.brand.name' }, KStockWordmark)
          yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, KStockHeroMark)
        }),
      ),
    )
    const disposeAbout = ctx.slots.inject('settings.about.mark', () =>
      ctx.slots.register({ name: 'settings.about.mark' }, KStockArtistMark),
    )
    const disposeLocale = applyBrandLocale(ctx)
    return () => {
      disposeLocale()
      disposeAbout()
      disposeMarks()
      disposeThemeWatcher()
      disposeWindowChrome()
      disposeUiFixes()
      disposeBackground()
      disposeTokens()
    }
  }, 'kstock: brand layer')
}
