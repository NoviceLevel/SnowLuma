# Miku QQ 宠物

Miku 是放在 SnowLuma `Plugin` 目录中的独立 OneBot HTTP 组件。正式入口 `index.mjs` 已完成字符串解码、格式化和全部随机标识符重命名，并已删除写请求授权门禁；业务请求仅由本机 SnowLuma OneBot HTTP 服务执行。

## 启动

1. 在 SnowLuma 中为当前账号启用 OneBot HTTP Server。
2. 按需修改 `config.env` 中的地址、端口和 access token。
3. 双击 `start.bat`。
4. 打开 `http://127.0.0.1:8091`。

默认配置：

```env
QQPET_RUNTIME=snowluma
QQPET_ONEBOT_URL=http://127.0.0.1:3002
QQPET_ONEBOT_TOKEN=
QQPET_WEB_HOST=127.0.0.1
QQPET_WEB_PORT=8091
QQPET_DATA_DIR=
```

关闭窗口会停止组件。Miku 会扫描 SnowLuma 的 `config/onebot_<QQ>.json`，为每个账号启动一个独立工作进程；WebUI 从 `8091` 开始按账号递增（例如 `8091`、`8092`），数据默认保存在用户目录的 `.qqpet-miku` 下并按 QQ 号隔离。某个账号子进程退出时只单独重启该账号，不会拖垮其它账号。默认关闭安全模式、优先学习属性，启动前请先核对账号状态。

`QQPET_BOT_UIN` 只用于指定第一个显示的账号，不会限制其他账号启动。没有 SnowLuma 配置目录时，Miku 退回到 `QQPET_ONEBOT_URL` / `QQPET_ONEBOT_TOKEN` 的单账号模式。

托管设置支持跨零点的冒险窗口和休息时段，也支持指定雇佣好友、钱袋冒险、连续未掉落暂停、宠物 PK，以及按秒设置走访/PK 间隔；写后验证、失败冷却、结算重试、任务失踪确认窗口可在 WebUI「运行与安全」中调整。新增写操作默认关闭，旧配置会保留原有用户选择并自动迁移走访间隔单位。

## 源码维护

- `index.mjs`：唯一的明码维护源文件，也是正式运行入口。
- `baseline/index.obfuscated.mjs`：切换前的可运行混淆基线，仅用于对照和回退。
- `baseline/index.readable-pre-local-renames.mjs`：局部变量重命名前的明码回退版本。
- `baseline/index.pre-local-semantic.mjs`：语义重命名前的明码回退版本。
- `tools/rename-top-level.mjs`：基于作用域的重命名工具。
- `tools/rename-locals.mjs`：局部绑定语义推断和全文件唯一命名工具。
- `tools/rename-mechanical-locals.mjs`：机械式局部标识符重命名工具。

## 许可证

上游发布包的 `LICENSE` 和 `README.md` 明确允许修改、逆向工程、反编译、二次开发、提取组件和重新分发。重新分发时应保留 `LICENSE` 中的版权声明和 MIT 许可文本。

QQ 私有宠物接口可能随服务端变化，也可能产生账号风控；Miku 不改变这一运行风险。
