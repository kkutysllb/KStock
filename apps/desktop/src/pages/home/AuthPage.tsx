import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  initializeAdmin as gatewayInitializeAdmin,
  isAuthApiError,
  login as gatewayLogin,
  register as gatewayRegister,
  tryGetCurrentUser,
  type AuthUser,
} from "../../lib/authClient";
import { LogoMark } from "../../components/LogoMark";
import type { AuthMode } from "./types";

export function AuthPage({
  mode,
  needsSetup,
  registrationEnabled,
  onBack,
  onComplete,
  onModeChange
}: {
  mode: AuthMode;
  /** gateway ``setup-status`` 的 ``needs_setup``：为 true 时注册走 ``/initialize`` 创建管理员。 */
  needsSetup: boolean;
  /** gateway ``setup-status`` 的 ``registration_enabled``：为 false 时禁止普通注册。 */
  registrationEnabled: boolean;
  onBack: () => void;
  onComplete: (user: AuthUser) => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const isLogin = mode === "login";
  // 首启注册=创建管理员（走 /initialize），否则=普通用户（走 /register）。
  const isAdminBootstrap = !isLogin && needsSetup;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 切换登录/注册模式时清空错误，避免残留提示误导用户。
  useEffect(() => {
    setError(null);
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("请填写邮箱与密码");
      return;
    }
    // 注册时校验两次密码一致（登录无需）。
    if (!isLogin && password !== passwordConfirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    setError(null);
    // 登录/注册动作（登录成功后补一次 /me 拿账户信息）。
    const performAuth = async (): Promise<AuthUser> => {
      if (isLogin) {
        await gatewayLogin(trimmedEmail, password, rememberMe);
        const user = await tryGetCurrentUser();
        if (!user) {
          throw new Error("登录成功但无法读取账户信息，请重试");
        }
        return user;
      }
      if (isAdminBootstrap) {
        return gatewayInitializeAdmin({
          email: trimmedEmail,
          password,
          remember_me: rememberMe,
        });
      }
      return gatewayRegister({
        email: trimmedEmail,
        password,
        remember_me: rememberMe,
      });
    };
    try {
      onComplete(await performAuth());
    } catch (err) {
      let finalErr: unknown = err;
      // gateway 冷启动竞态兜底：网络错误等待 1.5 秒后重试一次
      // （Windows 冷启动可能比前端 boot 探测更慢），仍失败才提示用户。
      if (isAuthApiError(finalErr) && finalErr.code === "network_error") {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        try {
          onComplete(await performAuth());
          return;
        } catch (retryErr) {
          finalErr = retryErr;
        }
      }
      setError(
        isAuthApiError(finalErr)
          ? finalErr.message
          : finalErr instanceof Error && finalErr.message
            ? finalErr.message
            : "操作失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 标题 / 副标题 / 提交按钮文案随首启 / 登录 / 普通注册变化。
  const heading = isLogin
    ? "登录工作台"
    : isAdminBootstrap
      ? "初始化管理员账户"
      : "创建本地账户";
  const subtitle = isLogin
    ? "本地账户由内置 QiLin gateway 管理会话，后续会接入 OIDC / SSO 与本机安全密钥存储。"
    : isAdminBootstrap
      ? "首次启动需要创建一个管理员账户以完成系统初始化，该账户将拥有 system_role=admin。"
      : "注册将创建一个普通用户账户（system_role=user），管理员需在首启时初始化。";
  const submitLabel = submitting
    ? "处理中…"
    : isLogin
      ? "登录并进入"
      : isAdminBootstrap
        ? "初始化并进入"
        : "注册并进入";

  return (
    <main className="auth-shell">
      {/* Windows 无框窗口拖拽带（macOS 下 display:none，原生标题栏可拖）。 */}
      <div className="titlebar-drag-strip" aria-hidden="true" />
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        <span>返回首页</span>
      </button>
      <section className="auth-panel" aria-label={isLogin ? "登录" : "注册"}>
        <div>
          <div className="auth-brand" aria-label="KStock 账户">
            <LogoMark compact />
            <span>KStock</span>
          </div>
          <h1>{heading}</h1>
          <p>{subtitle}</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="research@kstock.dev"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="至少 8 位"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {!isLogin && (
            <label>
              <span>确认密码</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </label>
          )}
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>记住我（保持 7 天登录态）</span>
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="hero-primary full"
            type="submit"
            disabled={submitting}
          >
            <span>{submitLabel}</span>
          </button>
        </form>
        {/* 首启只能初始化管理员，不提供切换到普通登录的入口；登录模式不显示切换。 */}
        {!isAdminBootstrap && (
          <button
            className="link-button"
            type="button"
            onClick={() => onModeChange(isLogin ? "register" : "login")}
          >
            {isLogin
              ? (registrationEnabled ? "没有账户？注册" : "仅管理员可登录")
              : "已有账户？登录"}
          </button>
        )}
      </section>
    </main>
  );
}
