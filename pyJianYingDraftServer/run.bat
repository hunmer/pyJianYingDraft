@echo off
chcp 65001 >nul
.venv\Scripts\activate
echo 启动 pyJianYingDraft API 服务器...
echo.

python run.py

pause
