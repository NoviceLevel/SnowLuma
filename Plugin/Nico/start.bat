@echo off
setlocal
cd /d "%~dp0"

set "NICO_NODE=%~dp0..\..\node.exe"
if not exist "%NICO_NODE%" set "NICO_NODE=node"
set "NICO_BOT_UIN=2795997172"
set "NICO_ONEBOT_PORT=3000"

rem Load only the SnowLuma OneBot token assigned to Nico's bot.
if not defined QQPET_ONEBOT_TOKEN (
  for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$configPath = '%~dp0..\..\config\onebot_%NICO_BOT_UIN%.json'; if (Test-Path -LiteralPath $configPath) { $json = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json; foreach ($server in @($json.networks.httpServers)) { if ($server.port -eq %NICO_ONEBOT_PORT% -and $server.accessToken) { [Console]::Write($server.accessToken); break } } }"`) do set "QQPET_ONEBOT_TOKEN=%%T"
)

if not defined QQPET_ONEBOT_TOKEN (
  echo Nico could not load the OneBot token for QQ %NICO_BOT_UIN% on port %NICO_ONEBOT_PORT%.
  exit /b 1
)

"%NICO_NODE%" --env-file-if-exists=config.env index.mjs
set "NICO_EXIT=%ERRORLEVEL%"
if not "%NICO_EXIT%"=="0" pause
exit /b %NICO_EXIT%
