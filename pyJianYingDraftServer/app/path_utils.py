"""
路径工具模块

提供统一的路径获取功能,支持开发和打包环境
"""

from __future__ import annotations

import sys
from pathlib import Path


def get_executable_dir() -> Path:
    """获取可执行文件所在目录（打包后为 exe 目录，开发时为项目根目录）

    Returns:
        Path: 在打包环境下返回 exe 所在目录,在开发环境下返回项目根目录
    """
    if getattr(sys, 'frozen', False):
        # 打包后的环境：使用 exe 所在目录
        return Path(sys.executable).parent
    else:
        # 开发环境：使用项目根目录
        # 从 pyJianYingDraftServer/app/path_utils.py 回到项目根目录
        return Path(__file__).resolve().parent.parent.parent


def get_app_dir() -> Path:
    """获取应用目录 (pyJianYingDraftServer 目录)

    Returns:
        Path: 在打包环境下返回 exe 所在目录,在开发环境下返回 pyJianYingDraftServer 目录
    """
    if getattr(sys, 'frozen', False):
        # 打包后的环境：使用 exe 所在目录
        return Path(sys.executable).parent
    else:
        # 开发环境：pyJianYingDraftServer 目录
        return Path(__file__).resolve().parent.parent
