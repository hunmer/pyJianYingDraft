"""
后端全局配置加载模块
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from app.path_utils import get_executable_dir


import sys

# 根据操作系统选择配置文件名
if sys.platform == "darwin":  # macOS
    CONFIG_FILE_NAMES = ("config_macos.json",)
else:  # Windows
    CONFIG_FILE_NAMES = ("config.json",)


def _candidate_paths() -> list[Path]:
    """按优先级返回可能的配置文件路径列表。"""
    exec_dir = get_executable_dir()
    return [
        exec_dir / name
        for name in CONFIG_FILE_NAMES
    ]


def _get_config_file_path() -> Optional[Path]:
    """获取实际使用的配置文件路径"""
    for path in _candidate_paths():
        if path.exists():
            print(path)
            return path
    # 如果没有找到，返回第一个候选路径（用于创建新配置）
    return _candidate_paths()[0]


@lru_cache(maxsize=1)
def load_config() -> dict[str, Any]:
    """加载配置文件，仅在首次调用时读取磁盘。"""
    for path in _candidate_paths():
        if path.exists():
            try:
                with path.open("r", encoding="utf-8") as fp:
                    data = json.load(fp)
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError as exc:
                raise ValueError(f"配置文件 {path} 解析失败: {exc}") from exc
    return {}


def get_config(key: str, default: Optional[Any] = None) -> Optional[Any]:
    """读取指定配置项，未找到时返回默认值。"""
    return load_config().get(key, default)


def save_config(config_data: dict[str, Any]) -> None:
    """保存配置到文件，并清除缓存"""
    config_path = _get_config_file_path()
    print(config_path)
    if config_path is None:
        raise ValueError("无法确定配置文件路径")

    # 保存到文件
    with config_path.open("w", encoding="utf-8") as fp:
        json.dump(config_data, fp, ensure_ascii=False, indent=2)

    # 清除缓存，下次调用load_config时会重新读取
    load_config.cache_clear()


def update_config(key: str, value: Any) -> None:
    """更新单个配置项"""
    config_data = load_config().copy()
    config_data[key] = value
    save_config(config_data)
