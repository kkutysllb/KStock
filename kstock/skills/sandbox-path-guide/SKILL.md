---
name: sandbox-path-guide
description: |
  工作区路径纪律与 bash 命令路径规范（2.0 / QiLin 3.x 沙箱）。任何要在沙箱内
  执行 bash、读写文件的任务都应遵循：写操作只落工作区（当前会话工作目录）
  内；技能经 skill 工具加载后按加载结果给出的基目录执行（相对路径按基目录
  解析，技能目录只读）；禁止探查宿主系统路径（会被沙箱拒绝并浪费一次
  工具调用）。
version: 2.1.0
author: kk-quant
license: MIT
category: environment

package:
  type: knowledge-only

permissions:
  filesystem: true
  shell: true
---

# 工作区路径纪律（2.0 沙箱）

## 沙箱模式与写边界

bash 在进程沙箱内执行，文件效果按模式约束：

| 模式 | 允许写入 |
|------|----------|
| workspace-write（常规） | 工作区根（= 当前会话工作目录）及其子路径、沙箱临时区 |
| read-only | 禁止写入（仅 `/dev/null` 等必需出口） |

1. 工作区根就是当前工作目录：一切产物写在工作区内，优先用相对路径，
   并按下节「工作区目录布局」分区，**不要把中间产物堆在工作区根下**；
2. 长耗时命令（全样本回测、大批量数据拉取）用 bash 的 `run_in_background`
   后台化后经 jobs 收集，不要 `nohup` + `sleep/tail` 轮询。

## 工作区目录布局（产物分区）

产物按类型分三个目录，首个产物落盘前按需创建（`mkdir -p scripts data
reports` 一次建齐亦可）：

| 目录 | 放什么 |
|------|--------|
| `scripts/` | 任务执行中**自建的临时脚本**（数据加工、图表辅助、一次性验证脚本等） |
| `data/` | **引擎输出与中间数据**（联动/期指等引擎的 JSON、下载的 CSV、加工半成品） |
| `reports/` | **报告产物**（report.json 与渲染后的 HTML 看板） |

- 引擎命令一律**从工作区根执行**、输出用相对路径写进 `data/`：
  脚本式引擎直接用「`<引擎基目录>/scripts/...` 全路径 + `> data/xxx.json`
  重定向」；模块式引擎（`python3 -m xxx`）用 `PYTHONPATH="<引擎基目录>"`
  免 cd，`-o data/xxx.json` 相对工作区落盘（各场景技能的命令模板已按此
  写好，照抄即可）；
- 不要 cd 进技能目录再执行——那会把输出写进只读的技能目录或散落各处；
- 最终交付 `present` 的是 `reports/` 下的 HTML；报告库归档口
  （`POST /kstock-api/reports`）读取的也是 `reports/` 下的 report.json
  与 HTML（见 html-report 技能）。

## 技能目录（只读参考，路径由加载结果给出）

- 技能经 `skill` 工具加载后，加载结果自带基目录提示
  （`Base directory for this skill: <绝对路径>`）：**技能文档中的相对路径
  （`scripts/`、`references/` 等）一律按该基目录解析**，例如文档写
  `cd scripts && python3 cli.py …` 即在基目录下执行；
- 上游技能文档可能残留旧引擎的绝对路径（`/mnt/skills/...` 等）——这些路径
  已失效，**以加载结果给出的基目录为准**，把文档中的相对子路径映射到
  基目录下执行；
- 技能目录在工作区写边界之外（只读）：不要把产物写进技能目录，产物一律
  写回当前工作区；
- 如脚本文档要求安装技能内依赖，不要 `pip install -e <技能目录>`（需要写入
  技能目录，会被沙箱拒绝）；改用 `pip install --target ./pylibs …` 装进
  工作区并以 `PYTHONPATH=./pylibs` 运行；依赖缺失且无法安装时按脚本的
  软降级口径处理并如实标注。

## 交付物

- 最终交付物按「工作区目录布局」归位（HTML 看板在 `reports/`），用
  `present` 呈现；
- HTML 研究报告另按 html-report 技能渲染，并经报告库入库口归档
  （`POST /kstock-api/reports`）。

## 禁止用法

```bash
# ❌ 探查宿主系统路径（沙箱拒绝，浪费一次工具调用）
ls /
cat /etc/passwd
ls /Users

# ✅ 一切从当前工作目录出发
ls
find . -name "*.html"
```

- 命令被沙箱拒绝时，按报错把路径改回工作区内重试；不要换着花样反复
  尝试同类越界路径；
- 旧版虚拟路径（`/mnt/user-data`、`/mnt/skills`、`/mnt/acp-workspace` 等）
  在 2.0 已不存在；技能文档中遇到此类旧绝对路径，一律以 `skill` 工具加载
  结果给出的基目录为准。
