import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import {
  type SkillInfo,
  getAvailableSkills,
  setSkillEnabled,
  isExtensionsApiError,
} from "../lib/extensionsClient";

/**
 * 技能启停管理卡片。
 *
 * 加载 vendor/skills 下预置技能列表 → 展示 name + title + enabled toggle →
 * toggle 调 PUT 端点。支持搜索过滤。
 *
 * 与 McpExtensionsCard 的区别：skills 不是用户自由的 CRUD（不能新增/删除），
 * 只能启用/禁用某个预置技能。extensions_config.json 的 skills 字段是
 * dict[name, {enabled: bool}]，不在里面的 skill 默认 enabled=true。
 */
export function SkillsExtensionsCard() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // 正在切换中的技能名（防止快速点击）
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getAvailableSkills();
      setSkills(resp.skills);
    } catch (err) {
      setError(isExtensionsApiError(err) ? err.message : "加载技能列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleToggle = useCallback(
    async (name: string, currentEnabled: boolean) => {
      setToggling((prev) => new Set(prev).add(name));
      // 乐观更新：立即切换 UI 状态
      setSkills((prev) =>
        prev.map((s) =>
          s.name === name ? { ...s, enabled: !currentEnabled } : s
        )
      );
      try {
        if (currentEnabled) {
          // 当前是启用 → 禁用：写入 enabled=false
          await setSkillEnabled(name, false);
        } else {
          // 当前是禁用 → 启用：删除记录恢复默认（或写 enabled=true）
          // 用 setSkillEnabled(true) 更明确
          await setSkillEnabled(name, true);
        }
      } catch (err) {
        // 回滚乐观更新
        setSkills((prev) =>
          prev.map((s) =>
            s.name === name ? { ...s, enabled: currentEnabled } : s
          )
        );
        setError(isExtensionsApiError(err) ? err.message : "切换技能状态失败");
      } finally {
        setToggling((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    []
  );

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [skills, searchQuery]);

  const enabledCount = useMemo(
    () => skills.filter((s) => s.enabled).length,
    [skills]
  );

  if (loading) {
    return (
      <section className="settings-card skills-extensions-card">
        <p className="memory-loading">加载技能列表…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="settings-card skills-extensions-card">
        <p className="auth-error" role="alert">{error}</p>
      </section>
    );
  }

  return (
    <section className="settings-card skills-extensions-card" aria-label="技能启停管理">
      <div className="skills-header">
        <Sparkles size={18} />
        <h2>预置技能（{enabledCount}/{skills.length} 启用）</h2>
      </div>
      <p className="runtime-config-desc">
        KStock 预置的股票分析技能包。关闭某个技能后，子代理不会加载它。
        未显式记录的技能默认启用。变更需重启 gateway 生效。
      </p>

      <div className="skills-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="搜索技能名或描述…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredSkills.length === 0 ? (
        <p className="mcp-empty">
          {searchQuery.trim() ? "没有匹配的技能。" : "暂无预置技能。"}
        </p>
      ) : (
        <div className="skills-list">
          {filteredSkills.map((skill) => (
            <SkillRow
              key={skill.name}
              skill={skill}
              toggling={toggling.has(skill.name)}
              onToggle={() => handleToggle(skill.name, skill.enabled)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── 技能行 ──────────────────────────────────────────────────────────

function SkillRow({
  skill,
  toggling,
  onToggle,
}: {
  skill: SkillInfo;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="skill-row">
      <div className="skill-row-info">
        <div className="skill-row-title">
          <span className="skill-row-name">{skill.name}</span>
          <span className={`skill-row-group ${skill.group}`}>
            {skill.group}
          </span>
        </div>
        <span className="skill-row-desc">
          {skill.description || skill.title}
        </span>
      </div>
      <label className="skill-toggle">
        <input
          type="checkbox"
          checked={skill.enabled}
          onChange={onToggle}
          disabled={toggling}
        />
        <span className="skill-toggle-track" />
      </label>
    </div>
  );
}
