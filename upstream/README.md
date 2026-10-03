# upstream/ —— 引擎上游锚点

本目录存放 KStock 与 QiLin 引擎之间的**锚点与重放物**，不是引擎源码。

| 文件 | 作用 |
|---|---|
| `../upstream.lock.json` | 唯一事实源：fork 分支、锁定提交、基线 tag/commit、7 处产品补丁清单 |
| `patches/kstock-3.0.10.patch` | 同一提交序列的 mbox 导出（`git format-patch` 产物），供人工审阅与逐条重放 |
| `patches/kstock-3.0.10.bundle` | 同一提交序列的 `git bundle`（9.5 KB，带提交对象），分支未推送时**逐位重建**锁定提交 |

## 消费形态

引擎不再是 `vendor/qilin` 里的入库源码快照，而是 fork 分支的 git 克隆：

```bash
scripts/engine-bootstrap.sh            # 克隆/更新 + 契约校验
scripts/engine-bootstrap.sh --full     # 再追加 install + build + verify-runtime-closure
scripts/engine-bootstrap.sh --prune    # 删除克隆释放磁盘（约 3.5 GB）
```

`vendor/qilin` 已在 `.gitignore` 中整目录忽略（含 `.git` 与构建产物），
是**可弃的工作副本**：删掉不丢任何定制（7 个提交在 fork 分支与
`patches/*.bundle` 里），下次构建或跑门禁时重新引导。

## 分支未推送时（或克隆被删后）的重建

```bash
git clone --single-branch https://github.com/kkutysllb/QiLin.git vendor/qilin
git -C vendor/qilin fetch upstream/patches/kstock-3.0.10.bundle \
  refs/heads/kstock/3.0.10:refs/heads/kstock/3.0.10
git -C vendor/qilin checkout kstock/3.0.10
scripts/engine-bootstrap.sh --check-only
```

`engine-bootstrap.sh` 的克隆失败路径已内建这套兜底（先试分支、再试 bundle）。
`git am patches/kstock-3.0.10.patch` 只作最后兜底：mbox 不带 committer 时间，
重建的提交号会变，契约断言 2 会红。

完整工作流、升级步骤与失败处置见 `../docs/引擎分支工作流.md`。
