/**
 * @kstock/quant 的独立打包配置（不进 vendor/qilin 工作区）。
 *
 * 本包是量化数据宿主：node 半端 ESM lib/index.js（四库存储 +
 * /kstock-api 路由）。四个库的界面分别由 @kstock/quant-strategies /
 * -factors / -selections / -reports 客户端插件承载。
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
})
