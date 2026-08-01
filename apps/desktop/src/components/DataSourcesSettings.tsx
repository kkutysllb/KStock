import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, RotateCcw, Save } from "lucide-react";
import {
  getDataSources,
  isDataSourcesApiError,
  updateDataSources,
  type DataSourceConfig,
} from "../lib/dataSourcesClient";

type Draft = {
  tushare_token: string;
  iwencai_api_key: string;
};

const EMPTY_DRAFT: Draft = {
  tushare_token: "",
  iwencai_api_key: "",
};

export function DataSourcesSettings() {
  const [sources, setSources] = useState<DataSourceConfig[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDataSources();
      setSources(response.sources);
    } catch (err) {
      setError(isDataSourcesApiError(err) ? err.message : "数据源配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await updateDataSources({
        tushare_token: draft.tushare_token.trim() || null,
        iwencai_api_key: draft.iwencai_api_key.trim() || null,
      });
      setSources(response.sources);
      setDraft(EMPTY_DRAFT);
      setSaved(true);
    } catch (err) {
      setError(isDataSourcesApiError(err) ? err.message : "数据源凭证保存失败");
    } finally {
      setSaving(false);
    }
  };

  const renderSourceField = (
    id: "tushare" | "iwencai",
    label: string,
    description: string,
    field: keyof Draft,
  ) => {
    const source = sourceById.get(id);
    const isVisible = Boolean(visible[id]);
    return (
      <article className="data-source-field" key={id}>
        <div className="data-source-field-heading">
          <div className="data-source-icon"><KeyRound size={16} /></div>
          <div>
            <strong>{label}</strong>
            <p>{description}</p>
          </div>
          <span className={`data-source-status ${source?.configured ? "configured" : ""}`}>
            {source?.configured && <CheckCircle2 size={13} />}
            {source?.configured ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="data-source-input-row">
          <input
            type={isVisible ? "text" : "password"}
            value={draft[field]}
            placeholder={source?.configured ? "已配置，留空保持不变" : "填写凭证"}
            autoComplete="new-password"
            onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
          />
          <button
            className="icon-ghost"
            type="button"
            aria-label={isVisible ? `隐藏${label}` : `显示${label}`}
            title={isVisible ? "隐藏凭证" : "显示凭证"}
            onClick={() => setVisible((current) => ({ ...current, [id]: !isVisible }))}
          >
            {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <small>环境变量：{source?.env_name ?? id}</small>
      </article>
    );
  };

  return (
    <div className="data-sources-settings">
      <section className="settings-card data-sources-card" aria-label="数据源凭证">
        <div className="data-sources-header">
          <div className="data-sources-title">
            <div className="data-sources-title-icon"><KeyRound size={17} /></div>
            <div>
              <strong>项目数据源凭证</strong>
              <p>为股票与行业分析技能配置数据访问凭证。</p>
            </div>
          </div>
          <span className="data-sources-safe-note">仅保存在本机用户数据目录</span>
        </div>

        {loading ? (
          <p className="memory-loading">读取数据源配置…</p>
        ) : (
          <form className="data-source-form" onSubmit={handleSave}>
            {renderSourceField("tushare", "Tushare Pro", "A 股行情、财务与指数数据", "tushare_token")}
            {renderSourceField("iwencai", "同花顺问财", "实时行情与行业数据", "iwencai_api_key")}
            <div className="data-source-actions">
              <button className="link-button" type="button" onClick={() => { setDraft(EMPTY_DRAFT); setSaved(false); }} disabled={saving}>
                <RotateCcw size={14} />重置输入
              </button>
              <button className="hero-primary" type="submit" disabled={saving}>
                <Save size={14} />{saving ? "保存中…" : "保存凭证"}
              </button>
            </div>
            {saved && <p className="data-source-saved" role="status">凭证已保存，后续技能调用会使用最新配置。</p>}
          </form>
        )}
        {error && <p className="data-source-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
