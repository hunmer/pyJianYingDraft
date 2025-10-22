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
    ],
    hiddenimports=[
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
        'fastapi',
        'socketio',
        'python_socketio',
        'engineio',
        'python_engineio',
        'pydantic',
        'watchdog',
        'watchdog.observers',
        'watchdog.events',
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
