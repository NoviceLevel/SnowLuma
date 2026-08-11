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
| 100 | varint | 客户端协议类型，固定 2 |

OneKey 1.2.0 明确发送 `field 100 = 2`。Miku 此前发送 `field 4 = 2`，该字段错误已经修正。

但字段修正后，SnowLuma 的 PC QQ 通道仍返回：

```text
[oidb] rule type not match appid
```

对 `field 100` 缺省值和 0-5、旧 `field 4` 的在线探测均在解析业务请求体前收到相同拒绝。`wrapper.node` 暴露的字符串还表明 QQ 原生宠物调用使用 `NodeIKernelECDHService::sendOIDBRequest` / `sendOIDBRequestV2`，包含 `service_type` 和 `account_type`；SnowLuma 当前 `send_packet` 则走通用 raw packet 路径。因此：

- `field 100` 是已确认且必须修复的协议字段。
- 当前无法读取服务器历史的剩余根因是 native 发送入口/appid 规则不等价，不是 WebUI 漏显示。
- OneKey 的业务代码能证明 protobuf 请求体，不能证明 SnowLuma 的通用 SSO 发送入口等价于 QQ 的 OIDB 专用入口。

## 当前兜底

Miku 会优先请求服务器历史。遇到命令级 appid 规则拒绝后，本进程不再周期性重复请求该接口，而是将插件实际记录的任务结算遥测投影成“本机结算记录”。记录包含任务类型、任务名称、结算时间、实际耗时和属性增量，并以 `source: local` 明确标记。

这不是伪造服务器数据：它只覆盖本机由 Miku 完成并成功结算的任务。换机前的历史、其他客户端产生的历史和服务器评级仍需等 native OIDB 专用入口支持后才能同步。

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
| 1 | 原始类型（1 映射为 2，2 映射为 3） |
| 2 | 名称 |
| 3 | 数值 |
| 4 | 右上角说明 |
| 6 | 图标 URL |
| 7 | 差值 |
| 9 | 是否为宠物信息 |
| 10 | petId |

未读判断为 `record.timestamp > readWatermark`。
