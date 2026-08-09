cd /d "%~dp0"

node .\check-node-version.cjs
if errorlevel 1 (
  pause
  exit /b 1
)

rem Prevent two SnowLuma instances from competing for the same WebUI port.
powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 5100 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo SnowLuma is already running on port 5100. Duplicate launch blocked.
  exit /b 0
)
node ./index.mjs
pause
