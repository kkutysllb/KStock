/**
 * KStock 新任务页面欢迎组件
 *
 * 根据当前时段 + 日期类型，动态选择主标题、副标题、CTA 建议标签。
 * 突出 KStock 的差异化能力：21 个编排场景、Tushare Pro + 同花顺问财、
 * 可转债/期权/宏观/行业/研报等专题技能。
 */

import { useEffect, useState } from "react";

type Tone = "emerald" | "cyan" | "amber" | "rose";

interface HeroContent {
  /** 主标题中需要高亮（em）的短语，对应绿色/青色等强调色 */
  emphasis: string;
  /** 主标题完整文本（用于 emoji 装饰的高亮短语会替换为 {emphasis}） */
  title: string;
  /** 副标题：按段落渲染（数组每项一段，渲染为独立 <p>） */
  subtitle: string[];
  /** 3 个 CTA 建议标签，引导用户提问 */
  ctas: string[];
  /** eyebrow 标签左侧字样 */
  eyebrow: string;
  /** eyebrow 右侧序号 */
  index: string;
  /** 当前时间段的语气色（暂未在 UI 使用，预留） */
  tone: Tone;
}

/**
 * 时段 × 日类型文案库
 * - 工作日分 5 段：早盘前 / 早盘 / 午盘 / 收盘后 / 晚间
 * - 周末（周六、日）
 * - 节假日（春节/国庆/中秋等，由 caller 在 isHoliday=true 时传入）
 */
const CONTENT_BY_SLOT: Record<string, HeroContent> = {
  // ── 工作日 5 个时段 ───────────────────────────────────────────
  "weekday-premarket": {
    emphasis: "今日的盘前准备。",
    title: "用一份早报，给{emphasis}",
    subtitle: [
      "9:30 开盘前 1 分钟，行情、隔夜外盘与财经资讯已经整理好。",
      "把想跟踪的标的交给我，开盘即可对照。",
    ],
    ctas: [
      "拉一份今日可转债市场温度",
      "复盘美股隔夜对 A 股的影响",
      "分析 XX 公司近期公告与新闻",
    ],
    eyebrow: "Research Desk",
    index: "01",
    tone: "emerald",
  },
  "weekday-morning": {
    emphasis: "盘中的节奏感。",
    title: "边看行情，边看{emphasis}",
    subtitle: [
      "盘中最怕错过关键节点。",
      "子代理会实时跟踪你关注的板块与个股，把异动与研报观点同步整理给你。",
    ],
    ctas: [
      "盯盘当前主升板块的资金动向",
      "实时跟踪个股异动原因",
      "盘中策略调仓建议",
    ],
    eyebrow: "Live Desk",
    index: "02",
    tone: "cyan",
  },
  "weekday-noon": {
    emphasis: "午间的小结。",
    title: "用 15 分钟，做一份{emphasis}",
    subtitle: [
      "中午休市是整理上午盘的最佳窗口。",
      "主线板块、领涨个股、风险信号全部提炼出来，午后开盘心里有数。",
    ],
    ctas: [
      "总结上午盘资金流向与板块轮动",
      "给出午后开盘的策略建议",
      "对比龙头股上午强弱排序",
    ],
    eyebrow: "Mid-Day Brief",
    index: "03",
    tone: "amber",
  },
  "weekday-post": {
    emphasis: "盘后的研究闭环。",
    title: "15:00 收盘，进入{emphasis}",
    subtitle: [
      "收盘不等于结束。",
      "可转债估值全景、行业信号、ETF 份额、研报与一致预期，15 分钟内把今天的事实落定。",
    ],
    ctas: [
      "生成今日 A 股可转债全景分析",
      "梳理今日行业板块与资金面",
      "复盘本周强势板块",
    ],
    eyebrow: "Research Desk",
    index: "04",
    tone: "emerald",
  },
  "weekday-evening": {
    emphasis: "深度研究的时段。",
    title: "夜深人静，做一份{emphasis}",
    subtitle: [
      "深度报告从来不是拉个数据能搞定的事。",
      "基本面三表、DCF 估值、行业上下游、研报与目标价，今晚我陪你跑一遍。",
    ],
    ctas: [
      "对 XX 公司做 DCF 估值建模",
      "生成 XX 行业产业链深度报告",
      "对贵州茅台做盈利预期修正分析",
    ],
    eyebrow: "Deep Work",
    index: "05",
    tone: "rose",
  },

  // ── 周末 ────────────────────────────────────────────────────
  saturday: {
    emphasis: "一周的沉淀。",
    title: "把这一周的研究，{emphasis}",
    subtitle: [
      "周末是回顾与布局的好时机。",
      "周度复盘、月度策略、专题研究、因子回测，所有 KSkills 技能随时待命。",
    ],
    ctas: [
      "生成本周可转债周度全景报告",
      "做一次多因子选股回测",
      "梳理下周宏观与板块关注点",
    ],
    eyebrow: "Weekend Brief",
    index: "W1",
    tone: "emerald",
  },
  sunday: {
    emphasis: "下周的准备。",
    title: "用一张清单，给{emphasis}",
    subtitle: [
      "周日晚上梳理清楚。",
      "可转债周报、期权 IV、北向资金、周一开盘的预案，让下周第一天的决策更稳。",
    ],
    ctas: [
      "生成可转债下周策略清单",
      "分析当前期权隐含波动率",
      "整理一周重要公告与解禁",
    ],
    eyebrow: "Weekend Brief",
    index: "W2",
    tone: "emerald",
  },

  // ── 节假日 ─────────────────────────────────────────────────
  holiday: {
    emphasis: "假日的专题研究。",
    title: "用一段整块时间，做一份{emphasis}",
    subtitle: [
      "假期适合啃硬骨头。",
      "完整 DCF、产业链梳理、可转债周度、宏观深度、策略回测，今天的研究明天可以少踩一个坑。",
    ],
    ctas: [
      "对一只股票做完整的 DCF 估值",
      "梳理一个行业的产业链上下游",
      "跑一次策略回测，验证选股逻辑",
    ],
    eyebrow: "Holiday Brief",
    index: "H0",
    tone: "rose",
  },
};

/**
 * 根据 Date 计算当前时段 key
 * - 工作日 09:00 前 → weekday-premarket
 * - 工作日 09:00-11:30 → weekday-morning
 * - 工作日 11:30-13:00 → weekday-noon
 * - 工作日 13:00-15:00 → weekday-post（注：盘中也可能调到这里，措辞改为盘后即时）
 * - 工作日 15:00-19:00 → weekday-post
 * - 工作日 19:00 后 → weekday-evening
 * - 周六 → saturday / 周日 → sunday
 * - 节假日 → holiday（caller 通过 isHoliday 控制）
 */
function resolveSlotKey(date: Date, isHoliday: boolean): keyof typeof CONTENT_BY_SLOT {
  if (isHoliday) return "holiday";
  const day = date.getDay(); // 0=Sunday, 6=Saturday
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";

  const hour = date.getHours();
  const minute = date.getMinutes();
  const hm = hour * 60 + minute;

  // 工作日
  if (hm < 9 * 60) return "weekday-premarket"; // 09:00 前
  if (hm < 11 * 60 + 30) return "weekday-morning"; // 09:00-11:30
  if (hm < 13 * 60) return "weekday-noon"; // 11:30-13:00
  if (hm < 19 * 60) return "weekday-post"; // 13:00-19:00 全部归为盘后（含下午盘）
  return "weekday-evening"; // 19:00 后
}

/**
 * 将 title 中的 {emphasis} 替换为 <em>{emphasis}</em>，其他部分为普通文本
 */
function renderTitleWithEmphasis(title: string, emphasis: string) {
  const parts = title.split("{emphasis}");
  return (
    <>
      {parts[0]}
      <em>{emphasis}</em>
      {parts.slice(1).join("{emphasis}")}
    </>
  );
}

interface WelcomeHeroProps {
  /** 是否节假日（由 caller 根据日期判断，外部可注入节假日判断逻辑） */
  isHoliday?: boolean;
}

/**
 * 新任务页面欢迎组件：根据当前时间显示动态文案。
 * 每分钟自动重算时段（不需要实时刷新，日期变化时重新渲染）。
 */
export function WelcomeHero({ isHoliday = false }: WelcomeHeroProps) {
  const [slotKey, setSlotKey] = useState<keyof typeof CONTENT_BY_SLOT>(() =>
    resolveSlotKey(new Date(), isHoliday),
  );

  // 每分钟重算（处理跨时段；同时刷新日期判断）
  useEffect(() => {
    const tick = () => setSlotKey(resolveSlotKey(new Date(), isHoliday));
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [isHoliday]);

  const content = CONTENT_BY_SLOT[slotKey];
  if (!content) return null;

  return (
    <div className="workspace-empty">
      <div className="welcome-heading">
        <p className="eyebrow">
          <span>{content.eyebrow}</span>
          <span className="eyebrow-index">{content.index}</span>
        </p>
        <h1>{renderTitleWithEmphasis(content.title, content.emphasis)}</h1>
        <div className="welcome-subtitle">
          {content.subtitle.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
        <ul className="welcome-ctas" aria-label="推荐提问">
          {content.ctas.map((text, idx) => (
            <li key={idx}>
              <span className="cta-bullet" aria-hidden="true">›</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default WelcomeHero;