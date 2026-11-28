@echo off
rem ============================================================
rem  EALOONG ARCADE - local preview launcher
rem
rem  IMPORTANT - keep this file PURE ASCII with CRLF line endings.
rem  cmd.exe parses .bat using the system OEM codepage (GBK on
rem  zh-CN Windows). Non-ASCII bytes here turn into garbage which
rem  cmd then tries to execute as commands. A UTF-8 BOM breaks the
rem  first line, and LF-only endings can break goto labels.
rem  `node scripts/check.mjs` verifies all three.
rem
rem  The `chcp 65001` below only affects how this console renders
rem  node.exe's UTF-8 output. It does not change how this file is
rem  parsed.
rem ============================================================
chcp 65001 >nul
title EALOONG ARCADE - Local Preview
cd /d "%~dp0"

echo.
echo   ==============================================
echo     EALOONG ARCADE  /  Local Preview
echo   ==============================================
echo.

rem --- locate node: PATH first, then the standard install dir ---
where node >nul 2>nul
if not errorlevel 1 goto HAVE_NODE
if not exist "C:\Program Files\nodejs\node.exe" goto NONODE
set "PATH=C:\Program Files\nodejs;%PATH%"
echo   node was not on PATH - falling back to C:\Program Files\nodejs

:HAVE_NODE
echo   [1/3] Building site...
echo.
node scripts\build.mjs
if errorlevel 1 goto BUILDFAIL

echo.
echo   [2/3] Starting local server in a new window...
start "EALOONG ARCADE Server - keep this window open" cmd /c "chcp 65001 >nul & node scripts\serve.mjs 4173"

echo   [3/3] Opening browser...
ping -n 3 127.0.0.1 >nul
start "" "http://127.0.0.1:4173/"

echo.
echo   ==============================================
echo     Preview    : http://127.0.0.1:4173/
echo     To stop    : close the "EALOONG ARCADE Server" window
echo     To rebuild : run this file again
echo   ==============================================
echo.
ping -n 7 127.0.0.1 >nul
exit /b 0

:NONODE
echo.
echo   [x] Node.js not found.
echo       Install the LTS build from https://nodejs.org
echo       then run this file again.
echo.
pause
exit /b 1

:BUILDFAIL
echo.
echo   [x] Build failed. Read the errors above.
echo.
pause
exit /b 1
