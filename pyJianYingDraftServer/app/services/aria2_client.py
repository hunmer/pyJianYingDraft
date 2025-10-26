"""
Aria2 RPC客户端封装

提供简洁的Python API用于与aria2c RPC服务器交互
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any, Callable
from datetime import datetime
import time

try:
    import aria2p
    ARIA2P_AVAILABLE = True
except ImportError:
    ARIA2P_AVAILABLE = False
    print("警告: aria2p未安装，请运行: pip install aria2p")


class DownloadProgress:
    """下载进度信息"""

    def __init__(
        self,
        gid: str,
        status: str,
        total_length: int,
        completed_length: int,
        download_speed: int,
        upload_speed: int,
        num_pieces: int,
        connections: int,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        file_path: Optional[str] = None
    ):
        self.gid = gid
        self.status = status  # active, waiting, paused, error, complete, removed
        self.total_length = total_length
        self.completed_length = completed_length
        self.download_speed = download_speed
        self.upload_speed = upload_speed
        self.num_pieces = num_pieces
        self.connections = connections
        self.error_code = error_code
        self.error_message = error_message
        self.file_path = file_path  # 下载文件的完整路径

    @property
    def progress_percent(self) -> float:
        """进度百分比（0-100）"""
        if self.total_length == 0:
            return 0.0
        return (self.completed_length / self.total_length) * 100

    @property
    def eta_seconds(self) -> Optional[int]:
        """预计剩余时间（秒）"""
        if self.download_speed == 0:
            return None
        remaining = self.total_length - self.completed_length
        return int(remaining / self.download_speed)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "gid": self.gid,
            "status": self.status,
            "total_length": self.total_length,
            "completed_length": self.completed_length,
            "download_speed": self.download_speed,
            "upload_speed": self.upload_speed,
            "progress_percent": round(self.progress_percent, 2),
            "eta_seconds": self.eta_seconds,
            "num_pieces": self.num_pieces,
            "connections": self.connections,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "file_path": self.file_path
        }


class BatchDownloadProgress:
    """批量下载进度信息"""

    def __init__(
        self,
        batch_id: str,
        downloads: List[DownloadProgress],
        created_at: datetime
    ):
        self.batch_id = batch_id
        self.downloads = downloads
        self.created_at = created_at

    @property
    def total_size(self) -> int:
        """总大小（字节）"""
        return sum(d.total_length for d in self.downloads)

    @property
    def downloaded_size(self) -> int:
        """已下载大小（字节）"""
        return sum(d.completed_length for d in self.downloads)

    @property
    def total_speed(self) -> int:
        """总下载速度（字节/秒）"""
        return sum(d.download_speed for d in self.downloads)

    @property
    def progress_percent(self) -> float:
        """总体进度百分比（0-100）"""
        if self.total_size == 0:
            return 0.0
        return (self.downloaded_size / self.total_size) * 100

    @property
    def eta_seconds(self) -> Optional[int]:
        """预计剩余时间（秒）"""
        if self.total_speed == 0:
            return None
        remaining = self.total_size - self.downloaded_size
        return int(remaining / self.total_speed)

    @property
    def completed_count(self) -> int:
        """已完成的下载数"""
        return sum(1 for d in self.downloads if d.status == "complete")

    @property
    def failed_count(self) -> int:
        """失败的下载数"""
        return sum(1 for d in self.downloads if d.status == "error")

    @property
    def active_count(self) -> int:
        """正在下载的数量"""
        return sum(1 for d in self.downloads if d.status == "active")

    @property
    def is_completed(self) -> bool:
        """是否全部完成"""
        # 空列表不应该被视为已完成
        if not self.downloads:
            return False
        return all(d.status in ("complete", "error") for d in self.downloads)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "batch_id": self.batch_id,
            "total_files": len(self.downloads),
            "completed_files": self.completed_count,
            "failed_files": self.failed_count,
            "active_files": self.active_count,
            "total_size": self.total_size,
            "downloaded_size": self.downloaded_size,
            "progress_percent": round(self.progress_percent, 2),
            "download_speed": self.total_speed,
            "eta_seconds": self.eta_seconds,
            "is_completed": self.is_completed,
            "created_at": self.created_at.isoformat(),
            "downloads": [d.to_dict() for d in self.downloads]
        }


class Aria2Client:
    """Aria2 RPC客户端

    提供简洁的API用于管理aria2下载任务
    """

    def __init__(
        self,
        rpc_url: str = "http://localhost:6800/jsonrpc",
        rpc_secret: Optional[str] = None,
        verbose: bool = True,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        auto_restart_failed: bool = False
    ):
        """初始化Aria2客户端

        Args:
            rpc_url: RPC服务器URL
            rpc_secret: RPC密钥
            verbose: 是否显示详细日志
            max_retries: 网络请求最大重试次数
            retry_delay: 重试延迟(秒),使用指数退避
            auto_restart_failed: 是否自动重启失败的下载任务
        """
        if not ARIA2P_AVAILABLE:
            raise RuntimeError("aria2p未安装，请运行: pip install aria2p")

        self.rpc_url = rpc_url
        self.rpc_secret = rpc_secret
        self.verbose = verbose
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.auto_restart_failed = auto_restart_failed

        # 解析RPC URL获取host和port
        # rpc_url格式: http://localhost:6800/jsonrpc
        import urllib.parse
        parsed = urllib.parse.urlparse(rpc_url)
        host = f"{parsed.scheme}://{parsed.hostname}"
        port = parsed.port or 6800

        # 初始化aria2p API
        # 注意: aria2p.Client的host参数只需要协议+域名,不包含路径
        self.api = aria2p.API(
            aria2p.Client(
                host=host,
                port=port,
                secret=rpc_secret if rpc_secret else ""  # 空字符串表示不使用secret
            )
        )

        # 批次下载追踪
        self.batches: Dict[str, List[str]] = {}  # batch_id -> [gid, gid, ...]
        self.batch_metadata: Dict[str, datetime] = {}  # batch_id -> created_at

        # GID → 文件路径映射表（用于查询下载文件的真实路径）
        self.gid_to_path: Dict[str, str] = {}  # gid -> file_path

        # GID → 原始下载信息(URL + options),用于重启失败的下载
        self.gid_to_download_info: Dict[str, Tuple[str, Dict[str, Any]]] = {}  # gid -> (url, options)

        # 失败任务重试计数
        self.retry_count: Dict[str, int] = {}  # gid -> retry_count

    def _log(self, message: str) -> None:
        """输出日志"""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[Aria2Client {timestamp}] {message}")

    async def _retry_on_connection_error(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """连接错误时自动重试

        Args:
            func: 要执行的函数
            *args: 位置参数
            **kwargs: 关键字参数

        Returns:
            函数执行结果

        Raises:
            最后一次重试的异常
        """
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                # 尝试执行函数
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)

            except (ConnectionResetError, ConnectionError, Exception) as e:
                last_exception = e

                # 判断是否为连接相关错误
                error_msg = str(e).lower()
                is_connection_error = any(keyword in error_msg for keyword in [
                    'connection', 'reset', 'refused', 'aborted', 'max retries'
                ])

                if not is_connection_error:
                    # 非连接错误,直接抛出
                    raise

                if attempt < self.max_retries - 1:
                    # 指数退避策略
                    delay = self.retry_delay * (2 ** attempt)
                    self._log(f"⚠️  连接失败 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                    self._log(f"等待 {delay:.1f} 秒后重试...")
                    await asyncio.sleep(delay)
                else:
                    self._log(f"✗ 达到最大重试次数 ({self.max_retries}),放弃操作")

        # 所有重试都失败,抛出最后一个异常
        raise last_exception

    async def _restart_failed_download(self, gid: str) -> Optional[str]:
        """重启失败的下载任务

        Args:
            gid: 失败任务的GID

        Returns:
            新任务的GID,如果重启失败则返回None
        """
        # 检查重试次数
        current_retries = self.retry_count.get(gid, 0)
        if current_retries >= self.max_retries:
            self._log(f"⚠️  任务 {gid} 已达最大重试次数,不再重启")
            return None

        # 获取原始下载信息
        download_info = self.gid_to_download_info.get(gid)
        if not download_info:
            self._log(f"⚠️  无法找到任务 {gid} 的原始下载信息")
            return None

        url, options = download_info
        save_path = self.gid_to_path.get(gid)

        try:
            # 移除失败的任务
            await self.cancel_download(gid)

            # 重新添加下载
            self._log(f"🔄 重启失败的下载任务 (尝试 {current_retries + 1}/{self.max_retries}): {url}")
            new_gid = await self.add_download(url, save_path, options)

            # 更新重试计数
            self.retry_count[new_gid] = current_retries + 1

            # 复制旧GID的元数据到新GID
            if gid in self.gid_to_download_info:
                self.gid_to_download_info[new_gid] = self.gid_to_download_info[gid]

            # 更新批次信息
            for batch_id, gids in self.batches.items():
                if gid in gids:
                    # 替换旧GID为新GID
                    idx = gids.index(gid)
                    gids[idx] = new_gid

            return new_gid

        except Exception as e:
            self._log(f"✗ 重启下载失败: {e}")
            return None

    async def add_download(
        self,
        url: str,
        save_path: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """添加单个下载任务

        Args:
            url: 文件URL
            save_path: 保存路径（包含文件名）
            options: 下载选项

        Returns:
            str: 下载任务的GID
        """
        opts = options or {}

        # 解析保存路径
        if save_path:
            save_path_obj = Path(save_path)
            opts["dir"] = str(save_path_obj.parent)
            opts["out"] = save_path_obj.name

        try:
            # 使用重试机制添加下载
            async def _add():
                download = self.api.add_uris([url], options=opts)
                return download.gid

            gid = await self._retry_on_connection_error(_add)

            # 保存GID → 文件路径映射
            if save_path:
                self.gid_to_path[gid] = save_path
                self._log(f"✓ 添加下载任务: {url} -> GID: {gid}, 保存路径: {save_path}")
            else:
                self._log(f"✓ 添加下载任务: {url} -> GID: {gid}")

            # 保存下载信息用于可能的重启
            self.gid_to_download_info[gid] = (url, opts.copy())

            # 初始化重试计数
            self.retry_count[gid] = 0

            return gid

        except Exception as e:
            self._log(f"✗ 添加下载失败: {url} - {e}")
            raise

    async def add_batch_downloads(
        self,
        urls_with_paths: List[Tuple[str, str]],
        batch_id: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """批量添加下载任务

        Args:
            urls_with_paths: URL和保存路径的列表 [(url, save_path), ...]
            batch_id: 批次ID（None则自动生成）
            options: 下载选项

        Returns:
            str: 批次ID
        """
        import uuid

        if batch_id is None:
            batch_id = str(uuid.uuid4())

        gids = []
        self._log(f"开始批量下载任务 (batch_id: {batch_id}, 文件数: {len(urls_with_paths)})")

        for url, save_path in urls_with_paths:
            try:
                gid = await self.add_download(url, save_path, options)
                gids.append(gid)
            except Exception as e:
                self._log(f"跳过失败的下载: {url} - {e}")
                # 继续下载其他文件

        self.batches[batch_id] = gids
        self.batch_metadata[batch_id] = datetime.now()

        self._log(f"✓ 批量下载任务已添加: {len(gids)}/{len(urls_with_paths)} 个文件成功")
        return batch_id

    def get_progress(self, gid: str, auto_restart: Optional[bool] = None) -> Optional[DownloadProgress]:
        """获取单个下载的进度

        Args:
            gid: 下载任务GID
            auto_restart: 是否自动重启失败的任务(None使用全局设置)

        Returns:
            DownloadProgress: 进度信息，任务不存在返回None
        """
        if auto_restart is None:
            auto_restart = self.auto_restart_failed

        try:
            download = self.api.get_download(gid)

            # 从映射表获取文件路径
            file_path = self.gid_to_path.get(gid)

            progress = DownloadProgress(
                gid=download.gid,
                status=download.status,
                total_length=int(download.total_length),
                completed_length=int(download.completed_length),
                download_speed=int(download.download_speed),
                upload_speed=int(download.upload_speed),
                num_pieces=download.num_pieces,
                connections=download.connections,
                error_code=download.error_code if hasattr(download, 'error_code') else None,
                error_message=download.error_message if hasattr(download, 'error_message') else None,
                file_path=file_path
            )

            return progress

        except Exception as e:
            error_msg = str(e)
            self._log(f"获取进度失败 (GID: {gid}): {error_msg}")

            # 判断是否为连接错误
            is_connection_error = any(keyword in error_msg.lower() for keyword in [
                'connection', 'reset', 'refused', 'aborted', 'max retries'
            ])

            if is_connection_error:
                self._log(f"⚠️  检测到连接错误,可能 aria2 服务已停止")

            return None

    def get_batch_progress(self, batch_id: str) -> Optional[BatchDownloadProgress]:
        """获取批量下载的总体进度

        Args:
            batch_id: 批次ID

        Returns:
            BatchDownloadProgress: 批次进度信息，批次不存在返回None
        """
        if batch_id not in self.batches:
            self._log(f"批次ID不存在: {batch_id}")
            return None

        gids = self.batches[batch_id]
        downloads = []

        for gid in gids:
            progress = self.get_progress(gid)
            if progress:
                downloads.append(progress)

        created_at = self.batch_metadata.get(batch_id, datetime.now())

        return BatchDownloadProgress(
            batch_id=batch_id,
            downloads=downloads,
            created_at=created_at
        )

    async def cancel_download(self, gid: str) -> bool:
        """取消单个下载任务

        Args:
            gid: 下载任务GID

        Returns:
            bool: 是否成功取消
        """
        try:
            download = self.api.get_download(gid)
            result = download.remove(force=True)
            self._log(f"✓ 已取消下载 (GID: {gid})")
            return result
        except Exception as e:
            self._log(f"✗ 取消下载失败 (GID: {gid}): {e}")
            return False

    async def cancel_batch(self, batch_id: str) -> int:
        """取消批量下载

        Args:
            batch_id: 批次ID

        Returns:
            int: 成功取消的下载数
        """
        if batch_id not in self.batches:
            return 0

        gids = self.batches[batch_id]
        cancelled_count = 0

        for gid in gids:
            if await self.cancel_download(gid):
                cancelled_count += 1

        self._log(f"✓ 已取消批次 {batch_id}: {cancelled_count}/{len(gids)} 个任务")
        return cancelled_count

    def get_all_downloads(self) -> List[DownloadProgress]:
        """获取所有下载任务的进度

        Returns:
            List[DownloadProgress]: 所有下载任务的进度列表
        """
        downloads = []

        try:
            active_downloads = self.api.get_downloads()

            for download in active_downloads:
                # 从映射表获取文件路径
                file_path = self.gid_to_path.get(download.gid)

                downloads.append(DownloadProgress(
                    gid=download.gid,
                    status=download.status,
                    total_length=int(download.total_length),
                    completed_length=int(download.completed_length),
                    download_speed=int(download.download_speed),
                    upload_speed=int(download.upload_speed),
                    num_pieces=download.num_pieces,
                    connections=download.connections,
                    file_path=file_path
                ))

        except Exception as e:
            self._log(f"获取所有下载失败: {e}")

        return downloads

    def pause_download(self, gid: str) -> bool:
        """暂停下载

        Args:
            gid: 下载任务GID

        Returns:
            bool: 是否成功暂停
        """
        try:
            download = self.api.get_download(gid)
            download.pause()
            self._log(f"✓ 已暂停下载 (GID: {gid})")
            return True
        except Exception as e:
            self._log(f"✗ 暂停下载失败 (GID: {gid}): {e}")
            return False

    def resume_download(self, gid: str) -> bool:
        """恢复下载

        Args:
            gid: 下载任务GID

        Returns:
            bool: 是否成功恢复
        """
        try:
            download = self.api.get_download(gid)
            download.resume()
            self._log(f"✓ 已恢复下载 (GID: {gid})")
            return True
        except Exception as e:
            self._log(f"✗ 恢复下载失败 (GID: {gid}): {e}")
            return False

    def cleanup_completed(self) -> int:
        """清理已完成和失败的下载记录

        Returns:
            int: 清理的记录数
        """
        try:
            removed_count = self.api.remove_all()
            self._log(f"✓ 已清理 {removed_count} 条下载记录")
            return removed_count
        except Exception as e:
            self._log(f"✗ 清理下载记录失败: {e}")
            return 0

    def get_global_stats(self) -> Dict[str, Any]:
        """获取全局统计信息

        Returns:
            Dict: 包含总下载速度、上传速度、活跃下载数等信息
        """
        try:
            stats = self.api.get_stats()
            return {
                "download_speed": int(stats.download_speed),
                "upload_speed": int(stats.upload_speed),
                "num_active": stats.num_active,
                "num_waiting": stats.num_waiting,
                "num_stopped": stats.num_stopped,
                "num_stopped_total": stats.num_stopped_total
            }
        except Exception as e:
            self._log(f"✗ 获取全局统计失败: {e}")
            return {}

    def get_file_path(self, gid: str) -> Optional[str]:
        """获取指定GID的下载文件路径

        Args:
            gid: 下载任务GID

        Returns:
            Optional[str]: 文件路径，不存在返回None
        """
        return self.gid_to_path.get(gid)

    def get_all_file_paths(self) -> Dict[str, str]:
        """获取所有GID到文件路径的映射

        Returns:
            Dict[str, str]: GID → 文件路径的字典
        """
        return self.gid_to_path.copy()

    async def restart_all_failed_downloads(self) -> int:
        """检查并重启所有失败的下载任务

        Returns:
            int: 成功重启的任务数量
        """
        restarted_count = 0
        all_downloads = self.get_all_downloads()

        for download in all_downloads:
            if download.status == "error":
                # 重置重试计数,允许手动重试
                self.retry_count[download.gid] = 0

                new_gid = await self._restart_failed_download(download.gid)
                if new_gid:
                    restarted_count += 1

        if restarted_count > 0:
            self._log(f"✓ 已重启 {restarted_count} 个失败的下载任务")
        else:
            self._log("ℹ️  没有需要重启的失败任务")

        return restarted_count

    def get_retry_info(self, gid: str) -> Dict[str, Any]:
        """获取任务的重试信息

        Args:
            gid: 下载任务GID

        Returns:
            Dict: 包含重试次数、原始URL等信息
        """
        retry_count = self.retry_count.get(gid, 0)
        download_info = self.gid_to_download_info.get(gid)

        info = {
            "gid": gid,
            "retry_count": retry_count,
            "max_retries": self.max_retries,
            "can_retry": retry_count < self.max_retries
        }

        if download_info:
            url, options = download_info
            info["url"] = url
            info["options"] = options

        return info


# 全局单例
_global_client: Optional[Aria2Client] = None


def get_aria2_client(
    rpc_url: Optional[str] = None,
    rpc_secret: Optional[str] = None,
    **kwargs
) -> Aria2Client:
    """获取全局Aria2客户端单例

    Args:
        rpc_url: RPC服务器URL（仅首次调用时生效）
        rpc_secret: RPC密钥（仅首次调用时生效）
        **kwargs: 其他初始化参数

    Returns:
        Aria2Client: 全局客户端实例
    """
    global _global_client

    if _global_client is None:
        if rpc_url is None:
            rpc_url = "http://localhost:6800/jsonrpc"

        _global_client = Aria2Client(
            rpc_url=rpc_url,
            rpc_secret=rpc_secret,
            **kwargs
        )

    return _global_client


def reset_aria2_client() -> None:
    """重置全局Aria2客户端单例

    用于在Aria2配置更改或重启后重新初始化客户端
    """
    global _global_client
    _global_client = None
