---
name: sandbox-path-guide
description: 沙箱虚拟路径与 bash 命令路径安全规范。任何需要在沙箱内执行 bash 命令、读取或写入文件的任务都应遵循：本地沙箱只放行 /mnt/user-data、/mnt/skills、/mnt/acp-workspace 与自定义挂载路径，严禁执行 ls /、ls /mnt 等根目录探查命令（会被安全校验拒绝并浪费一次工具调用）。
version: 1.0.0
author: kk-quant
license: MIT
category: environment

package:
  type: knowledge-only

permissions:
  filesystem: true
  shell: true
---

# 沙箱路径规范（Sandbox Path Guide）

## 虚拟路径结构

沙箱内所有文件访问必须使用虚拟路径，执行时由沙箱自动映射到真实目录：

| 虚拟路径 | 内容 |
|---------|------|
| `/mnt/user-data/uploads` | 本次运行上传的文件 |
| `/mnt/user-data/workspace` | 临时工作目录（默认工作目录） |
| `/mnt/user-data/outputs` | 最终交付物目录 |
| `/mnt/skills/...` | 技能文件（只读） |
| `/mnt/acp-workspace/...` | ACP 子代理产出（只读） |
| 自定义挂载路径 | 由部署配置声明，仅在任务明确引用时使用 |

## 路径安全校验（本地沙箱）

本地沙箱启用宿主 bash 时，命令中的绝对路径会经过白名单校验：

- **放行**：`/mnt/user-data`、`/mnt/skills`、`/mnt/acp-workspace` 及子路径、自定义挂载容器路径、少量系统路径（`/bin`、`/dev/null` 等）。
- **拒绝**：裸 `/`、裸 `/mnt`、其他任意宿主绝对路径（如 `/Users`、`/etc/passwd`、`/tmp`）。
- 被拒绝时工具返回：`Unsafe absolute paths in command: <path>. Use paths under /mnt/user-data`。

## 正确用法

```bash
# ✅ 列目录：必须落到具体虚拟路径
ls /mnt/user-data
ls /mnt/user-data/workspace

# ✅ 访问文件：直接使用虚拟路径
read_file("/mnt/user-data/workspace/README.md")
find /mnt/user-data/outputs -name "*.html"

# ✅ 切换工作目录
cd /mnt/user-data/workspace
```

## 禁止用法

```bash
# ❌ 探查挂载根（会被安全校验拒绝，且浪费一次工具调用）
ls /
ls /mnt
cd /
find /mnt -name "*.py"

# ❌ 宿主绝对路径
cat /etc/passwd
ls /Users/xxx
```

## 要点

1. 需要了解目录结构时，直接 `ls /mnt/user-data/workspace` 或对应虚拟子路径，不要从 `/` 或 `/mnt` 逐级探查。
2. 脚本中尽量使用相对路径（默认工作目录为 `/mnt/user-data/workspace`）。
3. 最终交付物必须写入 `/mnt/user-data/outputs`。
