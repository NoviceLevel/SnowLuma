# 纯业务功能索引

以下符号均在 `index.business.mjs`。这里只索引 QQPet 功能，不包含卡密、授权、远程资源门禁和完整性校验。

## 配置和进度

- `DEFAULT_CONFIG_VALUES`：全部托管配置默认值
- `normalizeConfig`：配置迁移、类型过滤和范围限制
- `ProgressStore`：每日计数、待结算任务、PK、访问去重、属性基线和钱袋连续未掉计数

## QQPet 协议

- `READ_PACKETS`：只读 OIDB 命令表
- `DEFAULT_MUTATION_PACKETS`：业务写操作 OIDB 命令表
- `QQPetApi`：全部协议请求和 protobuf 响应解码
- `queryOutdoorRecords`：服务器出门记录，详见 `OUTDOOR-HISTORY-PROTOCOL.md`
- `queryPetFriendRecords` / `queryPetFriendDirectory`：好友和同玩目录
- `queryStompStatus` / `stompOther`：踩踩
- `encourageSchool`：学习鼓励
- `queryPkPower` / `startPk` / `settlePk`：PK
- `startAdventure`：普通冒险、快速钱袋预告刷新

## 自动化策略

- `isRestPeriodActive`：支持跨午夜的休息时段
- `updateAdventureMoneyBagStreak` / `shouldPauseAdventureForNoMoneyBag`：连续无钱袋暂停
- `AutomationController.findEmployableFriend`：指定 QQ / 自动候选打工
- `AutomationController.maybeVisit`：好友、陌生人、自动照顾和踩踩
- `AutomationController.maybePk`：PK 候选和战力筛选
- `AutomationController.maybeEncourageSchool`：学习任务鼓励
- `AutomationController.handleStory`：任务确认、结算和计数
- `AutomationController.runOnce`：单轮决策主流程

插件状态壳层和本地 Web API 没有放进纯业务提取版；后续移植时应继续复用 Miku 现有的状态与 API 实现。
