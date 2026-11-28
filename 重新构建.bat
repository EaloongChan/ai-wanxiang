@echo off
rem ============================================================
rem  EALOONG ARCADE - build only (+ data check)
rem  NOTE: keep this file pure ASCII. cmd.exe parses .bat with the
rem  system OEM codepage (GBK on zh-CN), so non-ASCII bytes here
rem  turn into garbage and get executed as commands.
rem ============================================================
chcp 65001 >nul
title EALOONG ARCADE - Build
cd /d "%~dp0"

echo.
echo   [1/2] Building site into dist\ ...
echo.
call node scripts\build.mjs
if errorlevel 1 goto FAIL

echo.
echo   [2/2] Running data checks...
echo.
call node scripts\check.mjs

echo.
echo   Done.
echo.
pause
exit /b 0

:FAIL
echo.
echo   [x] Build failed. See the errors above.
echo.
pause
exit /b 1
