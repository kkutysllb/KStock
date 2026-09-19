/**
 * `@kstock/client-datasources` — 设置页「数据源」分区（浏览器半端）。
 *
 * 状态与保存都走 `/kstock-api/data-sources`（同源会话鉴权，与量化四库
 * 页面同一数据面）：GET 展示脱敏状态，PUT 合并写 secrets.env 并提示
 * 重启引擎生效。凭据永不回传明文（服务端只回 masked）。
 * @module @kstock/client-datasources
 */

import type { Context as ClientContext } from '@qilin/kylin'
import { DataSourcesSection, type DataSourcesSectionInjected } from './section.tsx'

const zh = {
  'nav': '数据源',
  'title': '数据源凭据',
  'desc': '投研技能的数据获取凭据。保存后重启引擎生效（技能脚本经引擎环境读取）。',
  'configured': '已配置',
  'notConfigured': '未配置',
  'notPersisted': '仅环境注入，未持久化',
  'tokenPlaceholder': '输入新 Token / Key（留空保持不变）',
  'clear': '清除已保存的凭据',
  'save': '保存',
  'saving': '保存中…',
  'saved': '已保存，重启引擎后生效（托盘菜单可重启）',
  'saveFailed': '保存失败',
  'envName': '环境变量',
} as const

const en: Record<keyof typeof zh, string> = {
  'nav': 'Data Sources',
  'title': 'Data source credentials',
  'desc': 'Credentials for research skills. Saved to secrets.env; restart the engine to apply.',
  'configured': 'Configured',
  'notConfigured': 'Not configured',
  'notPersisted': 'Injected via env only, not persisted',
  'tokenPlaceholder': 'Enter new token / key (leave blank to keep)',
  'clear': 'Clear saved credential',
  'save': 'Save',
  'saving': 'Saving…',
  'saved': 'Saved. Restart the engine to apply (tray menu).',
  'saveFailed': 'Save failed',
  'envName': 'Environment variable',
}

/** 必需服务：槽位注册表 + locale 注册表。 */
export const inject = ['slots', 'locale'] as const

/**
 * 挂载设置分区：注册进 settings.section（ui-agent-preset 同款槽位；本插件
 * 自有 locale 命名空间，不与上游字典冲突）。
 * @param ctx - 浏览器插件根上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('settings.kstockDataSources', { zh, en }), 'kstock-datasources: dictionaries')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'kstock-data-sources',
    order: 30,
    label: () => ctx.locale.bind('settings.kstockDataSources')('nav'),
    locale: 'settings.kstockDataSources',
    inject: (): DataSourcesSectionInjected => ({
      load: () => DataSourcesSection.load(),
      save: (values) => DataSourcesSection.save(values),
    }),
  }, DataSourcesSection))
}
