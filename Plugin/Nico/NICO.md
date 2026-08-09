# Nico QQ 宠物

Nico 是放在 SnowLuma `Plugin` 目录中的独立 OneBot HTTP 组件。它沿用 QQPet 1.1.3 的业务实现和 WebUI，并已移除后端授权管理器、写操作授权门禁和激活接口；业务请求仅由本机 SnowLuma OneBot HTTP 服务执行。

## 启动

1. 在 SnowLuma 中为当前账号启用 OneBot HTTP Server。
2. 按需修改 `config.env` 中的地址、端口和 access token。
3. 双击 `start.bat`。
4. 打开 `http://127.0.0.1:8090`。

默认配置：

```env
QQPET_RUNTIME=snowluma
QQPET_ONEBOT_URL=http://127.0.0.1:3000
QQPET_ONEBOT_TOKEN=
QQPET_WEB_HOST=127.0.0.1
QQPET_WEB_PORT=8090
QQPET_DATA_DIR=
```

关闭窗口会停止组件。账号设置、每日进度和日志默认保存在 `%USERPROFILE%\.qqpet-onebot\snowluma\<QQ号>`。

## 许可证

上游发布包的 `LICENSE` 和 `README.md` 明确允许修改、逆向工程、反编译、二次开发、提取组件和重新分发。重新分发时应保留 `LICENSE` 中的版权声明和 MIT 许可文本。

QQ 私有宠物接口可能随服务端变化，也可能产生账号风控；Nico 不改变这一运行风险。
