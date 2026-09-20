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
```

`gen_client_marks.py` 会写入源码文件（`kstock/client-brand/src/client/marks/geometry.ts`），
改完后需重新构建客户端插件：

```bash
pnpm -C kstock/client-brand build      # 更新 lib/client.cjs（lib/ 是入库产物）
```

## 落地为生产图标

见 spec §5 资产矩阵与 §8 验收标准。`scripts/build-icons.sh`（待建）将把上述脚本串成一条命令，
并产出 `icon.icns / icon.ico / icons/*.png / trayTemplate*.png` 与 CI 校验。
