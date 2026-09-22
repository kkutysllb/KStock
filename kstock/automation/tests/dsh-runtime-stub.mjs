/** Runtime stubs for the host packages the harness provides at run time.
 * Pure-logic tests exercise this plugin's own modules against these seams.
 */

export const SessionId = value => value
export const WorkspaceId = value => value
export const createUserMessage = value => value
export const installModelSelection = () => () => {}
export const setApprovalPolicy = () => {}
export const setSandboxMode = () => {}
export const defineDomain = spec => spec
export const domainTable = schema => ({ valueSchema: schema })

const schemaNode = new Proxy(() => schemaNode, {
  apply: () => schemaNode,
  get: () => schemaNode,
})
export default schemaNode
