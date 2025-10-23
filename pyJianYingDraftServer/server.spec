# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 配置文件
用于打包 pyJianYingDraft 后端服务为单个可执行文件
"""

import sys
from pathlib import Path

# 项目根目录
ROOT_DIR = Path(SPECPATH).parent

block_cipher = None

a = Analysis(
    ['run.py'],
    pathex=[str(ROOT_DIR)],
    binaries=[],
    datas=[
        # 包含配置文件
        ('config.json', '.'),
        # 包含 app 模块所有文件
        ('app', 'app'),
        # 包含 pyJianYingDraft 模块
        (str(ROOT_DIR / 'pyJianYingDraft'), 'pyJianYingDraft'),
        # 包含 aria2 目录(aria2c.exe 及配置文件)
        ('aria2', 'aria2'),
    ],
    hiddenimports=[
        # Uvicorn 核心模块
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # FastAPI 核心和中间件
        'fastapi',
        'fastapi.middleware',
        'fastapi.middleware.cors',
        'fastapi.middleware.trustedhost',
        'fastapi.middleware.gzip',
        'fastapi.middleware.httpsredirect',
        # Starlette (FastAPI 依赖)
        'starlette.middleware',
        'starlette.middleware.base',
        'starlette.middleware.cors',
        'starlette.middleware.errors',
        'starlette.middleware.gzip',
        'starlette.middleware.httpsredirect',
        'starlette.middleware.trustedhost',
        # Socket.IO
        'socketio',
        'python_socketio',
        'engineio',
        'python_engineio',
        # Pydantic
        'pydantic',
        'pydantic.networks',
        'pydantic.types',
        # Watchdog (文件监控)
        'watchdog',
        'watchdog.observers',
        'watchdog.events',
        # SQLAlchemy (数据库ORM)
        'sqlalchemy',
        'sqlalchemy.ext',
        'sqlalchemy.ext.declarative',
        'sqlalchemy.ext.asyncio',
        'sqlalchemy.orm',
        'sqlalchemy.engine',
        'sqlalchemy.pool',
        'sqlalchemy.dialects',
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.sql',
        # aiosqlite (异步SQLite驱动)
        'aiosqlite',
        # aria2p (Aria2 RPC客户端)
        'aria2p',
        'aria2p.api',
        'aria2p.client',
        'aria2p.downloads',
        'aria2p.options',
        'aria2p.stats',
        'aria2p.utils',
        # aria2p 依赖
        'loguru',
        'websocket',
        'websocket._app',
        'websocket._core',
        'websocket._socket',
        'websocket._utils',
        # 项目模块
        'pyJianYingDraft',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='pyJianYingDraftServer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 保留控制台窗口以便查看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # 可选:添加图标文件路径
)
