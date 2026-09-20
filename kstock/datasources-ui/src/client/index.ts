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
import { QuantWorkspaceSection, type QuantWorkspaceSectionInjected } from './workspace-section.tsx'

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

/** 必需服务：槽位注册表 + locale 注册表 + 工作区 UI（原生目录选择）。 */
export const inject = ['slots', 'locale', 'uiWorkspace'] as const

/** uiWorkspace 服务的最小结构面（目录选择对话框）。 */
interface WorkspaceFace {
  pickDirectory(): Promise<string | null>
}

/** 挂载设置分区的插件上下文（uiWorkspace 按 upstream 契约调用）。 */
type DatasourcesClientContext = ClientContext & { uiWorkspace: WorkspaceFace }

/**
 * 挂载设置分区：注册进 settings.section（ui-agent-preset 同款槽位；本插件
 * 自有 locale 命名空间，不与上游字典冲突）。
 * @param ctx - 浏览器插件根上下文。
 */
export function apply(ctx: DatasourcesClientContext): void {
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

  // 量化工作区（§26-9 智能路由配置面）：同一设置页的第二个分区，
  // 独立 locale 命名空间；保存即时生效（sendRouted 每次读取）。
  // 目录选择走 uiWorkspace.pickDirectory()（宿主原生 OS 对话框，
  // web bundle 的 host-directory-picker-auto 自动挑原生后端）。
  const wsZh = {
    'nav': '量化工作区',
    'title': '量化工作区',
    'desc': '财经新闻/选股库「解读」等联动任务的目标工作区：当前会话不在该工作区时自动路由过去（复用空会话或最近会话）。未配置 = 跟随当前会话。',
    'current': '当前',
    'notConfigured': '未配置（联动跟随当前会话）',
    'pick': '选择目录…',
    'picking': '选择中…',
    'clear': '清除',
    'clearing': '清除中…',
    'saved': '已保存，即时生效',
    'cleared': '已清除，联动跟随当前会话',
    'pickFailed': '目录选择失败',
    'cancelled': '已取消选择，配置未变',
  } as const
  type WsKey = keyof typeof wsZh
  const wsEn: Record<WsKey, string> = {
    'nav': 'Quant Workspace',
    'title': 'Quant workspace',
    'desc': 'Target workspace for interpret actions (news/selections): routed automatically when the current session lives elsewhere. Not configured = follow current session.',
    'current': 'Current',
    'notConfigured': 'Not configured (follows current session)',
    'pick': 'Choose directory…',
    'picking': 'Choosing…',
    'clear': 'Clear',
    'clearing': 'Clearing…',
    'saved': 'Saved. Takes effect immediately',
    'cleared': 'Cleared. Follows current session',
    'pickFailed': 'Directory picker failed',
    'cancelled': 'Cancelled, configuration unchanged',
  }
  ctx.locale.register('settings.kstockQuantWorkspace', { zh: wsZh, en: wsEn })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'kstock-quant-workspace',
    order: 31,
    label: () => ctx.locale.bind('settings.kstockQuantWorkspace')('nav'),
    locale: 'settings.kstockQuantWorkspace',
    inject: (): QuantWorkspaceSectionInjected => ({
      load: () => QuantWorkspaceSection.load(),
      save: (path) => QuantWorkspaceSection.save(path),
      pick: () => ctx.uiWorkspace.pickDirectory(),
    }),
  }, QuantWorkspaceSection))
}
