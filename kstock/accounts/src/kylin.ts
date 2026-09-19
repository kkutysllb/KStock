/**
 * 与宿主引擎服务面的本地结构契约（上游同名类型的最小结构拷贝）。
 *
 * 本包独立打包、不依赖 @qilin/* 的运行时解析；插件的 `inject` 按名注入，
 * 这里的结构类型只约束我们真正调用的面。运行时形态由引擎保证：
 * @module @kstock/accounts-local/src/kylin
 */

/** 引擎传入路由处理器的标准 Fetch 请求。 */
type TrustHeaders = Headers | Record<string, string>

/** 路由与会话门读到的请求切片（URL + 头）。 */
export interface ConnectionTrustRequest {
  readonly url?: string
  readonly headers: TrustHeaders
}

/** 经 webserver 注册的一条命名路由。 */
export interface ConnectionFetchRoute {
  /** 精确匹配的请求路径。 */
  readonly path: string
  readonly methods: readonly string[]
  readonly requestBody?: 'buffered'
  readonly fetch: (request: Request) => Promise<Response> | Response
}

/** 索引文档响应的写出切片（node 风格）。 */
export interface ConnectionIndexResponse {
  writeHead(code: number, headers?: Record<string, string>): unknown
  end(body?: unknown): unknown
}

/** 浏览器传输层安装的账户会话权威。 */
export interface ConnectionSessionAuthority {
  authorizeIndex(request: ConnectionTrustRequest, response: ConnectionIndexResponse): boolean
  isPublicApiRequest(request: ConnectionTrustRequest): boolean
  verify(request: ConnectionTrustRequest): boolean
}

/** 连接服务面：路由注册 + 会话权威安装位。 */
export interface ConnectionServices {
  readonly fetch: { register(route: ConnectionFetchRoute): unknown }
  readonly session: { install(authority: ConnectionSessionAuthority): unknown }
}

/** 凭据记录（负载为插件自定义 JSON）。 */
export interface CredentialRecord {
  readonly kind: string
  readonly payload: unknown
}

/** 凭据服务面：读改一条插件私有记录。 */
export interface CredentialProvider {
  modifyRecord(
    key: string,
    change: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined> | CredentialRecord | undefined,
  ): Promise<CredentialRecord | undefined>
}

/** Kylin 插件上下文本包用到的切片。 */
export interface Context {
  readonly connection: ConnectionServices
  readonly credentials: CredentialProvider
}
