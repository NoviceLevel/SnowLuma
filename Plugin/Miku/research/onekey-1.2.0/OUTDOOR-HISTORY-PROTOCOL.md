# 出门记录协议审计

## OIDB

- 命令：`OidbSvcTrpcTcp.0x9876_1`
- command：`39030`（`0x9876`）
- subCommand：`1`

## 请求体

| 字段 | wire type | 含义 |
| --- | --- | --- |
| 1 | varint | offset，最小 0 |
| 2 | varint | limit，范围 1-50 |
| 3 | string | 当前 petId |
| 100 | varint | 客户端/协议类型，固定 2 |

OneKey 1.2.0 明确发送 `field 100 = 2`。当前 Miku 错误发送 `field 4 = 2`，两个在线账号均收到 OneBot 错误：

`[oidb] rule type not match appid`

所以当前“获取不到记录”不是服务端没有历史，也不是 WebUI 漏显示，而是此前移植时请求字段抄错。

## 响应体

根消息：

- field 1：重复的出门记录子消息
- field 4：已读时间水位

记录子消息：

| 字段 | 含义 |
| --- | --- |
| 1 | storyId |
| 2 | Unix 时间戳（秒） |
| 3 | 标题 |
| 4 | 评级 |
| 5 | 详情 |
| 6 | 结果列表容器 |
| 7 | eventType |
| 8 | outdoorVersion |

结果项：

| 字段 | 含义 |
| --- | --- |
| 1 | 原始类型；1 映射为 2，2 映射为 3 |
| 2 | 名称 |
| 3 | 数值 |
| 4 | 右上角说明 |
| 6 | 图标 URL |
| 7 | 差值 |
| 9 | 是否为宠物信息 |
| 10 | petId |

未读判断为 `record.timestamp > readWatermark`。
