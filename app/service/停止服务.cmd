@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo  控制探秘营 - 停止服务
echo ================================================
echo.
echo 正在写入停止标记并结束后台进程...

rem 1) 先写停止标记，守护进程不会自动重启
echo %date% %time% > "%~dp0STOP.flag"

rem 2) 结束占用 8830 的服务进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8830" ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

rem 3) 结束守护进程本身
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*supervisor.cjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

timeout /t 4 /nobreak >nul
del /q "%~dp0STOP.flag" 2>nul

echo.
echo 已停止。下次开机或登录 Windows 时会自动重新启动。
echo 若要重新启动，请运行同目录的「启动服务.cmd」。
echo.
pause
