# 「麒麟」小篆字形来源与授权状态

本目录存放设计稿使用的两个小篆字形（SVG，单 path）：

| 文件 | 对应今字 | 来源页面 | 下载直链 |
| --- | --- | --- | --- |
| `qi-seal.svg` | 麒 | <https://commons.wikimedia.org/wiki/File:麒-seal.svg> | `upload.wikimedia.org/wikipedia/commons/e/e1/麒-seal.svg` |
| `lin-seal.svg` | 麟 | <https://commons.wikimedia.org/wiki/File:麟-seal.svg> | `upload.wikimedia.org/wikipedia/commons/4/4e/麟-seal.svg` |

字形为《说文解字》小篆的描摹轮廓（Wikimedia Commons 的「<字>-seal.svg」系列，
Inkscape 描摹，单 path、双钩空心笔画）。两字结构已人工核对：均从「鹿」部，
右旁分别为「其」（麒）与「粦」（麟），与《说文》篆形一致。

## ⚠ 授权状态：待确认

- **尚未取到文件页的授权信息**：本机到 `commons.wikimedia.org` 的 API 连时通时断，
  `extmetadata` 未取到，SVG 内部也没有内嵌 `dc:rights` / `cc:license` 元数据。
- Commons 站内文件必须带自由授权（常见为 CC0 / PD-self / CC BY-SA），
  但**在落地为产品资产之前，必须打开上面两个文件页确认具体协议与署名要求**。
- 若协议含「禁止改作（ND）」或要求相同方式共享（SA），则不能改造为图标轮廓用于产品；
  此时按 spec §3.2 改走「自绘 / 委托自有轮廓」。

## 处理方式（见 `../generate_zhuan.py`）

原始笔画是**双钩（空心描边）**，直接放进图标会在 256px 以下消失。
脚本用「同色 `stroke` 补厚 3.2（源坐标 300 单位制）」把笔画实体化，
并通过渲染 10× 后测量真实墨迹包围盒来定标定位（不靠肉眼调参）。

落地为生产资产时，若确认授权可用，建议仍将字形**转成自有的简化轮廓**：
一是有利于 16–64px 的笔画简化，二是避免授权状态变化带来的风险。
