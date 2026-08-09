@echo off
setlocal
cd /d "%~dp0"

set "MIKU_NODE=%~dp0..\..\node.exe"
if not exist "%MIKU_NODE%" set "MIKU_NODE=node"
"%MIKU_NODE%" --env-file-if-exists=config.env multi.mjs
set "MIKU_EXIT=%ERRORLEVEL%"
if not "%MIKU_EXIT%"=="0" pause
exit /b %MIKU_EXIT%
