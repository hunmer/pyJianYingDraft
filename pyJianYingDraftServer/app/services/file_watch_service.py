"""
文件监控服务
"""

import os
import hashlib
import shutil
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from threading import Lock
import sys
from watchdog.observers import Observer as NativeObserver
from watchdog.observers.api import BaseObserver
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler, FileModifiedEvent

from app.models.file_watch_models import (
    WatchedFileInfo,
    FileVersionInfo,
    FileVersionListResponse,
    FileContentResponse
)


class FileVersionManager:
    """文件版本管理器"""

    def __init__(self, storage_dir: str = ".file_versions"):
        """
        初始化文件版本管理器

        Args:
            storage_dir: 版本存储目录
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)

        # 元数据文件
        self.metadata_file = self.storage_dir / "metadata.json"

        # 监控文件信息 {file_path: WatchedFileInfo}
        self.watched_files: Dict[str, WatchedFileInfo] = {}

        # 线程锁
        self.lock = Lock()

        # 为每个文件单独创建 Observer {file_path: Observer}
        self.observers: Dict[str, BaseObserver] = {}

        # 加载元数据
        self._load_metadata()

    def _load_metadata(self):
        """从磁盘加载元数据"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for file_path, info in data.items():
                        self.watched_files[file_path] = WatchedFileInfo(**info)
            except Exception as e:
                print(f"加载元数据失败: {e}")

    def _save_metadata(self):
        """保存元数据到磁盘"""
        try:
            data = {
                file_path: info.model_dump(mode='json')
                for file_path, info in self.watched_files.items()
            }
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            print(f"保存元数据失败: {e}")

    def _get_file_hash(self, file_path: str) -> str:
        """计算文件MD5哈希"""
        md5 = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5.update(chunk)
        return md5.hexdigest()

    def _get_version_dir(self, file_path: str) -> Path:
        """获取文件的版本存储目录"""
        # 使用文件路径的哈希值作为目录名
        path_hash = hashlib.md5(file_path.encode()).hexdigest()
        version_dir = self.storage_dir / path_hash
        version_dir.mkdir(exist_ok=True)
        return version_dir

    def _get_version_file_path(self, file_path: str, version: int) -> Path:
        """获取指定版本的文件路径"""
        version_dir = self._get_version_dir(file_path)
        original_name = Path(file_path).name
        return version_dir / f"v{version}_{original_name}"

    def add_watch(self, file_path: str, watch_name: Optional[str] = None) -> WatchedFileInfo:
        """
        添加文件监控

        Args:
            file_path: 文件路径
            watch_name: 监控名称

        Returns:
            WatchedFileInfo: 监控文件信息
        """
        # 标准化路径
        file_path = os.path.abspath(file_path)

        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with self.lock:
            # 如果已经在监控，返回现有信息
            if file_path in self.watched_files:
                return self.watched_files[file_path]

            # 创建监控信息
            if watch_name is None:
                watch_name = Path(file_path).name

            info = WatchedFileInfo(
                file_path=file_path,
                watch_name=watch_name,
                is_watching=False,
                latest_version=0,
                total_versions=0,
                created_at=datetime.now()
            )

            # 先将信息添加到字典（这样_save_version才能找到）
            self.watched_files[file_path] = info

            # 保存初始版本
            new_version = self._save_version(file_path)

            # 更新信息（虽然_save_version已经更新了，但为了保持一致性）
            info.latest_version = new_version
            info.total_versions = new_version

            self._save_metadata()

            return info

    def remove_watch(self, file_path: str) -> bool:
        """
        移除文件监控

        Args:
            file_path: 文件路径

        Returns:
            bool: 是否成功移除
        """
        file_path = os.path.abspath(file_path)

        with self.lock:
            if file_path in self.watched_files:
                # 停止监控
                if self.watched_files[file_path].is_watching:
                    self.stop_watch(file_path)

                del self.watched_files[file_path]
                self._save_metadata()
                return True
            return False

    def _save_version(self, file_path: str) -> int:
        """
        保存文件的新版本

        Args:
            file_path: 文件路径

        Returns:
            int: 新版本号
        """
        if file_path not in self.watched_files:
            raise ValueError(f"文件未被监控: {file_path}")

        info = self.watched_files[file_path]
        new_version = info.latest_version + 1

        # 复制文件到版本目录
        version_file = self._get_version_file_path(file_path, new_version)
        shutil.copy2(file_path, version_file)

        # 更新信息
        info.latest_version = new_version
        info.total_versions = new_version
        info.last_modified = datetime.now()

        self._save_metadata()

        return new_version

    def get_watched_files(self) -> List[WatchedFileInfo]:
        """获取所有监控文件列表"""
        with self.lock:
            return list(self.watched_files.values())

    def get_versions(self, file_path: str) -> FileVersionListResponse:
        """
        获取文件的所有版本列表

        Args:
            file_path: 文件路径

        Returns:
            FileVersionListResponse: 版本列表响应
        """
        file_path = os.path.abspath(file_path)

        if file_path not in self.watched_files:
            raise ValueError(f"文件未被监控: {file_path}")

        info = self.watched_files[file_path]
        versions = []

        for version in range(1, info.total_versions + 1):
            version_file = self._get_version_file_path(file_path, version)
            if version_file.exists():
                stat = version_file.stat()
                file_hash = self._get_file_hash(str(version_file))

                versions.append(FileVersionInfo(
                    version=version,
                    timestamp=datetime.fromtimestamp(stat.st_mtime),
                    file_size=stat.st_size,
                    file_hash=file_hash
                ))

        return FileVersionListResponse(
            file_path=file_path,
            versions=versions
        )

    def get_version_content(self, file_path: str, version: int) -> FileContentResponse:
        """
        获取指定版本的文件内容

        Args:
            file_path: 文件路径
            version: 版本号

        Returns:
            FileContentResponse: 文件内容响应
        """
        file_path = os.path.abspath(file_path)

        if file_path not in self.watched_files:
            raise ValueError(f"文件未被监控: {file_path}")

        version_file = self._get_version_file_path(file_path, version)
        if not version_file.exists():
            raise FileNotFoundError(f"版本文件不存在: v{version}")

        # 读取文件内容
        with open(version_file, 'r', encoding='utf-8') as f:
            content = f.read()

        stat = version_file.stat()

        return FileContentResponse(
            file_path=file_path,
            version=version,
            content=content,
            timestamp=datetime.fromtimestamp(stat.st_mtime),
            file_size=stat.st_size
        )

    def start_watch(self, file_path: str) -> bool:
        """
        开始监控文件变化

        Args:
            file_path: 文件路径

        Returns:
            bool: 是否成功开始监控
        """
        file_path = os.path.abspath(file_path)

        if file_path not in self.watched_files:
            raise ValueError(f"文件未被监控: {file_path}")

        with self.lock:
            info = self.watched_files[file_path]
            if info.is_watching:
                return False

            # 为每个文件创建独立的 Observer
            observer = self._create_observer()
            handler = FileChangeHandler(self, file_path)
            watch_dir = os.path.dirname(file_path)

            # 调度监控
            observer.schedule(handler, watch_dir, recursive=False)

            # 启动观察器
            observer.start()

            # 保存观察器引用
            self.observers[file_path] = observer

            info.is_watching = True
            self._save_metadata()

            print(f"开始监控文件: {file_path}")
            return True

    def stop_watch(self, file_path: str) -> bool:
        """
        停止监控文件变化

        Args:
            file_path: 文件路径

        Returns:
            bool: 是否成功停止监控
        """
        file_path = os.path.abspath(file_path)

        if file_path not in self.watched_files:
            return False

        with self.lock:
            info = self.watched_files[file_path]
            if not info.is_watching:
                return False

            # 停止并清理 Observer
            if file_path in self.observers:
                try:
                    observer = self.observers[file_path]
                    observer.stop()
                    observer.join(timeout=2)  # 等待线程结束
                    del self.observers[file_path]
                    print(f"停止监控文件: {file_path}")
                except Exception as e:
                    print(f"停止监控失败: {e}")

            info.is_watching = False
            self._save_metadata()

            return True

    def on_file_modified(self, file_path: str):
        """
        文件修改时的回调

        Args:
            file_path: 文件路径
        """
        file_path = os.path.abspath(file_path)

        if file_path in self.watched_files:
            info = self.watched_files[file_path]
            if info.is_watching:
                print(f"检测到文件变化: {file_path}")
                self._save_version(file_path)

    def _create_observer(self):
        """
        根据运行环境选择合适的 Observer 实现。

        Watchdog 3.0.0 在 Windows + Python 3.13 组合下使用原生 Observer 会触发
        “'handle' must be a _ThreadHandle” 异常（上游 bug：Win32 emitter 覆盖了
        threading.Thread 的内部 _handle 属性）。此处在检测到该组合时退化为
        PollingObserver 以保持功能可用。
        """
        if os.name == "nt" and sys.version_info >= (3, 13):
            return PollingObserver()
        return NativeObserver()


class FileChangeHandler(FileSystemEventHandler):
    """文件变化事件处理器"""

    def __init__(self, manager: FileVersionManager, file_path: str):
        self.manager = manager
        self.file_path = file_path
        self.last_hash = manager._get_file_hash(file_path)

    def on_modified(self, event):
        """文件修改事件"""
        if isinstance(event, FileModifiedEvent) and event.src_path == self.file_path:
            # 检查文件内容是否真的变化（避免重复触发）
            try:
                current_hash = self.manager._get_file_hash(self.file_path)
                if current_hash != self.last_hash:
                    self.last_hash = current_hash
                    self.manager.on_file_modified(self.file_path)
            except Exception as e:
                print(f"处理文件修改事件失败: {e}")


# 全局单例
_file_version_manager: Optional[FileVersionManager] = None


def get_file_version_manager() -> FileVersionManager:
    """获取全局文件版本管理器实例"""
    global _file_version_manager
    if _file_version_manager is None:
        _file_version_manager = FileVersionManager()
    return _file_version_manager
