# QQ 宠物助手 1.1.3

这是同时支持 NapCat OneBot 和 SnowLuma OneBot 的独立 QQ 宠物助手。程序不安装
NapCat 插件，也不包含 NapCat、SnowLuma 或 QQ。

## Windows 使用方法

1. 启动 NapCat 或 SnowLuma，并确保目标 QQ 已登录。
2. 启用目标 QQ 的 OneBot HTTP Server；由 SnowLuma 托管时 Miku 会自动读取所有 `onebot_<QQ>.json` 配置。
3. 双击 `QQPetHelper.exe`。程序会自动打开宠物面板，并常驻 Windows 系统托盘。
4. 以后可双击托盘图标打开面板；右键菜单可重新启动服务、打开程序目录或完全退出。

`QQPetHelper.exe` 不显示命令行窗口。关闭浏览器不会停止自动托管，只有从托盘菜单选择
“退出”才会结束后台服务。`start.bat` 作为故障排查备用入口，会显示运行日志。

程序默认调用 `get_version_info` 自动识别 NapCat/SnowLuma。首次启动后请先核对当前 QQ、
宠物昵称和状态，再根据页面提示完成初始化并启动自动托管。

## 修改 OneBot 地址或令牌

OneBot 地址或 access token 变化时：

1. 打开发行包中已经提供的 `config.env`。
2. 按需修改以下字段：

```env
QQPET_RUNTIME=auto
QQPET_ONEBOT_URL=http://127.0.0.1:3002
QQPET_ONEBOT_TOKEN=
QQPET_WEB_HOST=127.0.0.1
QQPET_WEB_PORT=8091
QQPET_DATA_DIR=
```

由 SnowLuma 插件管理器启动时，Miku 会为每个已登录账号启动独立进程和 WebUI 端口，从 `8091` 开始递增；`QQPET_BOT_UIN` 可指定第一个显示的账号。

由 NapCatQQ Desktop 托管时无需编辑此文件；Desktop 会自动读取当前 Bot 的
OneBot HTTP 端口和 Token，并使用独立的动态 Web 端口启动 QQPet。

`QQPET_RUNTIME` 可以是 `auto`、`napcat` 或 `snowluma`。不要把包含 access token 的
`config.env` 发给其他人。

运行日志同时保存在账号数据目录的 `logs/qqpet.log`。单个文件达到 5 MiB 后自动滚动，
最多保留五个备份；启动控制台也会显示本次运行使用的完整日志路径。

## 公告和更新

- 程序会显示公告和最新版本提示。
- 程序不会静默下载或安装更新。

## 更新

停止旧程序，解压新版到新目录。需要保留设置时，不要删除用户主目录下的
`.qqpet-onebot` 数据目录；如果配置过 `QQPET_DATA_DIR`，则保留该目录。

## 安全提示

- Web UI 仅监听本机回环地址。
- OneBot HTTP 不要监听公网。
- NapCat 和 SnowLuma 不要同时托管同一个 QQ。
- 自动化使用非公开 QQ 宠物接口，可能受到服务端规则及账号风控影响。

QQ 经典农场、踩踩和自动回踩不包含在本发行版中。

## 许可证与修改逆向声明

本项目采用 **MIT 许可证**。任何人均可对本项目进行**随意修改、逆向工程、二次开发、提取组件及重新分发**，无需额外授权。

## Linux 使用方法

1. 解压 `linux-x64.tar.gz`，进入解压后的目录。
2. 启动 NapCat 或 SnowLuma 的 OneBot HTTP Server。
3. 执行 `./start.sh`，浏览器打开 <http://127.0.0.1:8091>。

Linux 包内置 Node.js，不需要另外安装。当前支持 x86-64、glibc 2.31 或更高版本；Linux
没有 Windows 托盘程序，可使用 systemd、supervisord 或终端会话管理后台运行。
