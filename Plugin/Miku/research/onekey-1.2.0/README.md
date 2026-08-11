# OneKey QQPet 1.2.0 逆向产物

本目录用于审计 `onekey1.2.0/data/components/QQPet/index.mjs`。下载目录中的原发布文件未修改。

## 交付文件

- `index.business.mjs`：从完整明文中提取的纯 QQPet 业务源码，不含卡密、授权、远程资源门禁、Native 校验和卡密存储。
- `OUTDOOR-HISTORY-PROTOCOL.md`：出门记录协议审计与当前 Miku 故障根因。
- `BUSINESS-FEATURE-INDEX.md`：纯业务功能入口索引，主动排除卡密和远程门禁。

完整自动基线、完整明文和可复现 AST 工具仅保留在本地审计目录 `tmp-onekey-deob`，不作为业务源码提交。

## 完整性

- 原始 SHA-256：`041cd47594d61d1c23abb70a3a5569dfed65f2e67c63739f3d5ef8ec3e7a1e88`
- 混淆器标记：`javascript-obfuscator-5`
- 自动去混淆统计：prepare 836、对象属性内联 265、decoder wrapper 4808、字符串解码 4527、控制流/死代码 1454、transpile/unminify 17455。
- 完整 `index.readable.mjs` 和纯业务 `index.business.mjs` 均已通过 Node 22 `--check`。
- 自动基线与可读版的 AST 结构对比为 `equivalent: true`；字符串、数字、正则、属性、方法和 import 均为 0 差异。
- 纯业务版经过禁止关键词扫描，卡密、授权、远程资源、Native capability、`data.env` 等发布保护系统均未进入文件。

## 功能边界

纯 QQPet 业务逻辑主要位于：

1. `ProgressStore`
2. protobuf/OIDB 编解码函数和 `QQPetApi`
3. 自动化策略函数和 `AutomationController`

以下模块只存在于本地完整逆向审计副本，不属于提交的业务源码：

- `LicenseManager`、授权网络请求、Native capability 调用
- 卡密格式、`data.env` 卡密写入
- `WebResourceManager`、远程网页资源和公告门禁
- Native 核心哈希完整性校验

`index.business.mjs` 没有接入、绕过或包含这些商业保护模块；写操作通过外部 `executeMutation` 执行器注入，业务 OIDB 映射使用已逆出的 `DEFAULT_MUTATION_PACKETS`。
