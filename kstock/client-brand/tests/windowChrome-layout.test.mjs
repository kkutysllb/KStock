import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/client/windowChrome.ts')
const source = readFileSync(sourcePath, 'utf8')
const macosCss = source.match(/const MACOS_TRAFFIC_LIGHTS_CSS = `([\s\S]*?)`/)?.[1]

assert.ok(macosCss, 'macOS traffic-light CSS should be declared')

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
