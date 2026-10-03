# upstream/ —— 引擎上游锚点

本目录存放 KStock 与 QiLin 引擎之间的**锚点与重放物**，不是引擎源码。

| 文件 | 作用 |
|---|---|
| `../upstream.lock.json` | 唯一事实源：fork 分支、锁定提交、基线 tag/commit、7 处产品补丁清单 |
| `patches/kstock-3.0.7.patch` | 同一提交序列的 mbox 导出（`git format-patch` 产物），供离线重建与人工审阅 |

## 消费形态

引擎不再是 `vendor/qilin` 里的入库源码快照，而是 fork 分支的 git 克隆：

```bash
scripts/engine-bootstrap.sh            # 克隆/更新 + 契约校验
scripts/engine-bootstrap.sh --full     # 再追加 install + build + verify-runtime-closure
```

`vendor/qilin` 已在 `.gitignore` 中整目录忽略（含 `.git` 与构建产物）。

## 分支未推送时的离线重建

```bash
git init vendor/qilin
git -C vendor/qilin remote add origin /Users/libing/kk_Projects/QiLin
git -C vendor/qilin fetch origin v3.0.7 kstock/3.0.7
git -C vendor/qilin checkout f91c39f6438a56045e4622f97767fcc1ec7a5d38
git -C vendor/qilin am upstream/patches/kstock-3.0.7.patch
scripts/engine-bootstrap.sh --check-only
```

完整工作流、升级步骤与失败处置见 `../docs/引擎分支工作流.md`。
