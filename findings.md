# 发现记录

## 当前仓库

- `KStock` 当前几乎是空仓库。
- 现有跟踪文件只有 `README.md` 和 git 元数据。

## 本地源仓库

- 本地镜像仓库位于 `/Users/libing/kk_Projects/QiLin` 和 `/Users/libing/kk_Projects/KSkills`。
- 两个镜像都在 `main` 分支，并跟踪 `origin/main`。
- 这让 KStock 可以把它们当作源输入，而不是修改源仓库本身。

## QiLin

- 公共仓库：`kkutysllb/QiLin`。
- QiLin 是一个生产级 Python 智能体引擎。
- 它提供嵌入式 API、技能存储、技能安装、按用户隔离的技能空间、运行时技能 CRUD 等能力。
- QiLin 适合被当作产品壳外的本地引擎层。

## KSkills

- 公共仓库：`kkutysllb/KSkills`。
- KSkills 是一个技能包仓库，包含 coding、stock、media、research、common 五类。
- stock 目录里有大量适合量化研究、财报分析、估值、行业、公告、新闻、宏观的技能。
- coding 类技能更适合作为开发工具链，不适合直接进 V1 产品运行时。

## 产品含义

- KStock 的最佳形态是一个薄产品壳，而不是重新实现一套 agent runtime。
- V1 应该只加载精选的 stock + common 技能。
- 上游同步应通过本地镜像和锁定清单完成，避免污染上游。

