@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo  控制探秘营 - 启动服务
echo ================================================
echo.
del /q "%~dp0STOP.flag" 2>nul

schtasks /run /tn "控制探秘营-期中考试服务" >nul 2>&1
if errorlevel 1 goto direct

echo 已通过计划任务启动，稍等 3 秒...
timeout /t 3 /nobreak >nul
goto check

:direct
echo 计划任务不可用，改为直接后台启动...
start "控制探秘营守护" /min node "%~dp0supervisor.cjs"
timeout /t 3 /nobreak >nul

:check
curl -s -o nul --noproxy "*" http://127.0.0.1:8830/api/config
if errorlevel 1 (
    echo.
    echo [警告] 服务尚未响应，请稍后重试或重启电脑。
) else (
    echo.
    echo 服务已就绪：
    echo   学生端  http://10.9.129.17:8830/
    echo   教师端  http://10.9.129.17:8830/teacher
)
echo.
pause
