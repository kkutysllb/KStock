# @kstock/accounts-local

KStock 本地账户面插件 —— fork 自上游 `@qilin/accounts-local` 3.0.0（MIT，
`vendor/qilin/packages/identity/accounts-local`），叠加 **KStock 1.x 账户迁移**。

## 为什么 fork

1.x（Python gateway）与 3.x 的账户体系完全不兼容：

| | 1.x | 3.x（本包叠加前） |
| --- | --- | --- |
| 存储 | 旧引擎 SQLite `users` 表（`qilin.db`） | `$QILIN_HOME/auth/accounts.json` |
| 口令哈希 | bcrypt（`$dfv2$` = bcrypt(b64(sha256(pw)))，`$dfv1$`/裸 bcrypt = bcrypt(pw)） | scrypt（`scrypt$N$r$p$salt$key`） |
| 登录标识 | 邮箱 | 用户名或邮箱 |

不能通过外部写 `accounts.json` 完成迁移：引擎内的 `AccountStore` 打开后
以内存为准，任何外部写入都会被下一次 commit 覆盖；而 bcrypt 哈希没有
明文无法重算成 scrypt。因此把账户面整体换成 KStock 自己的插件，在同一条
`accounts` 线上原位替换（`cordis.patch.yml` 整行替换，`name` 指向本包）。

## 叠加行为（其余与上游逐字一致）

- **启动导入**：账户文件为空时，从 1.x 旧库（只读）导入全部可登录账户
  （bcrypt 哈希原样入库）。升级用户由此看到登录页而非首启初始化页。
- **按需导入**：登录标识在账户文件未命中时回退查 1.x 旧库，bcrypt 校验
  通过即入账（提交的密码直接存为 scrypt，口令原样延续）。
- **透明升级**：以 bcrypt 哈希登录成功后，账户记录原位升级为 scrypt；
  修改密码走上游逻辑，自然产出 scrypt。
- 旧库定位：`KSTOCK_LEGACY_ACCOUNTS_DB`（测试覆盖）→
  `~/.kstock/config/qilin.runtime.yaml` 的 `database.sqlite_dir` →
  `~/.kstock/runtime/qilin/data/qilin.db`。只读打开，失败时把主库文件
  拷贝到临时目录再开；绝不写旧库。找不到旧库 = 全新安装，安静跳过。

## 与上游的差异清单（同步 vendor 时对照）

- `src/kylin.ts`：新增——上游 `@qilin/*` 类型的本地结构拷贝（本包独立打包，
  不依赖 `@qilin/*` 运行时解析）。
- `src/vendor/atomic-write.ts`：上游 `@qilin/atomic-write` 逐字拷贝。
- `src/vendor/home-paths.ts`：上游 `@qilin/home-paths` 子集逐字拷贝。
- `src/password.ts`：新增 `isLegacyPasswordHash` / `verifyLegacyPassword`
  （bcryptjs）；`verifyPassword` 先识别 1.x 哈希再走 scrypt。
- `src/accounts.ts`：新增 `AccountStore.addImported`（按已编码哈希入库）。
- `src/legacy.ts`：新增——1.x 旧库发现与只读读取。
- `src/routes.ts`：登录端点加两段迁移分支（已知导入账户的透明升级、
  未知标识的按需导入）；其余端点逐字一致。
- `src/index.ts`：`@deepseek-ai/schemastery` 校验改为等价手写默认值；
  会话密钥的 credential key 为同名常量字符串；apply 开头先开 store 并
  执行空库导入；其余逐字一致。
- `src/{paths,validation,json,session,gate}.ts`：仅类型导入本地化，逻辑逐字一致。

## 开发

```bash
pnpm build   # tsdown → lib/index.js（全量内联，含 bcryptjs）
pnpm test    # node --test
```
