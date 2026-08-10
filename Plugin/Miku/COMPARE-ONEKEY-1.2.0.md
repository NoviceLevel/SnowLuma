# Miku 相对 OneKey QQPet 1.2.0 的缺失功能

> 只列 **OneKey 有、Miku 当前没有** 的项（不含卡密/远程资源等商业门禁）。

## 玩法

1. **学习鼓励** — 每个学习任务自动鼓励一次，领随机属性奖励（`schoolEncouragementEnabled`）
2. **走访后自动踩踩** — `visitStompEnabled`
3. **自动 PK**
   - 开关 / 只打战力更低
   - 好友 / 陌生人
   - 每日次数上限、候选扫描数
4. **快速冒险（只刷钱袋）** — 先看预告，仅「捡到金币」才开（`quickAdventureEnabled`）
5. **连续未掉钱袋则暂停当日冒险** — `adventureMoneyBagStopEnabled` + 次数阈值
6. ~~**出门记录**~~ — 已接入服务器 `outdoorHistory`（`0x9876_1`），换机/清本地不丢
7. **定时休息时段** — 起止时间，可跨午夜（`restPeriodEnabled` 等）
8. **打工指定好友 QQ 列表** — 按顺序选用可上岗好友（`workFriendUins`）

## 今日进度展示（对应缺失玩法）

- 学习鼓励次数  
- 踩踩次数  
- 好友 PK / 陌生人 PK 次数  
- 钱袋连续未掉次数  

## 配置差异（小项）

- 走访等待用 **秒**（OneKey） vs Miku 用 **分钟**（能力等价，单位不同）
- 配置 **一键恢复默认**（OneKey 有 `/api/config/reset`）

## 明确不列为「缺失玩法」

- 卡密授权 / license native  
- 远程网页资源与公告服务  
- 发行包完整性校验 / 托盘独立 Helper  
