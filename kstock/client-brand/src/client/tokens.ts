/**
 * KStock 品牌别名 token 覆盖，作为一层叠加在用户当前明/暗方案之上。
 *
 * 基调取自 KStock 1.x 桌面端 `apps/desktop/src/styles.css`：
 *  - 暗色（产品主方案）忠实还原旧界面：深绿黑画布 #030d0b、中性深灰绿面板
 *    （#1b1e22 → #25292e）、强调绿 #31c7a2、以及五层渐变网格环境背景
 *    （背景渐变由 background.ts 单独注入，token 只负责表面与文字）。
 *  - 亮色按上游 ui-theme-brand 的同一做法衍生（旧版无亮色 VI）：薄荷纸画布
 *    #f2f7f5，强调色加深为 #178267 以满足 AA 对比（白字于其上 ≥4.5:1）。
 *
 * 对照关系沿用上游 `@qilin/client-ui-theme-brand` 的 token 全集；
 * 刻意省略状态色（error/success/warn/info）与无消费者的 token，
 * 保持引擎默认平台色板。
 */

import type { ThemeTokenOverrides } from '@qilin/client-ui-theme/client'

/**
 * 本品牌层的 source id：一层一源，`ctx.theme` 检查时可见来源，
 * 重复应用为替换而非叠加。
 */
export const KSTOCK_THEME_SOURCE = '@kstock/client-brand'

/**
 * KStock 品牌 token。每个值同时给出明/暗两种方案（ThemeTokenOverrides 契约），
 * 按表面家族分组。
 */
export const KSTOCK_TOKENS: ThemeTokenOverrides = Object.freeze({
  /* 品牌绿：暗色直接使用旧版强调绿 #31c7a2（在 #030d0b 画布上对比度 ≈9:1），
     亮色加深为 #178267 保证白字按钮/焦点环在薄荷纸上过 AA。悬停遵循各平台
     惯例：暗色提亮（#5fd3b0），亮色加深（#106b54）。 */
  '--dsw-alias-brand-primary': { light: '#178267', dark: '#31c7a2' },
  '--dsw-alias-button-primary-hover': { light: '#106b54', dark: '#5fd3b0' },
  '--dsw-alias-link': { light: '#106b54', dark: '#5fd3b0' },

  /* 表面：暗色还原旧版层级（画布 #030d0b → 旧卡片面 #1b1e22 → 浮层 #25292e，
     layer-1 取两者之间的过渡层）；亮色为薄荷纸上的近白层级。
     侧栏在两种方案下都并入画布家族（旧版侧栏玻璃 rgba(3,13,11,0.86) 的
     不透明等价物）。 */
  '--dsw-alias-bg-base': { light: '#f2f7f5', dark: '#030d0b' },
  '--dsw-alias-bg-layer-1': { light: '#f7fbf9', dark: '#0e1513' },
  '--dsw-alias-bg-layer-2': { light: '#fbfdfc', dark: '#1b1e22' },
  '--dsw-alias-bg-layer-3': { light: '#ffffff', dark: '#25292e' },
  '--dsw-alias-bg-overlay': { light: '#e2ebe7', dark: '#3a4148' },
  '--dsw-alias-bg-skeleton': { light: 'rgba(23, 60, 50, 0.06)', dark: 'rgba(232, 234, 237, 0.08)' },
  '--dsw-specific-sidebar-fill': { light: '#ecf3f0', dark: '#05100d' },
  '--dsw-specific-sidebar-nav-item-hover': { light: '#e3ede9', dark: '#0f1a17' },
  '--dsw-specific-sidebar-nav-item-active': { light: '#dae7e2', dark: '#14211d' },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: '#178267', dark: '#31c7a2' },

  /* 组件表面：用户气泡、输入框、选择器、提示条，以及暗色浮动 toast/tooltip，
     全部按旧版面板色系（#1b1e22/#1d2126/#22262b）着色。 */
  '--dsw-specific-bubble': { light: '#eef5f2', dark: '#1d2126' },
  '--dsw-specific-input-major': { light: '#ffffff', dark: '#1b1e22' },
  '--dsw-specific-selector': { light: '#f4faf7', dark: '#22262b' },
  '--dsw-specific-tip': { light: '#f4faf7', dark: '#22262b' },
  '--dsw-alias-toast-bg': { light: '#1d2b26', dark: '#1d2b26' },
  '--dsw-alias-tooltip-bg': { light: '#1d2b26', dark: '#22262b' },

  /* 文字：暗色用旧版正文 #e8eaed 与次级灰阶（#aeb7bf/#8f96a0）；
     亮色为墨绿近黑系。tertiary/caption 保持基础色板的相对递减梯度。 */
  '--dsw-alias-label-primary': { light: '#14201c', dark: '#e8eaed' },
  '--dsw-alias-label-primary-dimmed': { light: '#2b3b35', dark: '#d5d9de' },
  '--dsw-alias-label-secondary': { light: '#5b6b64', dark: '#aeb7bf' },
  '--dsw-alias-label-tertiary': { light: '#7d8d86', dark: '#8f96a0' },
  '--dsw-alias-label-caption': { light: '#98a8a1', dark: '#7a828c' },
  '--dsw-alias-label-dimmed': { light: '#c3d2cc', dark: '#566068' },
  '--dsw-alias-label-primary-inverted': { light: '#fbfdfc', dark: '#14201c' },

  /* 发丝线与悬停：以 KStock 墨色（暗 #e8eaed / 亮 #14201c）为基的 alpha 洗色，
     步长与上游默认色板一致；交互悬停带一点品牌绿的倾向。 */
  '--dsw-alias-border-l1': { light: 'rgba(20, 32, 28, 0.07)', dark: 'rgba(232, 234, 237, 0.06)' },
  '--dsw-alias-border-l2': { light: 'rgba(20, 32, 28, 0.11)', dark: 'rgba(232, 234, 237, 0.10)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(20, 32, 28, 0.11)', dark: 'rgba(232, 234, 237, 0.07)' },
  '--dsw-alias-border-l3': { light: 'rgba(20, 32, 28, 0.13)', dark: 'rgba(232, 234, 237, 0.14)' },
  '--dsw-alias-border-l4': { light: 'rgba(20, 32, 28, 0.17)', dark: 'rgba(232, 234, 237, 0.18)' },
  '--dsw-alias-border-inverted': { light: 'rgba(20, 32, 28, 0)', dark: 'rgba(232, 234, 237, 0.05)' },
  '--dsw-alias-border-inverted2': { light: 'rgba(20, 32, 28, 0)', dark: 'rgba(232, 234, 237, 0.08)' },
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(23, 130, 103, 0.08)', dark: 'rgba(232, 234, 237, 0.08)' },
  '--dsw-alias-interactive-bg-active': { light: 'rgba(23, 130, 103, 0.13)', dark: 'rgba(232, 234, 237, 0.14)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(23, 130, 103, 0.14)', dark: 'rgba(49, 199, 162, 0.20)' },
  '--dsw-alias-interactive-bg-hover-solid': { light: '#e8f0ec', dark: '#25292e' },

  /* 次级按钮家族：按同深度梯度重着色的中性填充。 */
  '--dsw-alias-button-contrast-fill': { light: '#5b6b64', dark: '#e8eaed' },
  '--dsw-alias-button-elevated-fill': { light: '#ffffff', dark: '#22262b' },
  '--dsw-alias-button-floating-fill': { light: '#ffffff', dark: '#1d2126' },
  '--dsw-alias-button-floating-hover': { light: '#eef4f1', dark: '#25292e' },
  '--dsw-alias-button-ghost-active-fill': { light: '#e9f1ed', dark: '#23282d' },
  '--dsw-alias-button-ghost-active-hover': { light: '#dfeae5', dark: '#2a3036' },
  '--dsw-alias-button-ghost-active-border': { light: '#9ab3aa', dark: '#4a545c' },
  '--dsw-alias-button-tool-bar-fill': { light: 'rgba(91, 107, 100, 0.5)', dark: 'rgba(143, 150, 160, 0.4)' },
  '--dsw-alias-button-tool-bar-hover': { light: 'rgba(91, 107, 100, 0.6)', dark: 'rgba(143, 150, 160, 0.5)' },
  '--dsw-alias-button-tool-bar-fill-invisible': { light: 'rgba(20, 32, 28, 0.36)', dark: 'rgba(16, 22, 20, 0.36)' },

  /* 代码表面与滚动条：中性阅读面移到深绿（暗）/ 薄荷纸（亮）。 */
  '--dsw-alias-markdown-code-block': { light: '#f0f6f3', dark: '#141a18' },
  '--dsw-alias-markdown-code-block-banner': { light: '#e7efeb', dark: '#1b2120' },
  '--dsw-alias-markdown-inline-code': { light: '#edf4f1', dark: '#1d2422' },
  '--dsw-alias-markdown-citation': { light: '#eef4f1', dark: '#1d2126' },
  '--dsw-alias-markdown-tag': { light: '#edf4f1', dark: '#1d2126' },
  '--dsw-alias-scrollbar-bg-l1': { light: '#d3e0da', dark: '#3d454c' },
  '--dsw-alias-scrollbar-bg-l2': { light: '#d3e0da', dark: '#4a535b' },
  '--dsw-alias-scrollbar-hover-l1': { light: '#c2d3cc', dark: '#4a535b' },
  '--dsw-alias-scrollbar-hover-l2': { light: '#c2d3cc', dark: '#59636c' },

  /* 品牌印记：`--dsw-specific-brand-seal-fill` 承载 KStock 印记的底色。
     值与 button-primary 同源（暗 #2fc197 旧版按钮绿 / 亮 #178267 深绿），
     改印记渐变时需同步此 token。 */
  '--dsw-specific-brand-seal-fill': { light: '#178267', dark: '#2fc197' },
})
