import { useEffect, useState, type CSSProperties } from "react";
import { Bot, Command, FileText, Lock, Sparkles } from "lucide-react";
import { fetchLandingNews, type LandingNewsItem } from "../../lib/landingNewsClient";
import type { DataSourceConfig } from "../../lib/dataSourcesClient";
import { LogoMark } from "../../components/LogoMark";
import { DataSourceIndicators } from "./DataSourceIndicators";
import { openExternalUrl, toggleWindowMaximize } from "./windowChrome";
import type { AuthMode } from "./types";

const landingCandles = [
  { left: 2, top: 56, height: 11, delay: -0.2, direction: "up" },
  { left: 6, top: 47, height: 18, delay: -1.1, direction: "down" },
  { left: 10, top: 52, height: 9, delay: -2.4, direction: "up" },
  { left: 14, top: 39, height: 23, delay: -0.8, direction: "up" },
  { left: 18, top: 43, height: 15, delay: -1.8, direction: "down" },
  { left: 22, top: 33, height: 20, delay: -2.7, direction: "up" },
  { left: 26, top: 36, height: 11, delay: -0.5, direction: "up" },
  { left: 30, top: 26, height: 24, delay: -2.1, direction: "down" },
  { left: 34, top: 31, height: 14, delay: -1.4, direction: "up" },
  { left: 38, top: 20, height: 25, delay: -2.9, direction: "up" },
  { left: 42, top: 24, height: 13, delay: -0.9, direction: "down" },
  { left: 46, top: 17, height: 20, delay: -1.7, direction: "up" },
  { left: 50, top: 23, height: 10, delay: -2.5, direction: "down" },
  { left: 54, top: 12, height: 24, delay: -0.7, direction: "up" },
  { left: 58, top: 17, height: 12, delay: -2.2, direction: "up" },
  { left: 62, top: 8, height: 22, delay: -1.3, direction: "down" },
  { left: 66, top: 13, height: 14, delay: -2.8, direction: "up" },
  { left: 70, top: 21, height: 19, delay: -0.4, direction: "down" },
  { left: 74, top: 17, height: 11, delay: -1.9, direction: "up" },
  { left: 78, top: 28, height: 20, delay: -2.6, direction: "down" },
  { left: 82, top: 24, height: 12, delay: -1.0, direction: "up" },
  { left: 86, top: 35, height: 23, delay: -2.0, direction: "down" },
  { left: 90, top: 31, height: 13, delay: -0.6, direction: "up" },
  { left: 94, top: 43, height: 19, delay: -2.3, direction: "down" },
  { left: 98, top: 50, height: 12, delay: -1.5, direction: "up" }
];

export function LandingPage({ onEnter, onAuth, dataSources }: { onEnter: () => void; onAuth: (mode: AuthMode) => void; dataSources: DataSourceConfig[] }) {
  const [newsItems, setNewsItems] = useState<LandingNewsItem[]>([]);

  useEffect(() => {
    let active = true;
    const loadNews = async () => {
      try {
        const response = await fetchLandingNews();
        if (!active) return;
        setNewsItems(response.items.slice(0, 10));
      } catch {
        // 落地页新闻是增强信息，接口不可用时保留空态，不阻塞登录入口。
      }
    };
    void loadNews();
    const timer = window.setInterval(() => void loadNews(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const tickerItems = newsItems.length > 1 ? [...newsItems, ...newsItems] : newsItems;

  return (
    <main className="landing-shell">
      <nav
        className="landing-nav"
        aria-label="产品入口"
        onDoubleClick={toggleWindowMaximize}
      >
        <div className="brand-mark">
          <LogoMark />
          <strong>KStock</strong>
        </div>
        <div className="landing-nav-engine" aria-label="QiLin 引擎状态">
          <span className="status-pulse" />
          <span>QiLin 引擎</span>
          <em>已连接</em>
          <DataSourceIndicators dataSources={dataSources} />
        </div>
      </nav>

      <section className="landing-hero" aria-label="产品介绍">
        <div className="market-scene" aria-hidden="true">
          <div className="kline-field">
            <div className="kline-grid" />
            <div className="kline-stream">
              {landingCandles.map((candle, index) => (
                <span
                  key={`${candle.left}-${index}`}
                  className={`kline-candle ${candle.direction}`}
                  style={
                    {
                      left: `${candle.left}%`,
                      top: `${candle.top}%`,
                      height: `${candle.height}%`,
                      animationDelay: `${candle.delay}s`
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Stock Quant Agent Desktop</p>
          <h1>KStock</h1>
          <p className="hero-subtitle">用对话完成股票研究、分析和报告，把 QiLin 引擎与精选 KSkills 技能封装成跨平台桌面工作台。</p>
          <div className="hero-actions">
            <button className="hero-primary" type="button" onClick={onEnter}>
              <Command size={18} />
              <span>进入工作台</span>
            </button>
            <button className="hero-secondary" type="button" onClick={() => onAuth("login")}>
              <Lock size={18} />
              <span>登录 / 注册</span>
            </button>
          </div>
        </div>
        <div className="engine-brief" aria-label="QiLin 引擎介绍">
          <p>QiLin Engine</p>
          <strong>面向投研报告的本地 Agent 核心</strong>
          <span><b>内置引擎</b>发布包使用 vendor/qilin，不依赖开发机外部仓库。</span>
          <span><b>精选技能</b>加载财报、估值、行业、新闻、公告、宏观等 KSkills 子集。</span>
          <span><b>报告交付</b>生成研究路径、来源摘要、图表建议和 Markdown 草稿。</span>
        </div>
        <section className="landing-news" aria-label="财经新闻">
          <header className="landing-news-header">
            <div>
              <p className="eyebrow">Market News</p>
              <h2>财经快讯</h2>
            </div>
          </header>
          <div className="landing-news-window">
            {tickerItems.length > 0 ? (
              <div className="landing-news-list">
                {tickerItems.map((item, index) => (
                  <a
                    key={`${item.title}-${index}`}
                    className="landing-news-item"
                    href={item.url || undefined}
                    target={item.url ? "_blank" : undefined}
                    rel={item.url ? "noreferrer" : undefined}
                    onClick={(event) => {
                      if (!item.url) return;
                      event.preventDefault();
                      void openExternalUrl(item.url);
                    }}
                    aria-hidden={index >= newsItems.length ? "true" : undefined}
                  >
                    <span className="landing-news-index">{String((index % Math.max(newsItems.length, 10)) + 1).padStart(2, "0")}</span>
                    <span className="landing-news-title">{item.title}</span>
                    <time>{item.published_at || item.source}</time>
                  </a>
                ))}
              </div>
            ) : (
              <p className="landing-news-empty">正在获取最新财经资讯…</p>
            )}
          </div>
        </section>
      </section>

      <section className="landing-band" aria-label="亮点">
        <article>
          <Bot size={20} />
          <h2>QiLin 内置引擎</h2>
          <p>内置任务编排与流式 Agent 引擎，支持上下文记忆、工具调用、并行 Subagent 和可追踪的研究过程。</p>
        </article>
        <article>
          <Sparkles size={20} />
          <h2>精选技能体系</h2>
          <p>KSkills 按研究场景组织财报、行情、估值、行业、新闻、公告与宏观技能，按需激活并协同数据源完成复杂分析。</p>
        </article>
        <article>
          <FileText size={20} />
          <h2>报告优先流程</h2>
          <p>从问题到数据来源、推理过程、图表和 Markdown 报告，围绕投研交付组织界面。</p>
        </article>
      </section>
    </main>
  );
}
