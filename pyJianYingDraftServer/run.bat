@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 首次运行：用 Python 3.11 创建虚拟环境（避免 Python 3.13 下 pydantic-core 编译失败）
if not exist ".venv\Scripts\activate.bat" (
    echo 正在使用 Python 3.11 创建虚拟环境...
    where uv >nul 2>nul
    if errorlevel 1 (
        echo 未找到 uv，请先安装：pip install uv
        pause
        exit /b 1
    )
    uv venv --python 3.11 .venv
    if errorlevel 1 (
        echo 创建虚拟环境失败
        pause
        exit /b 1
    )
)

call .venv\Scripts\activate

REM 首次运行：自动安装依赖
python -c "import fastapi" >nul 2>nul
if errorlevel 1 (
    echo 正在安装依赖...
    uv pip install -r requirements.txt
    if errorlevel 1 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
)

echo 启动 pyJianYingDraft API 服务器...
echo.

python run.py

pause
