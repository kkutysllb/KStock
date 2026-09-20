/**
 * 独立打包配置（不进 vendor/qilin 工作区）。
 *
 * node 半端：ESM lib/index.js（宿主占位行，本包只贡献浏览器呈现）。
 * 浏览器半端：复刻上游闭包工厂产物契约（packages/client/tsdown.client.ts
 * 的 clientConfig 核心）：CJS + banner 注入 window.__ModuleLoader__.load
 * 工厂 + intro 声明 module/exports，产物钉在 lib/client.cjs。平台模块表
 * 保持外部引用，其余（含 @kstock/quant-ui 源码）全部内联；ksq 样式经
 * kstock-css-raw 以 `?raw` 导出文本内联进 bundle。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'tsdown'

/** 与引擎 packages/client/web/src/platform.ts 的 PLATFORM_MODULES 保持一致。 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@qilin/kylin',
  '@qilin/client-store',
  '@qilin/client-ui-slots',
  '@qilin/client-ui-primitives',
  '@qilin/client-ui-dockkit',
] as const

const CLIENT_ID = '@kstock/client-news'

/** `*.css?raw` → 默认导出文件文本（rolldown 轻插件，免引 CSS 工具链）。 */
function cssRaw() {
  return {
    name: 'kstock-css-raw',
    resolveId(source: string, importer: string | undefined) {
      if (source.endsWith('?raw') && importer) {
        return resolve(dirname(importer), source.slice(0, -4)) + '?raw'
      }
      return null
    },
    load(id: string) {
      if (id.endsWith('?raw')) {
        return `export default ${JSON.stringify(readFileSync(id.slice(0, -4), 'utf-8'))}`
      }
      return null
    },
  }
}

export default defineConfig([
  {
    name: CLIENT_ID,
    entry: { index: 'src/node.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    name: `${CLIENT_ID}/client`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    jsx: 'automatic',
    fixedExtension: false,
    entryFileNames: 'client.cjs',
    sourcemap: true,
    dts: false,
    clean: false,
    plugins: [cssRaw()],
    deps: {
      neverBundle: (specifier: string) =>
        PLATFORM_MODULES.includes(specifier as (typeof PLATFORM_MODULES)[number]),
      alwaysBundle: (specifier: string) =>
        !PLATFORM_MODULES.includes(specifier as (typeof PLATFORM_MODULES)[number]),
    },
    // 闭包工厂契约的包装层，与上游 packages/client/tsdown.client.ts 的
    // outputOptions 三段式保持一致（多行字符串，rolldown 不会折叠）。
    outputOptions: {
      banner: `window.__ModuleLoader__.load({\n\tid: ${JSON.stringify(CLIENT_ID)},\n\tfactory: (require) => {\n`,
      intro: '\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n',
      footer: '\t\treturn module.exports;\n\t}\n});',
    },
  },
])
