/**
 * @kstock/web — KStock 桌面产品层，node 半端。
 *
 * 两件事：
 * 1. 承载 `cordis.patch.yml`（`qilin.bundle.patch` 清单声明，profile 组装器解析）；
 * 2. 注册 KStock 自有公共页路由（exact `/`、`/login`、`/setup` + `/kstock/*` 静态资源），
 *    用 1.x 原设计替换上游 landing/auth 公共文档。webserver 命名路由优先于
 *    frontend-static 的 fallback 席位，因此这些路由天然覆盖上游文档，
 *    无需改动 vendor 内的上游构建产物。
 *
 * 已认证控制台（/workspace 等 index 路径）不受影响，仍由上游 SPA 承载，
 * 品牌视觉经 @kstock/client-brand 客户端插件叠加。
 * @module @kstock/web
 */

import { readFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 本包 public/ 目录（lib/index.js 的上一级）。 */
const PUBLIC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

/** webserver 响应面本插件用到的最小切片。 */
interface ServerResponseLike {
  writeHead(code: number, headers?: Record<string, string>): unknown
  end(body?: unknown): unknown
}

/** webserver 请求面本插件用到的最小切片。 */
interface ServerRequestLike {
  url?: string | undefined
}

/** webserver 路由注册表本插件用到的最小切片（@qilin/host-webserver）。 */
interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: ServerRequestLike, res: ServerResponseLike) => void | Promise<void>
  }): () => void
}

/** 必需服务：webserver 路由表。 */
export const inject = ['webServer'] as const

/**
 * 注册 KStock 公共页路由。上游 landing/auth 仍是 frontend-static 的
 * fallback 文档；命名路由在 fallback 之前命中，因此 `/`、`/login`、`/setup`
 * 由 KStock 页面应答，其余路径不受影响。
 */
export function apply(ctx: { webServer: WebServerLike }): void {
  const webServer = ctx.webServer

  const serveFile = async (fileName: string, res: ServerResponseLike): Promise<void> => {
    try {
      const body = await readFile(join(PUBLIC_ROOT, fileName))
      res.writeHead(200, { 'content-type': MIME[extname(fileName)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  }

  const html = (fileName: string) =>
    async (_req: ServerRequestLike, res: ServerResponseLike): Promise<void> => {
      await serveFile(fileName, res)
    }

  webServer.register({ kind: 'exact', path: '/', handler: html('kstock-landing.html') })
  webServer.register({ kind: 'exact', path: '/login', handler: html('kstock-auth.html') })
  webServer.register({ kind: 'exact', path: '/setup', handler: html('kstock-auth.html') })
  webServer.register({
    kind: 'prefix',
    path: '/kstock',
    handler: async (req, res): Promise<void> => {
      const pathname = (req.url ?? '').split('?')[0] ?? ''
      const relative = pathname.slice('/kstock/'.length)
      // 只允许一级文件名，拒绝路径穿越。
      if (relative === '' || relative.includes('/') || relative.includes('\\') || relative.includes('..')) {
        res.writeHead(404)
        res.end()
        return
      }
      await serveFile(relative, res)
    },
  })
}
