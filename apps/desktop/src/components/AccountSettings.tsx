import { KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import type { AuthUser } from "../lib/authClient";
import type { ModelConfig } from "../lib/modelsClient";

/**
 * 账户与登录设置页。
 *
 * 展示当前登录用户的本地账户信息（email / 角色 / user_id / 登录方式）+
 * 各模型 API 密钥的环境变量配置项名称（值不回显，只展示需配置的变量名）+
 * 登出按钮。
 *
 * 不做 OIDC/SSO 配置（后续扩展），只读展示本地账户状态。
 */
interface AccountSettingsProps {
  currentUser: AuthUser;
  models: ModelConfig[];
  onLogout: () => void;
}

export function AccountSettings({ currentUser, models, onLogout }: AccountSettingsProps) {
  const isAdmin = currentUser.system_role === "admin";

  return (
    <div className="account-settings">
      <section className="settings-card" aria-label="账户信息">
        <div className="account-user-header">
          <div className={`account-avatar ${isAdmin ? "admin" : "user"}`}>
            {isAdmin ? <ShieldCheck size={24} /> : <User size={24} />}
          </div>
          <div className="account-user-info">
            <strong>{currentUser.email}</strong>
            <span className={`account-role-badge ${isAdmin ? "admin" : "user"}`}>
              {isAdmin ? "管理员" : "普通用户"}
            </span>
          </div>
        </div>

        <div className="settings-rows">
          <div className="setting-row">
            <div>
              <strong>用户 ID</strong>
              <span>工作区身份标识，绑定 QiLin owner 权限</span>
            </div>
            <code className="account-user-id">{currentUser.id}</code>
          </div>
          <div className="setting-row">
            <div>
              <strong>登录方式</strong>
              <span>账户认证来源</span>
            </div>
            <span className="account-auth-method">
              {currentUser.oauth_provider ? `OAuth（${currentUser.oauth_provider}）` : "本地密码"}
            </span>
          </div>
        </div>

        <div className="account-actions">
          <button type="button" className="hero-danger" onClick={onLogout}>
            <LogOut size={14} /> 登出
          </button>
        </div>
      </section>

      <section className="settings-card" aria-label="API 密钥配置">
        <strong>模型 API 密钥</strong>
        <p className="runtime-config-desc">
          各模型的 API 密钥从后端环境变量读取（变量名见下表）。密钥值不回显，
          仅展示需配置的环境变量名。请在 <code>secrets.env</code> 中配置后重启 gateway。
        </p>
        {models.length === 0 ? (
          <p className="account-empty">未配置任何模型。请到「模型」设置页添加。</p>
        ) : (
          <div className="account-api-keys">
            {models.map((m) => (
              <div key={m.name} className="account-api-key-row">
                <span className="account-api-key-name">{m.display_name || m.name}</span>
                <code className="account-api-key-env">
                  <KeyRound size={12} />
                  {m.api_key_env || "（未配置环境变量名）"}
                </code>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
