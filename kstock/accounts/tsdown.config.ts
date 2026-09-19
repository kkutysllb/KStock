/**
 * @kstock/accounts-local 的独立打包配置（不进 vendor/qilin 工作区）。
 *
 * node 半端：ESM lib/index.js（宿主插件，/api/auth 路由 + 会话门 + 1.x 账户
 * 迁移）。全部依赖（含 bcryptjs 与 vendor 小工具的本地拷贝）内联进产物，
 * 运行时只依赖 Node 内建模块——插件由 profile 的 node_modules 链接加载，
 * 不假设 @qilin/* 可解析。
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  // bcryptjs 必须内联：插件经 profile 的 node_modules 链接加载，那里没有
  // （也不会有）bcryptjs 可解析——外置依赖 = 引擎加载即失败（accounts
  // 崩 → 登录/注册/会话门全挂，唯一入口只剩 token URL 直进）。
  // bcryptjs 是纯 JS，可安全打包。
  noExternal: ['bcryptjs'],
})
