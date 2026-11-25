@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo  控制探秘营 . 六年级期中考试
echo  本脚本现在改为「后台常驻」方式启动：
echo    - 关闭本窗口不影响服务
echo    - 异常退出自动重启
echo    - 开机 / 登录 Windows 后自动启动
echo  停止服务请运行 service\停止服务.cmd
echo ================================================
echo.
call "%~dp0service\启动服务.cmd"
