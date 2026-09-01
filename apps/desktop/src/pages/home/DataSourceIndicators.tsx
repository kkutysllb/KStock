import type { DataSourceConfig } from "../../lib/dataSourcesClient";

/** 顶部连接状态里的数据源链接指示（Tushare / iWenCai）。 */
export function DataSourceIndicators({ dataSources }: { dataSources: DataSourceConfig[] }) {
  const statusById = new Map(dataSources.map((source) => [source.id, source]));

  return (
    <span className="data-source-indicators" aria-label="数据源连接状态">
      {(["tushare", "iwencai"] as const).map((id) => {
        const source = statusById.get(id);
        const linked = Boolean(source?.configured);
        const label = id === "tushare" ? "Tushare" : "iWenCai";
        return (
          <span className={`data-source-indicator ${linked ? "linked" : ""}`} key={id}>
            <span className="data-source-indicator-dot" aria-hidden="true" />
            <span>{label}</span>
            <em>{linked ? "已链接" : "未链接"}</em>
          </span>
        );
      })}
    </span>
  );
}
