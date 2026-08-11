# Outdoor-history protocol, QQPet 1.2.1

## OIDB command

- Packet: `OidbSvcTrpcTcp.0x9876_1`
- Command: `39030` (`0x9876`)
- Sub-command: `1`

## Request body

| Field | Wire type | Meaning |
| --- | --- | --- |
| 1 | varint | Zero-based offset |
| 2 | varint | Limit, clamped to 1 through 50 |
| 3 | string | Current pet ID |
| 100 | varint | Client/protocol type, fixed to `2` |

The 1.2.1 implementation is identical to the verified 1.2.0 request. In
particular, it confirms `field 100 = 2`; using `field 4 = 2` is incorrect.

## Response body

Top-level field 1 repeats record messages. Top-level field 4 is the read
watermark. A record is unread when its timestamp exceeds that watermark.

| Record field | Meaning |
| --- | --- |
| 1 | story ID |
| 2 | Unix timestamp in seconds |
| 3 | title |
| 4 | grade |
| 5 | detail |
| 6 | result-list container |
| 7 | event type |
| 8 | outdoor version |

The result-list container repeats messages in field 1:

| Result field | Meaning |
| --- | --- |
| 1 | raw type; `1` maps to `2`, `2` maps to `3` |
| 2 | name |
| 3 | value |
| 4 | right-top description |
| 6 | icon URL |
| 7 | difference |
| 9 | whether this describes a pet |
| 10 | pet ID |

## SnowLuma implication

The source confirms the protobuf layout but does not change the previously
observed server rejection, `[oidb] rule type not match appid`. That failure is
at the packet transport/app-ID policy layer, before response parsing. The 1.2.1
release still relies on its protected mutation/native transport for writes;
read-only outdoor history still uses `send_packet`, so there is no newly
exposed JavaScript workaround for SnowLuma's generic packet route.
