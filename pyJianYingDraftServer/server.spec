# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 配置文件
用于打包 pyJianYingDraft 后端服务为单个可执行文件
"""

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

# 项目根目录
ROOT_DIR = Path(SPECPATH).parent

block_cipher = None

# 收集所有第三方包（含原生库和数据文件）
_pkg_datas, _pkg_binaries, _pkg_hiddenimports = [], [], []
for _pkg in [
    'pymediainfo', 'imageio', 'uiautomation',
    'httpx', 'psutil', 'python_multipart',
    'fastapi', 'uvicorn', 'starlette', 'pydantic',
    'sqlalchemy', 'aiosqlite',
    'aria2p', 'loguru', 'websocket',
    'socketio', 'python_socketio', 'engineio', 'python_engineio',
    'watchdog',
    'anyio', 'httptools', 'websockets', 'h11', 'click', 'sniffio',
]:
    try:
        _d, _b, _h = collect_all(_pkg)
        _pkg_datas.extend(_d)
        _pkg_binaries.extend(_b)
        _pkg_hiddenimports.extend(_h)
    except Exception:
        pass

a = Analysis(
    ['run.py'],
    pathex=[str(ROOT_DIR)],
    binaries=_pkg_binaries,
    datas=[
        # 包含配置文件
        ('config.json', '.'),
        # 包含 app 模块所有文件
        ('app', 'app'),
        # 包含 pyJianYingDraft 模块
        (str(ROOT_DIR / 'pyJianYingDraft'), 'pyJianYingDraft'),
        # 包含 aria2 目录(aria2c.exe 及配置文件)
        ('aria2', 'aria2'),
    ] + _pkg_datas,
    hiddenimports=[
        'pyJianYingDraft',
    ] + _pkg_hiddenimports,
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
    upx=False,
    runtime_tmpdir=None,
    console=True,  # 保留控制台窗口以便查看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',  # Windows 应用程序图标
)
