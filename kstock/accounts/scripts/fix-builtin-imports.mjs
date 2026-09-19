/**
 * 构建后处理：把产物中 CJS 依赖（bcryptjs）经 interop 产生的裸内建模块
 * 导入（`from "crypto"`）改写为 `node:` 前缀形式。
 *
 * 引擎单文件（SEA snapshot）用 Node internal loader 按 bareModuleBaseUrl
 * 解析插件导入，裸内建名不在其解析表内——`@kstock/web` 等全部使用
 * `node:` 前缀的产物均可加载，唯有本包因 bcryptjs 出现裸 `"crypto"` 而
 * 「failed to import」。幂等：已带前缀的导入不受影响。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const BUILTINS = [
  'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http',
  'https', 'os', 'path', 'stream', 'string_decoder', 'url', 'util', 'zlib',
]
const pattern = new RegExp(`from "(?:${BUILTINS.join('|')})"`, 'g')
const file = new URL('../lib/index.js', import.meta.url)
const before = readFileSync(file, 'utf8')
const after = before.replace(pattern, (match) => match.replace('from "', 'from "node:'))
if (after !== before) {
  writeFileSync(file, after)
  console.log(`builtin imports prefixed: ${(before.match(pattern) ?? []).length} 处`)
} else {
  console.log('builtin imports already prefixed')
}
