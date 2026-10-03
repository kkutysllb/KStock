#!/usr/bin/env node
/**
 * KStock 全仓库审计（发版前置门）——口径对齐 KCoder scripts/audit.mjs。
 *
 *   node scripts/audit.mjs
 *
 * 分节执行，[门] 为硬性失败项（退出码 1），[报告] 为审计项——不阻断
 * 命令退出，但必须逐条处置（修复或在 docs/项目审计-<版本>.md 中说明
 * 豁免理由）后才能发版（build-release.sh 的 run_checks 会硬校验报告存在）：
 *
 * 1. [门] TYPECHECK   —— 复用 check-ci.sh --types-only（同一套 tsc 命令单一事实源）
 * 2. [门] LINT        —— oxlint 扫 kstock / apps/desktop / scripts，0 error 才过；
 *                        warning 逐条列出，安全类（eval / 控制字符正则等）必须处置
 * 3. [门] SECURITY    —— pnpm audit 生产依赖漏洞，high 及以上即失败；
 *                        两个工作区根各跑一次（kstock 自带 pnpm@11 + 独立 lock）
 * 4. [报告] DEAD EXPORTS —— ts-prune 候选 + 全仓引用交叉核对（单 project 视角的
 *                        跨包消费假阳性会被过滤掉，只留真正无人引用的导出）
 * 5. [报告] UNUSED DEPS  —— depcheck 逐包：声明未用（unused）与用了未声明（missing）
 *
 * 原始输出同时落盘 .release-logs/audit-<时间戳>.log，便于写审计报告取证。
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// 必须走 fileURLToPath：URL.pathname 在 Windows 上得到 `/D:/…`（带前导斜杠），
// spawnSync 的 cwd 因此解析失败，三门全部误报 FAIL（2026-10-01 KCoder 现场）。
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LOG_DIR = join(ROOT, '.release-logs')
mkdirSync(LOG_DIR, { recursive: true })
const LOG = join(LOG_DIR, `audit-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
const raw = []
const note = (text) => {
  raw.push(text)
  appendFileSync(LOG, text + '\n')
}

const results = []
let failed = false

const section = (name, gate, fn) => {
  process.stdout.write(`\n━━━ [${gate ? '门' : '报告'}] ${name} ━━━\n`)
  let verdict
  try {
    verdict = fn()
  } catch (error) {
    verdict = { status: 'fail', detail: String(error?.message ?? error) }
  }
  verdict = verdict ?? { status: 'pass' }
  results.push({ name, gate, ...verdict })
  if (gate && verdict.status === 'fail') failed = true
  for (const f of verdict.findings ?? []) console.log('  • ' + f)
  const mark =
    verdict.status === 'pass' ? '\x1b[32mPASS\x1b[0m' : verdict.status === 'fail' ? '\x1b[31mFAIL\x1b[0m' : '\x1b[33mREPORT\x1b[0m'
  console.log(`${mark} ${name}${verdict.note ? ' — ' + verdict.note : ''}`)
}

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  })
  note(`$ ${cmd} ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}`)
  return r
}

const tail = (r, n = 2000) => ((r.stdout ?? '') + (r.stderr ?? '')).slice(-n)

/* 1. TYPECHECK（复用 CI 车道的类型段，避免两套 tsc 事实源） */
section('TYPECHECK（插件构建 + 类型检查）', true, () => {
  const r = run('bash', ['scripts/check-ci.sh', '--types-only'])
  return r.status === 0 ? { status: 'pass' } : { status: 'fail', detail: tail(r) }
})

/* 2. LINT（只扫源码：lib/dist 是 tsdown / esbuild 的提交产物，扫它们只会得到噪声） */
section('LINT（oxlint，0 error 才过）', true, () => {
  const r = run('pnpm', [
    'exec',
    'oxlint',
    'kstock',
    'apps/desktop',
    'scripts',
    '--ignore-pattern=**/lib/**',
    '--ignore-pattern=**/dist/**',
    '--ignore-pattern=**/dist-electron/**',
    '--ignore-pattern=**/release/**',
    '--ignore-pattern=**/node_modules/**',
  ])
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  const errors = Number(/(\d+) errors?/.exec(out)?.[1] ?? 0)
  const warnings = Number(/(\d+) warnings?/.exec(out)?.[1] ?? 0)
  if (r.status !== 0 || errors > 0) return { status: 'fail', detail: out.slice(-2000) }
  const listed = out
    .split('\n')
    .filter((line) => /^\s*!\s+eslint\(/.test(line))
    .map((line) => line.trim())
  return {
    status: 'pass',
    note: `${warnings} warning（安全类如 eval / 控制字符正则必须逐条处置或加注豁免理由）`,
    findings: listed,
  }
})

/* 3. SECURITY：两个工作区根各审计一次（kstock 用自带 pnpm@11 与独立 lock） */
section('SECURITY（生产依赖漏洞，high+ 即失败）', true, () => {
  const scopes = [
    ['root', ['audit', '--prod', '--audit-level', 'high', '--registry=https://registry.npmjs.org']],
    ['kstock', ['-C', 'kstock', 'audit', '--prod', '--audit-level', 'high', '--registry=https://registry.npmjs.org']],
  ]
  const notes = []
  for (const [label, args] of scopes) {
    const r = run('pnpm', args)
    const out = (r.stdout ?? '') + (r.stderr ?? '')
    if (/audit endpoint|EAUDIT|ENOTFOUND|ETIMEDOUT/i.test(out) && r.status !== 0) {
      return { status: 'fail', detail: `${label}: audit 端点不可达（网络/registry 问题）——不允许静默跳过` }
    }
    if (r.status !== 0) return { status: 'fail', detail: `${label}: ${out.slice(-1500)}` }
    notes.push(`${label} ${/found (\d+) vulnerabilit/.exec(out)?.[0] ?? '无 high+ 漏洞'}`)
  }
  return { status: 'pass', note: notes.join('；') }
})

/* 4. DEAD EXPORTS：ts-prune 候选 + 全仓引用交叉核对 */
const TS_PRUNE_PROJECTS = [
  'kstock/quant/tsconfig.json',
  'kstock/accounts/tsconfig.json',
  'apps/desktop/electron/tsconfig.json',
]
// 插件生命周期入口由宿主按名调用（跨进程/按字符串解析），单 project 的 ts-prune
// 与全仓字面引用都看不见——按类豁免并在此写明理由。
const WAIVED = [
  { re: /\/index\.ts:\d+ - (apply|inject|name)$/, why: 'QiLin 插件生命周期入口（宿主按名调用）' },
]

const SOURCE_EXT = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.cjs', '.json'])
const SOURCE_SKIP_DIRS = new Set(['node_modules', 'lib', 'dist', 'dist-electron', 'release', '.git', 'coverage', 'build'])

const walkSources = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    if (SOURCE_SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walkSources(full, acc)
    else if (SOURCE_EXT.has(entry.slice(entry.lastIndexOf('.')))) acc.push(full)
  }
  return acc
}

section('DEAD EXPORTS（未被任何源码引用的导出）', false, () => {
  const candidates = []
  for (const project of TS_PRUNE_PROJECTS) {
    const r = run('pnpm', ['exec', 'ts-prune', '-p', project])
    if (r.status !== 0 && (r.stdout ?? '') === '') return { status: 'fail', detail: `ts-prune 执行失败：${project}` }
    for (const line of (r.stdout ?? '').split('\n')) {
      const text = line.trim()
      if (text === '' || text.includes('(used in module)')) continue
      const m = /^(.*?):(\d+) - (.+)$/.exec(text)
      if (!m) continue
      candidates.push({ project, file: m[1].replace(/\\/g, '/'), line: m[2], name: m[3] })
    }
  }

  const corpus = []
  for (const base of ['kstock', 'apps/desktop/electron', 'scripts']) {
    const abs = join(ROOT, base)
    try {
      if (statSync(abs).isDirectory()) walkSources(abs, corpus)
    } catch {
      /* 缺失目录跳过 */
    }
  }
  const haystack = corpus.map((f) => readFileSync(f, 'utf8')).join('\n')

  const findings = []
  let crossPackaged = 0
  let waived = 0
  for (const c of candidates) {
    const full = `${c.project} ${c.file}:${c.line} - ${c.name}`
    if (WAIVED.some((w) => w.re.test(`${c.file}:${c.line} - ${c.name}`))) {
      waived += 1
      continue
    }
    const hits = (haystack.match(new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) ?? []).length
    // 1 次 = 只有声明处；跨包消费者（其它 kstock/* 包、引擎 runtime）不计入本仓源码
    if (hits > 1) crossPackaged += 1
    else findings.push(`${full}（全仓引用 ${hits} 次）`)
  }
  return {
    status: 'report',
    note: `${findings.length} 项待处置；${crossPackaged} 项为跨包/引擎消费（本仓源码可见引用）；${waived} 项按类豁免`,
    findings,
  }
})

/* 5. UNUSED DEPS：depcheck 逐包（声明未用 / 用了未声明） */
const DEPCHECK_DIRS = [
  'apps/desktop',
  ...readdirSync(join(ROOT, 'kstock'))
    .map((name) => `kstock/${name}`)
    .filter((dir) => {
      try {
        return statSync(join(ROOT, dir, 'package.json')).isFile()
      } catch {
        return false
      }
    }),
]

section('UNUSED DEPS（depcheck：声明未用 / 用了未声明）', false, () => {
  const unused = []
  const missing = []
  // 引擎宿主提供的运行时外部件（插件形态：React 与 @qilin/* 由宿主注入，
  // 不在产品包 package.json 里声明是设计而非缺陷）——按类豁免，保留其余噪声。
  const HOST_PROVIDED = /^(@qilin\/|react$|react-dom$)/
  let hostProvided = 0
  for (const dir of DEPCHECK_DIRS) {
    // 构建工具与按脚本调用的工具（tsx 经 --import 使用）不在静态解析范围，显式忽略。
    const r = run('pnpm', [
      'exec',
      'depcheck',
      dir,
      '--json',
      '--ignores=tsdown,typescript,tsx,electron,electron-builder,esbuild,oxlint,ts-prune,depcheck,@types/node',
      '--ignore-patterns=release/**,dist-electron/**,build/**,lib/**,dist/**,node_modules/**',
    ])
    let parsed = {}
    try {
      parsed = JSON.parse(r.stdout || '{}')
    } catch {
      return { status: 'fail', detail: `depcheck 输出不可解析：${dir}` }
    }
    // depcheck 的 dependencies / devDependencies 是「声明未用」的数组，
    // using / missing 才是对象——按数组展开（按对象取键会得到 ["0"] 这种伪项）。
    for (const name of [...(parsed.dependencies ?? []), ...(parsed.devDependencies ?? [])]) {
      unused.push(`${dir}: ${name}`)
    }
    for (const name of Object.keys(parsed.missing ?? {})) {
      if (HOST_PROVIDED.test(name)) {
        hostProvided += 1
        continue
      }
      missing.push(`${dir}: ${name}`)
    }
  }
  return {
    status: 'report',
    note: `声明未用 ${unused.length} 项；用了未声明 ${missing.length} 项（另有 ${hostProvided} 项为宿主注入外部件，按类豁免）`,
    findings: [...unused, ...missing.map((m) => `missing ${m}`)],
  }
})

/* 汇总 */
console.log('\n━━━ 审计汇总 ━━━')
for (const r of results) {
  console.log(`${r.gate ? '[门]' : '[报告]'} ${r.name}: ${r.status}${r.note ? ' — ' + r.note : ''}`)
}
console.log(`\n原始输出：${relative(ROOT, LOG)}`)
if (failed) {
  console.error('\n\x1b[31m审计未通过：存在硬性失败项，修复后重跑\x1b[0m')
  process.exit(1)
}
console.log('\x1b[32m审计通过（报告项需逐条处置并记录到 docs/项目审计-<版本>.md）\x1b[0m')
