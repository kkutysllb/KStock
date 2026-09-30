import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/client/windowChrome.ts')
const source = readFileSync(sourcePath, 'utf8')
const macosCss = source.match(/const MACOS_TRAFFIC_LIGHTS_CSS = `([\s\S]*?)`/)?.[1]
const windowsCss = source.match(/const WINDOWS_TITLEBAR_CSS = `([\s\S]*?)`/)?.[1]

assert.ok(macosCss, 'macOS traffic-light CSS should be declared')
assert.ok(windowsCss, 'Windows titlebar CSS should be declared')

const rules = [...macosCss.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({
  selector: selector.trim(),
  body,
}))

/**
 * 取同时含全部片段的选择器规则体。
 * @param {...string} fragments - 选择器须同时包含的片段。
 * @returns {string} 规则体。
 */
function ruleBody(...fragments) {
  const rule = rules.find(({ selector }) => fragments.every((part) => selector.includes(part)))
  assert.ok(rule, `规则应存在：${fragments.join(' + ')}`)
  return rule.body
}

/** 展开态（选择器不含 collapsed）里含全部片段的规则。 */
function expandedRule(...fragments) {
  const rule = rules.find(({ selector }) =>
    !selector.includes('[class*="collapsed"]') && fragments.every((part) => selector.includes(part)))
  assert.ok(rule, `展开态规则应存在：${fragments.join(' + ')}`)
  return rule
}

test('macOS 品牌行累计下移 30px，避开红绿灯组', () => {
  const { body } = expandedRule('[class*="logoRow"]')
  assert.match(body, /margin: 30px 0 8px;/)
  assert.doesNotMatch(body, /margin: -6px|margin: 0 0 8px|margin: 10px 0 8px/)
})

test('折叠轨品牌行保持灯组下方的独立避让，不随展开态下移', () => {
  const collapsed = ruleBody('#root', '[class*="collapsed"]', '[class*="logoRow"]')
  assert.match(collapsed, /margin: 34px 0 12px;/)
})

test('设置弹层返回工作区行下移 30px（portal 挂 body，须用 body 前缀命中）', () => {
  const navBack = rules.find(({ selector }) => selector.includes('[class*="navBack"]'))
  assert.ok(navBack, '返回工作区行规则应存在')
  assert.match(navBack.selector, /^body /)
  assert.doesNotMatch(navBack.selector, /#root/)
  assert.match(navBack.body, /margin-top: 30px;/)
})

test('折叠按钮提进红绿灯行：品牌行作定位锚并放行溢出，按钮绝对定位到行上方', () => {
  const anchor = expandedRule('[class*="logoRow"]').body
  assert.match(anchor, /position: relative;/)
  assert.match(anchor, /overflow: visible;/)

  const toggle = expandedRule('[class*="toggle"]').body
  assert.match(toggle, /position: absolute;/)
  // 品牌行顶 y=36，-26px → 按钮 y 10..38，中心 24 对齐灯组中心 23.5。
  assert.match(toggle, /top: -26px;/)
  assert.match(toggle, /right: 0;/)
})

test('折叠轨按钮留在流内（rail 展开控件不上浮）', () => {
  const railToggle = ruleBody('#root', '[class*="collapsed"]', '[class*="toggle"]')
  assert.match(railToggle, /position: relative;/)
  assert.doesNotMatch(railToggle, /position: absolute;/)
})

test('Windows 顶栏带固定 48px，与壳 titleBarOverlay 高度对齐', () => {
  const logoRow = windowsCss.match(/#root \[class\*="logoRow"\]\s*\{([^}]*)\}/)?.[1]
  assert.ok(logoRow, 'Windows 品牌行规则应存在')
  assert.match(logoRow, /height: 48px;/)
})

test('Windows 不再用上游不存在的 headerRight 选择器留白（旧实现从未命中）', () => {
  // 3.0.5 引擎里已无 headerRight 类：`:has(> [class*="headerRight"])` 恒不匹配，
  // 写死的 138px 让位是死代码——右上控件被系统按钮簇压住就是这么来的。
  assert.doesNotMatch(windowsCss, /headerRight/)
  assert.doesNotMatch(windowsCss, /padding-right:\s*138px/)
})

test('按钮簇让位走实测位移：WCO 实测 + 138×缩放回落 + 同层只动最右者', () => {
  assert.match(source, /export function applyCaptionAvoidance\(\)/)
  // WCO 变量在本版 Electron 上会失效（按钮簇在屏上仍报整窗宽），只能当参考值
  assert.match(source, /env\(titlebar-area-width,100vw\)/)
  assert.match(source, /CAPTION_BUTTONS_WIDTH \* \(window\.devicePixelRatio \|\| 1\)/)
  // 取样命中测试定位越界控件；同层只位移最右者，避免 flex 行内累计位移
  assert.match(source, /document\.elementsFromPoint\(/)
  assert.match(source, /const rightmost = new Map<HTMLElement, HTMLElement>\(\)/)
  // 位移单位须是「最外层窄控件」：初版取最内层，结果给胶囊内部的 <img> 与箭头
  // 各加了外边距，标签文字被挤没（实机截图：胶囊被撑成空壳）。
  assert.match(source, /const units = new Map<HTMLElement, number>\(\)/)
  assert.match(source, /rect\.width >= half\) break/)
  assert.doesNotMatch(source, /const inner = list\.filter/)
  // 每轮先复位，避免窗口缩放/布局切换后残留旧位移
  assert.match(source, /for \(const \[element, base\] of applied\) element\.style\.marginRight = base/)
})
