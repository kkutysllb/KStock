// pipeline_stage 徽章。低饱和色区分阶段，流式时带脉冲动画。

const STAGE_CLASS: Record<string, string> = {
  准备: "prepare",
  检索资料: "search",
  数据分析: "analysis",
  撰写报告: "report",
  完成: "done"
};

interface StageBadgeProps {
  stage?: string;
  /** 流式中（turn status=streaming）→ 脉冲动画。 */
  streaming?: boolean;
}

export function StageBadge({ stage, streaming }: StageBadgeProps) {
  const label = stage ?? "准备";
  const cls = STAGE_CLASS[label] ?? "prepare";
  const classes = ["stage-badge", `stage-${cls}`];
  if (streaming) classes.push("streaming");
  return (
    <span className={classes.join(" ")} aria-label="研究阶段">
      {streaming && <span className="stage-pulse" aria-hidden="true" />}
      <span className="stage-label">{label}</span>
    </span>
  );
}
