# KStock 图标 / 商标重构 · 设计源

提案看板（先看这个）：[`design-board.html`](./design-board.html)
设计 spec（决策与验收）：[`../../superpowers/specs/2026-09-20-kstock-icon-refresh-design.md`](../../superpowers/specs/2026-09-20-kstock-icon-refresh-design.md)

## 这个目录里什么入版本库

**跟踪**（源与交付物）：

| 路径 | 说明 |
| --- | --- |
| `*.py` | 设计源生成器（见下表），改图标就改这里 |
| `design-board.html` | 提案看板（引用下面这些对照图） |
| `glyphs/` | 篆书字形源 + **授权与触发条件**（必读） |
| `src/` `seal-src/` `dual-src/` `zhuan-src/` | 各方向的可编辑 SVG 源 |
| `current/` | 改造前的现状资产快照（看板里作为「现状」证据） |
| `sheet-*.png` `contact-sheet-256.png` | 关键对照图（人看的交付物） |
| `png/*-32.png` `png/*-512.png` `png/*-tray-16.png` | 看板直接引用的逐方向预览 |

**不跟踪**（逐尺寸渲染产物与临时目录，由脚本再生）：`png/` 下的其余尺寸、`seal-png/`、
`dual-png/`、`zhuan-png/`、`zhuan-tmp/`。规则见本目录 `.gitignore`。

## 重新生成

依赖：`rsvg-convert`（`brew install librsvg`）、Python 3 + Pillow。

```bash
cd <repo>
python3 docs/design/icon-refresh/generate.py           # 方向 A–D
python3 docs/design/icon-refresh/generate_seal.py      # 麒麟印章（黑体占位稿）
python3 docs/design/icon-refresh/generate_dual.py      # 双品牌三版式
python3 docs/design/icon-refresh/generate_zhuan.py      # ★ 篆书定稿（DB1 等）
python3 docs/design/icon-refresh/contact_sheets.py     # A–D 的小尺寸/托盘对照
python3 docs/design/icon-refresh/seal_sheets.py        # 印章对照
python3 docs/design/icon-refresh/gen_client_marks.py   # ★ 客户端商标几何常量 + 镜像校验图
python3 docs/design/icon-refresh/generate_uimarks.py   # UI 小尺寸商标候选（B0/B1/B2 选型用）
python3 docs/design/icon-refresh/gen_client_marks.py   # ★ 客户端商标几何常量 + 镜像校验图
```

## 校验（已进 CI 门禁）

```bash
python3 docs/design/icon-refresh/build_assets.py --check   # 结构层总是跑；有 Pillow/rsvg 时自动加跑像素层与漂移层
```

`scripts/check-ci.sh` 已调用该命令：CI 矩阵不装第三方依赖，所以结构层是纯标准库实现
（Pillow 惰性导入，缺依赖时打印跳过原因而不失败）；本机则三层全跑，
第三层能把「改了设计源却忘了重出资产」直接抓成 CI 失败。

`gen_client_marks.py` 会写入源码文件（`kstock/client-brand/src/client/marks/geometry.ts`），
改完后需重新构建客户端插件：

```bash
pnpm -C kstock/client-brand build      # 更新 lib/client.cjs（lib/ 是入库产物）
```

## 重要：插件改动必须先重建引擎束

打包态 App 从 `resources/engine/plugins`（由 `build-engine-bundle.sh` 打入 `dist-exe/`）
加载插件，`kstock/*/lib/` 的改**不会**自动进包。实测 `dist-exe/plugins/` 与仓库构建
存在漂移（10 个插件里 6 个），因此：

```bash
bash scripts/build-engine-bundle.sh   # 先重建引擎束（含插件快照）
bash scripts/build-desktop.sh         # 再打包
```

正式发布安全：`scripts/check-release.sh` 就是按这个顺序跑的；
但直接 `build-desktop.sh` 或手动 electron-builder **不会**重建，会带上旧插件。

## 落地为生产图标

见 spec §5 资产矩阵与 §8 验收标准。`scripts/build-icons.sh`（待建）将把上述脚本串成一条命令，
并产出 `icon.icns / icon.ico / icons/*.png / trayTemplate*.png` 与 CI 校验。
