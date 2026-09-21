/**
 * 策略库 主区面板：页头 + 库 Section。
 */

import type { UseWorkspaces } from '@kstock/quant-ui'
import { StrategiesSection } from './section.tsx'

export function StrategiesPage({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>策略库</strong>
          <span>策略研究资产沉淀：版本时间线与回测对比</span>
        </div>
      </header>
      <StrategiesSection useWorkspaces={useWorkspaces} />
    </div>
  )
}
