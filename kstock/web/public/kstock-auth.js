/**
 * KStock 登录 / 首启初始化页脚本。
 * 行为对齐上游 apps/web/src/auth/auth.ts 的 API 契约：
 * POST /api/auth/setup {username,email,password} | /api/auth/login {identifier,password}；
 * 成功后跳 ?next= 校验后的同站路径；密码最短 8 位；已认证访客直接送往目的地。
 */

/** 控制台入口路径；无可用 next 值时落这里。 */
const ENTRY_PATH = '/workspace'
/** 最短密码长度，与服务端账户策略一致。 */
const PASSWORD_MINIMUM = 8
/** 浏览器会折叠/忽略的字符与绝对 URL 形态，命中即视为不安全的 next。 */
const URL_NOISE = /[\u0000-\u0020\u007f]/u
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu

/** 校验并解析 ?next=，只接受同站绝对路径，防开放重定向。 */
function nextDestination() {
  const requested = new URLSearchParams(location.search).get('next')
  if (requested === null || requested === '') return ENTRY_PATH
  if (!requested.startsWith('/') || requested.startsWith('//')) return ENTRY_PATH
  if (URL_NOISE.test(requested) || requested.includes('\\')) return ENTRY_PATH
  if (URL_SCHEME.test(requested)) return ENTRY_PATH
  return requested
}

async function readAccountStatus() {
  try {
    const response = await fetch('/api/auth/status', { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

/** 常见错误码的中文文案（上游 accounts-local 的错误封套为 {error:{code,message}}）。 */
const ERROR_CODE_TEXT = {
  'invalid-credentials': '用户名、邮箱或密码不正确',
  'username-taken': '该用户名已存在账户',
  'email-taken': '该邮箱已存在账户',
  'registration-closed': '当前部署不接受新账户注册',
  'already-initialized': '账户已初始化，请直接登录',
}

/** 从上游错误响应体提取人可读文案；形状不符返回 null 走通用文案。 */
function extractErrorMessage(payload) {
  if (typeof payload === 'string') return payload
  const err = payload?.error
  if (err !== null && typeof err === 'object') {
    if (typeof err.message === 'string' && err.message.trim() !== '') {
      return ERROR_CODE_TEXT[err.code] ?? err.message
    }
    return null
  }
  if (typeof payload?.detail === 'string') return payload.detail
  if (payload?.detail !== null && typeof payload.detail === 'object') {
    return typeof payload.detail.message === 'string' ? payload.detail.message : null
  }
  return null
}

async function startAuthPage() {
  const mode = location.pathname === '/setup' ? 'setup' : 'login'
  const title = document.getElementById('auth-title')
  const subtitle = document.getElementById('auth-subtitle')
  const form = document.getElementById('auth-form')
  const identifier = document.getElementById('auth-identifier')
  const identifierLabel = document.getElementById('auth-identifier-label')
  const emailField = document.getElementById('auth-email-field')
  const email = document.getElementById('auth-email')
  const password = document.getElementById('auth-password')
  const confirmField = document.getElementById('auth-confirm-field')
  const confirm = document.getElementById('auth-confirm')
  const errorNode = document.getElementById('auth-error')
  const submit = document.getElementById('auth-submit')
  const back = document.getElementById('auth-back')
  if (!form || !identifier || !password || !submit) return

  const status = await readAccountStatus()
  if (status?.authenticated === true) {
    location.replace(nextDestination())
    return
  }
  // 模式与服务器状态互斥纠偏：初始化完还停留 /setup、未初始化却进 /login 都送去正确的一页。
  if (mode === 'setup' && status?.needsSetup === false) {
    location.replace('/login' + location.search)
    return
  }
  if (mode === 'login' && status?.needsSetup === true) {
    location.replace('/setup' + location.search)
    return
  }

  const isSetup = mode === 'setup'
  if (title) title.textContent = isSetup ? '初始化管理员账户' : '登录工作台'
  if (subtitle) {
    subtitle.textContent = isSetup
      ? '首次启动需要创建一个管理员账户以完成系统初始化。'
      : '本地账户由内置 QiLin 引擎管理。'
  }
  if (identifierLabel) identifierLabel.textContent = isSetup ? '用户名' : '用户名或邮箱'
  if (emailField) emailField.hidden = !isSetup
  if (confirmField) confirmField.hidden = !isSetup
  if (submit) submit.textContent = isSetup ? '初始化并进入' : '登录并进入'
  if (back) back.hidden = isSetup

  const showError = (message) => {
    if (!errorNode) return
    errorNode.textContent = message
    errorNode.hidden = false
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const identifierValue = identifier.value.trim()
    const passwordValue = password.value
    if (!identifierValue || !passwordValue) {
      showError(isSetup ? '请填写用户名与密码' : '请填写用户名（或邮箱）与密码')
      return
    }
    if (isSetup) {
      if (passwordValue.length < PASSWORD_MINIMUM) {
        showError(`密码至少 ${PASSWORD_MINIMUM} 位`)
        return
      }
      if (confirm && passwordValue !== confirm.value) {
        showError('两次输入的密码不一致')
        return
      }
    }
    submit.disabled = true
    submit.textContent = isSetup ? '初始化中…' : '登录中…'
    try {
      const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login'
      const body = isSetup
        ? { username: identifierValue, email: email?.value.trim() ?? '', password: passwordValue }
        : { identifier: identifierValue, password: passwordValue }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        let payload = null
        try {
          payload = await response.json()
        } catch { /* 非 JSON 错误体，走通用文案 */ }
        showError(extractErrorMessage(payload) ?? '操作失败，请稍后重试')
        return
      }
      // 成功响应已携带会话 cookie，直接送往目的地。
      location.assign(nextDestination())
    } catch {
      showError('网络错误，请确认引擎已启动')
    } finally {
      submit.disabled = false
      submit.textContent = isSetup ? '初始化并进入' : '登录并进入'
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAuthPage)
} else {
  startAuthPage()
}
