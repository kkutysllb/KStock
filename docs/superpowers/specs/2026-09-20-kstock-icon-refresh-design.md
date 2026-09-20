# KStock 应用图标与系统托盘图标重构 · 设计

日期：2026-09-20
状态：**已实施**——设计定稿（DB1 篆书横排 + KSTOCK 品牌绿字标）、生产资产已生成并通过断言、Electron 四处代码已改；待打包视觉验收与推送
提案稿与全部出图：[`docs/design/icon-refresh/design-board.html`](../design/icon-refresh/design-board.html)
矢量源与渲染脚本：
[`generate.py`](../design/icon-refresh/generate.py)（方向 A–D）·
[`generate_seal.py`](../design/icon-refresh/generate_seal.py)（麒麟印章）·
[`generate_dual.py`](../design/icon-refresh/generate_dual.py)（双品牌版式）·
[`generate_zhuan.py`](../design/icon-refresh/generate_zhuan.py)（**篆书定稿版**）

---

## 1. 背景与目标

现有应用图标（`apps/desktop/build/icon.icns` / `icon.ico` / `icons/*.png` / `tray.png`）
是二进制孤本：仓库内没有矢量源，也没有任何生成脚本，改一版必须手搓全部尺寸。同时它在
**16–32px 这个最高频的使用尺寸上失效**。本次重构同时解决「可维护性」与「小尺寸可用性」。

目标（按优先级）：

1. 32px 与 16pt 下图形可辨（当前任务栏图标、菜单栏托盘图标均不可辨）。
2. 图标有单一矢量真源，一次改动即可重出全平台全尺寸资产。
3. 建立「应用图标」与「托盘图标」两套各自为尺寸优化的图形，而不是同一张图硬缩。
4. **双品牌**：麒麟（引擎／中文品牌）以**篆书朱印**呈现；KStock（产品）以**拉丁字标与品牌绿 K** 呈现。

非目标：不改动界面内 token 色板、不改动侧栏 / hero 品牌标记（`Marks.tsx`）的现用图形
（色值同步为可选项，见 §6 第 5 项）。

## 2. 现状问题（实测证据）

| # | 问题 | 证据 |
| --- | --- | --- |
| 1 | 小尺寸糊 | 32px 下「K」由 4 类形状拼成（青色圆头竖条 / 白斜条 / 白折线 / 琥珀折线） |
| 2 | 色彩与形状过多 | 4 色 + 网格线；16–32px 变噪点 |
| 3 | 尺寸档位自相矛盾 | `icons/128x128@2x.png` 内容占 82%（合规留白）；`icons/32x32.png` alpha 全出血 100% |
| 4 | 托盘无 @2x、运行时缩放 | `menu.ts:217-244` 单张 128px → `resize(22/32)` 后再 `setTemplateImage(true)` |
| 5 | 托盘图形过密 | 折线横穿 K 的干支与两臂，交叉处形成 3 个细碎尖角 |
| 6 | 开发态 Dock 被降级 | `main.ts:119-132` 用 256px PNG 覆盖图标（打包态 AppKit 用含 1024 的 .icns） |
| 7 | 无矢量源 | `grep iconutil/sips/rsvg scripts/ apps/desktop/scripts/ build-release.sh .github/` 无匹配 |

实测补充：`icon.icns` 含 11 档（含 1024/512/256 及 @2x）覆盖完整；`icon.ico` 含 6 档
（16/32/48/64/128/256，**缺 24**）；`icons/` 只有 32/128/128@2x，**缺 Linux 用的 `icon.png`**。

## 3. 选型结论

在 5 个方向（A 一笔 K / B 蜡烛 K / C 实色场 K / D 数据地平线 / E 麒麟印章）中选定，
并采用**双品牌**与**篆书**。**按尺寸分形制**（不是一张图打天下）：

| 档位 | 用在哪 | 图形 | 品牌归属 |
| --- | --- | --- | --- |
| **Tier 1** ≥256px | Dock / 启动台 / 关于页 / 安装器 / 物料 | **DB1 印下字标**：朱红白文方印（篆书「麒麟」**横排，右麒左麟**）+ 底部 `KSTOCK` 字标 | 麒麟 + KStock |
| **Tier 1b** 128 / 64px | Dock 小档 / 窗口图标 / 文件图标 | 同一朱印，**去掉字标**并居中放大（`e1-side-zhuan`） | 麒麟 |
| **Tier 2** 48 / 32 / 24 / 16px | Windows 任务栏 / 通知 / 列表 | **C2 深绿实色场 K**（16 / 24 用加重笔画版） | KStock |
| **Tier 3** 菜单栏 16pt | 系统托盘（单色模板图） | **印章外框 + K** | KStock（保留印章形制） |

已确认的设计决定（用户口径）：

1. Tier 1 版式 = **DB1 印下字标**；**去掉右下角绿 K 印**（观感不佳）。
2. 篆书「麒麟」**横排、右麒左麟**（篆印自右向左读），顺序不变。
3. 篆书字形**直接使用** Wikimedia Commons 的小篆字形（产品**不商用**，见 §3.2）。

### 3.1 为什么必须分档（实测约束，不是设计偷懒）

「麒麟」两字与 `KSTOCK` 字标都在小尺寸下失效，由以下实测约束决定：

1. **笔画数**：「麟」23 画。16pt 下一个字约 12–16px 见方，平均每画 < 0.7px，物理不可读。
2. **字标可读性**（实测裁剪）：`KSTOCK` 在 1024 图标里占 272×55px（清晰）→ 256px 时 136×27px（清晰）
   → 128px 时 68×13px（**已成一条糊线**）→ 64px 时 34×7px（噪点）。故 **<256px 必须去字标**。
3. **排版（已实测修正）**：先前判断「方框印内 2 字只能竖排」是**错的**——那是楷书/黑体方字的经验。
   小篆字形本身瘦长，实测墨迹宽高比 **0.644（麒）/ 0.675（麟）**，方印里**横排才填得满印面**；
   竖排反而两侧留白一大片。

### 3.2 篆书字形来源与授权（已核实并作出决定）

| 来源 | 覆盖 麒/麟 | 授权 | 可得性（实测） |
| --- | --- | --- | --- |
| 霞鹜篆书 LXGW Seal | ❌ | SIL OFL 1.1 | 可下载，但字表实测不含麒/麟，作者明确不再大扩 |
| 全字库说文解字（CNS11643 篆体） | ✅ | 政府资料开放授权 | 官方下载页失效、moedict 镜像 404、Wayback 逾时 |
| 方正小篆体 / 汉仪篆书 | ✅ | 字库商业授权 | 网上副本未授权，**不可用于产品** |
| 崇羲篆体（中研院小学堂） | ✅ | CC BY-ND 3.0（禁止改作） | 转轮廓属改作，需先获作者同意 |
| 北师大说文小篆 / 华瑞小篆体 | ✅ | 授权不明 | 风险不可控 |
| **Wikimedia Commons「<字>-seal.svg」** | ✅ | Commons 自由授权 | **已采用**：`glyphs/qi-seal.svg`、`glyphs/lin-seal.svg` |
| 自绘 / 委托自有轮廓 | ✅ | 完全自有 | 未来可选升级（见下） |

**决定（用户 2026-09-20）**：直接使用 Commons 的两个小篆字形，依据是**产品不商用**。
字形来源页、下载直链与授权状态记录在 [`glyphs/README.md`](../design/icon-refresh/glyphs/README.md)。

> **触发条件（必须遵守）**：若 KStock 将来转为商业用途 / 收费发行 / 用于商业宣传，
> 必须重新评估该字形授权（打开两个 Commons 文件页确认协议），或改为自绘 / 委托自有轮廓。
> 该条件同时写入 `glyphs/README.md`，便于后续接手者发现。

两字结构已人工核对：均从「鹿」部，右旁分别为「其」（麒）与「粦」（麟），与《说文》篆形一致。

**未来可选升级**（不阻塞实施）：自绘 / 委托自有轮廓，好处是能针对 16–64px 做笔画简化与配重，
并把授权风险彻底归零。

## 4. 图形规范（可直接实现）

统一几何基准（macOS 图标网格）：**1024 画布 / 内容区 824（内缩 100）/ 连续曲率圆角**
（超椭圆 `|x/a|^5 + |y/a|^5 = 1` 采样，`a = 412`，中心 512）。全部档位共用该轮廓。

### 4.1 Tier 1 · DB1 印下字标（定稿，1024 画布）

底色：squircle 填墨底渐变 `#0d1a16 → #030d0b`（自上而下），内缘描边 `#ffffff` 10%、宽 2.5。

- **朱红白文方印**：620×620 @ (202,130)。
  - 印面：`rect` 圆角 `0.072×620 = 44.6`，填 `#d94436 → #b02f22`（渐变 (0.2,0)→(0.8,1)）。
  - 印边：内缩 `0.042×620 = 26`，圆角 `0.058×568 = 32.9`，描边 `0.026×620 = 16.1`，
    色 `#fff8f2`、不透明度 0.95。
  - 印文：篆书「麒」「麟」**横排，右麒左麟**；字形定标见 §4.1.1。
- **KSTOCK 字标**：`Avenir` 900、`font-size 90`、字距 22、居中字心 y=846。
  - 颜色二选一（**待用户定**）：宣纸白 `#fff8f2`（与印文同色，克制）或品牌绿 `#31c7a2`
    （把产品色带回 Tier 1，与 Tier 2/3 同色）。两版均已出图。
- 实测：字标在 1024 里 272×55px、256 里 136×27px（均清晰），与印面间距 53px；下缘距 squircle 边界 ≥26px。

#### 4.1.1 篆书字形的实体化与定标（实现要点）

源字形是《说文》小篆的**双钩（空心描边）**轮廓，直接使用会在 256px 以下消失。处理方式：

1. **实体化**：以同色 `stroke` 补厚，宽度 `3.2`（源坐标系 300 单位制）——实测该值使双钩笔画闭合为实笔。
2. **定标**：渲染字形至 3000px（10×）后用 alpha 包围盒测量真实墨迹，换算回源坐标，再按目标框
   等比缩放居中。实测墨迹包围盒：麒 (63.8,12.4)–(243.3,291.3)、麟 (54.0,7.7)–(246.0,292.3)；
   宽高比 0.644 / 0.675（**这是「必须横排」的量化依据**）。
3. **横排参数**：印边内缘再内缩 `0.026S`；两字各占 `(内缘宽 - 0.02S)/2`、满高；右位放「麒」。

### 4.2 Tier 1b · 无字标朱印（128 / 64px 专用）

同一套印面参数，去掉字标并把 620 方印在画布居中（@ (202,202)），即 `generate_zhuan.py`
的 `e1-side-zhuan`。依据 §3.1 第 2 条：128px 时字标只有 68×13px，已不可读。

### 4.3 Tier 2 · C2 深绿实色场 K（1024 画布）

- 场色：squircle 填线性渐变 `#1e9a79 → #14775e(55%) → #0c5a45`，方向 (0.12,0)→(0.88,1)。
- 受光：径向渐变 `#ffffff` 不透明度 0.05 → 0.015(55%) → 0，圆心 (0.28,0.16)、半径 0.92×内容区。
- 字形：白色几何 K、**平口**、描边 96：`M368 272 V752`、`M368 512 L652 272`、`M368 512 L652 752`。
- 内缘高光：同 §4.1。
- 对比度实测：白字 vs 场色 2.96:1（最亮处）～ 8.08:1（最暗处），全图 ≈3:1。
- **16 / 24px 用加重版**：描边由 96 提到 112（光学配重 +17%），否则小像素下笔画发灰。

### 4.4 Tier 3 · 托盘模板图（32 画布 = 16pt@2x，纯黑 + alpha）

- 印边框：`M6.4 3 H25.6 A3.4 3.4 0 0 1 29 6.4 V25.6 A3.4 3.4 0 0 1 25.6 29 H6.4
  A3.4 3.4 0 0 1 3 25.6 V6.4 A3.4 3.4 0 0 1 6.4 3 Z`，描边 2.4，无填充。
- K：描边 3、圆头：`M11.4 8.6 V23.4`、`M11.4 16 L21 8.6`、`M11.4 16 L21 23.4`。
- 安全区：图形范围 3..29（四周 3px = 1.5pt）。
- 模板图铁律：**仅纯黑 #000000 + alpha**，不得有灰度或彩色；不含渐变、投影、<1.5pt 的线与 <2pt 的点。

## 5. 资产矩阵（现状 → 目标）

| 用途 | 现状 | 目标 |
| --- | --- | --- |
| macOS App / Dock | `build/icon.icns`（11 档，含 1024，覆盖完整） | 由 §4.1 / §4.2 / §4.3 按档出图 → iconset → `iconutil` 生成 `build/icon.icns` |
| macOS 菜单栏托盘 | `build/tray.png` 单张 128px，运行时 `resize(22)` | `build/trayTemplate.png`(16) + `build/trayTemplate@2x.png`(32)，不缩放 |
| Windows 窗口 / 任务栏 | `icons/32x32.png`（全出血） | `icons/` 齐 16/24/32/48/64/128/256/512/1024，统一 824/1024 留白与圆角 |
| Windows 托盘 | 回落用彩色全出血 `icons/32x32.png` | `build/tray.ico`（16/20/24/32）或 `build/tray-16.png` + `tray-32.png`（彩色） |
| Windows 安装器 | `build/icon.ico` 6 档（缺 24） | 7 档：16/24/32/48/64/128/256（256 用 PNG 压层） |
| Linux | `icons/` 仅 32/128/128@2x | 齐 16→1024 + `icon.png`(512) |
| 矢量真源 | 无 | **已建**：`scripts/build-icons.sh` → `docs/design/icon-refresh/build_assets.py`，逐档取形制出图并跑断言 |

**已实施（2026-09-20）**：`bash scripts/build-icons.sh` 一次产出
`icon.icns`（11 项含 ic10/1024）、`icon.ico`（7 档含 24，逐档取形制）、`icons/` 10 档 + `icon.png`、
`trayTemplate.png` + `@2x`、彩色 `tray.ico` + `tray-16/20/24/32.png`；旧的 `build/tray.png` 已删除。
断言全部通过：留白一致（16px 因抗锯齿放宽到 90%）、模板图纯黑且有实心核、icns 含 1024、ico 7 档、字标分档正确。

## 6. 代码改动

1. `apps/desktop/electron/lib/menu.ts` `createTrayImage()` —— **已实施**
   - macOS：读 `build/trayTemplate.png`（Electron 自动合并 `@2x`），**删除 `.resize()`** 与单文件回落链。
   - Windows/Linux：读彩色 `build/tray-16.png` / `tray-32.png`（或 `tray.ico`）。
   - 保留 `setTemplateImage(true)`（macOS）与现有日志。
2. `apps/desktop/electron/lib/window.ts` `resolveWindowIcon()` —— **已实施**
   - 候选顺序改为 `icons/256x256.png` → `icons/128x128.png` → `icons/32x32.png`。
3. `apps/desktop/electron/main.ts` `setDockIcon()` —— **已实施**
   - 维持「仅 `!app.isPackaged` 时设置」，补注释说明打包态必须由 `.icns` 提供。
4. `apps/desktop/electron-builder.yml`（files 段）—— **已实施**
   - `files` 增补 `build/trayTemplate*.png`、`build/tray*.png` / `tray.ico`；各平台 `icon` 路径随新资产同步。
5. `kstock/client-brand/src/client/Marks.tsx` + `src/client/marks/geometry.ts` —— **已实施**
   - 三处商标（`sidebar.brand.mark` 24px / `conversation.hero.brand.mark` 34px /
     `settings.about.mark` 72px）与应用图标**同源**，按 `SEAL_MIN_SIZE = 48` 切形制：
     - `size >= 48` → `SEAL_ON_INK`：墨底 squircle + 内嵌朱印（= 应用图标 Tier 1b）
     - `size <  48` → `SEAL_FULL`：朱印**直填满**徽标
     两者都是朱红白文印 + 篆书「麒麟」横排（右麒左麟）。
   - **为什么不沿用「品牌绿场 K」**：它在 24px 下与 1.x 旧徽标（同为绿底白 K）几乎无法区分，
     用户实测反馈「顶部商标没换过来」（像素级复核证实新标记已生效，只是观感未变）。
     绿场 K 仍是**应用图标** 16–48px 档的形制（见 §4.3 与 `build_assets.py`），只是不再用于 UI。
   - 几何常量由 `docs/design/icon-refresh/gen_client_marks.py` 从设计源生成，**禁止手改**；
     篆书路径**只存一份**（`GLYPH_PATHS`，两种形制共用放置变换），1 位小数压缩后 11.3KB；
     `lib/client.cjs` 42.4KB（gzip 15.7KB）。若不做去重会白涨到 53.7KB。
   - **验证**：组件级渲染（`react-dom/server`）与生成器镜像
     **24 / 34px 逐像素完全一致（最大通道差 0）**；72px 最大差 2；
     与 B2 设计稿零显著差异像素。`tsc --noEmit` 改动文件零报错。
   - 改动后需 `pnpm -C kstock/client-brand build` 更新 `lib/*`（入库产物）。

6. `scripts/build-icons.sh` **已建**；图标断言已落在 `build_assets.py`（下一步可挂进 `check-ci.sh` 的 `--check` 模式）：
   尺寸齐全、命名正确（`trayTemplate.png` / `@2x`）、`ico` 含 7 档、icns 含 1024。

## 7. 待决项

已定：Tier 1 = DB1 篆书横排朱印 + **KSTOCK 品牌绿字标**（用户 2026-09-20 决定）；
去掉绿 K 印；篆书字形直接使用（产品不商用）；托盘使用拉丁 K；Tier 2 = C2、Tier 3 = 印章框 + K；
生产资产已生成，Electron 四处代码已改。

仍需处理：

1. **推送**：本轮共 6 个本地提交（设计与瘦身 + UI 商标 + 生产资产与 Electron 改动），
   尚未推送；`main` 是共享分支且有发布流水线，需用户确认后再推。
2. **打包视觉验收**（§8 第 10 条）：需要真实构建产物上的截图——Dock、菜单栏（浅/深）、
   任务栏托盘、安装器图标。本机可直接 `pnpm dev:desktop` 或 `scripts/build-desktop.sh`。
3. ~~（可选）把 `build_assets.py --check` 挂进 `scripts/check-ci.sh`~~ —— **已做**：
   图标校验已成为 CI 门禁的一步（`scripts/check-ci.sh` 里紧接技能包校验之后）。

> **手动打包的注意事项（本轮实测踩到）**：`dist-exe/plugins/` 是 `build-engine-bundle.sh`
> 产出的**快照**，打包态 App 从 `resources/engine/plugins` 加载插件，因此
> **任何插件改动都必须先重建引擎束再打包**，否则会带上旧插件（实测 10 个插件里 6 个漂移，
> 含 `client-brand` → 打包态侧栏会显示旧商标）。
> 正式发布安全：`scripts/check-release.sh` 的顺序是
> `check-ci → build-engine-bundle → verify_package_resources → build-desktop` ✓；
> 直接跑 `build-desktop.sh`（或手动 electron-builder）则**不会**重建，需自行先跑引擎束。

## 8. 验收标准与验收记录

### 8.1 标准

1. `bash scripts/build-icons.sh` 可在干净环境一次性重出全部资产，重复执行结果幂等（字节级稳定）。
2. 资产齐全：`icon.icns`（11 项含 ic10/1024）、`icon.ico`（7 档含 24）、`icons/` 16→1024 + `icon.png`、
   `trayTemplate.png` + `trayTemplate@2x.png`、彩色托盘（`tray.ico` + `tray-16/20/24/32.png`）。
3. **留白一致**：`icons/` 全部 PNG 的 alpha bbox 内容占比 80.5%±（16px 因抗锯齿放宽到 ≤90%）。
4. **托盘质量**：模板图非透明像素 **RGB 必须纯黑**（alpha 允许抗锯齿过渡）且存在不透明实心核；
   浅色（#ececec）与深色（#1c1c1e）菜单栏上与系统图标并排目视等重。
5. **逐尺寸形制正确**：1024/512/256 带字标；64/128 无字标且印章居中放大；48/32/24/16 用 Tier 2（16/24 加重）。
6. **字标阈值**：256px 下 `KSTOCK` 在 1:1 下可读（≥136×27px）；128px 起不得出现字标。
7. **小尺寸可辨**：32px 下 Tier 2 的 K、Tier 3 的「框 + K」均可辨。
8. **对比度**：Tier 2 白字 vs 场色全图 ≥ 2.9:1；Tier 1 印文（`#fff8f2`）vs 印面朱红 ≥ 4:1。
9. **字形来源可追溯**：产物可追到字形来源与授权依据（`glyphs/README.md` 含来源页、直链与转商用触发条件）。
10. **视觉验收**：Dock、macOS 菜单栏（浅/深）、Windows 任务栏与托盘、安装器图标逐项确认。
11. `bash scripts/check-ci.sh` 通过。

### 8.2 验收记录（2026-09-20）

| # | 条款 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 幂等 | ✅ | 两次 `build-icons.sh` 产物聚合哈希一致（`ab1da4bf…`） |
| 2 | 资产齐全 | ✅ | `icon.icns` 11 项含 `ic10`；`icon.ico` 7 档；`icons/` 10 档 + `icon.png`；`trayTemplate.png`+`@2x`；`tray.ico` + `tray-16/20/24/32.png` |
| 3 | 留白一致 | ✅ | `build_assets.py verify()` 断言通过 |
| 4 | 托盘质量 | ✅ | 断言通过（纯黑 + 实心核）；双底色对照见 `sheet-production-assets.png` |
| 5 | 逐尺寸形制 | ✅ | 断言 + 打包 asar 内逐档实测（`sheet-packaged-acceptance.png`） |
| 6 | 字标阈值 | ✅ | 断言抽查 256/512/1024 字标区非空；阈值实测见 `sheet-db1-marklegibility.png` |
| 7 | 小尺寸可辨 | ✅ | `sheet-production-assets.png` 16/24/32 档 |
| 8 | 对比度 | ✅ | Tier 2 实测 2.96:1～8.08:1 |
| 9 | 来源可追溯 | ✅ | `glyphs/README.md`（含「转商用需重新评估」触发条件） |
| 11 | CI | ✅ | `bash scripts/check-ci.sh` 全绿 |

**图标校验已进入 CI 门禁**：`scripts/check-ci.sh` 现调用
`scripts/python.sh docs/design/icon-refresh/build_assets.py --check`，分三层：

| 层 | 内容 | 依赖 | CI 是否执行 |
| --- | --- | --- | --- |
| 结构 | 文件齐全、逐档像素尺寸（读 PNG IHDR）、icns 含 ic10、ico 七档、托盘模板图源仅纯黑、256 档字标非空 | 纯标准库 | ✅ 总是 |
| 像素 | 留白占比 80.5%±、模板图逐像素纯黑且有实心核、字标区非空 | Pillow | 有则跑 |
| 漂移 | 从设计源重渲染全部 `icons/` 档并与入库产物**逐字节**比对 | rsvg-convert | 有则跑 |

CI 矩阵（ubuntu/macos/windows）不装第三方依赖，因此第一层必须是纯标准库（Pillow 改为惰性导入）；
后两层在本机与后续加装依赖的环境自动生效。**负向测试已验**：改错尺寸、删 ico 档位、
改设计源不重出资产三种情况都能被抓到并返回非零。

**打包验收（electron-builder，macOS arm64，未签名 `--dir`）**

- `KStock.app/Contents/Resources/icon.icns` 与设计产物**哈希一致**（`37c57b7b…`）→ 打包链路确实注入了新图标。
- `app.asar` 内含全部 17 个图标资产，路径与代码读取一致：
  `build/trayTemplate.png`、`build/trayTemplate@2x.png`、`build/tray-16/20/24/32.png`、`build/tray.ico`、
  `build/icons/*.png`（16→1024）。
- **运行时日志（打包态实跑，取自主进程日志）**：
  ```
  packaged=true
  托盘图标加载：…/KStock.app/Contents/Resources/app.asar/build/trayTemplate.png
               size={"width":16,"height":16} isEmpty=false
  托盘已创建
  窗口 ready-to-show
  ```
  即新代码路径在**打包产物内**成立（旧实现此处会记录 `build/tray.png` 并 resize 到 22）。
- Electron 运行时探针（直接读 asar）：`trayTemplate.png` → 16×16 且 `reps=[1,2]`
  （**`@2x` 已被自动合并**）、彩色托盘 32/16、窗口图标 256、Dock 用 512。

**未完成项（明确记录，不含糊）**

- 第 10 条的**真实屏幕视觉验收**只完成了一半：打包产物、asar 内容、运行时加载均已验证；
  但 **Dock 图标与菜单栏托盘的实际屏幕截图未能获取**——本机未向沙箱进程授予屏幕录制权限
  （`screencapture` 被拒）。需由用户目视确认，或在其机器上直接运行打包产物。
- Windows 任务栏 / 托盘 / 安装器图标**无法在本机验证**（无 Windows 环境）：
  当前证据为资产生成断言 + Electron 对各档尺寸的加载探针，真实外观需在 Windows 上确认。

**验收过程中的环境限制（踩坑记录，供后续复用）**

- `electron-builder` 默认要写 `~/Library/Caches/electron`，被本机文件沙箱拒绝（EPERM）；
  改用 `ELECTRON_CACHE` / `ELECTRON_BUILDER_CACHE` 指到工作区内，并用
  `--config.electronDist=<本地解包的 electron/dist>` 走**离线打包**（避免下载 Electron）。
- 打包态 App 实跑需重定向两处：`HOME`（引擎数据目录 `~/.kstock`）与
  `--user-data-dir`（Electron 的 userData 走 macOS 真实用户目录，**不认 `HOME`**，
  否则单例锁被拒后进程直接退出）。
- 隔离 HOME 会让引擎走**首次引导**（安装 py-deps 约 4.5 分钟后失败退出 code=1），
  这与图标改动无关；用户机器上已有 `~/.kstock`，不受此影响。

## 9. 交付物

- 生产图标资产（`apps/desktop/build/` 下全部图标文件，按 §4.1–§4.4 分档出图）
- 图标生成脚本 + CI 校验
- §6 的代码改动
- 验收截图（§8 第 10 条）
- 篆书字形来源与授权记录：`docs/design/icon-refresh/glyphs/README.md`（含触发条件）
