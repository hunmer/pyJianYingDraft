"""
Aria2 控制器

提供轻量级的 Aria2 信息查询和状态管理接口,
避免直接访问 Aria2ProcessManager 导致的多实例问题
"""

from __future__ import annotations

from typing import Optional
from pathlib import Path


class Aria2Controller:
    """Aria2 控制器 - 单例模式

    提供以下功能:
    - 获取 Aria2 配置信息 (端口、下载目录等)
    - 获取 RPC 连接信息
    - 检查 Aria2 运行状态
    - 控制 Aria2 启动/停止/重启 (通过单例 ProcessManager)
    """

    _instance: Optional[Aria2Controller] = None
    _initialized = False

    def __new__(cls) -> Aria2Controller:
        """确保全局只有一个 Aria2Controller 实例"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化控制器 (只执行一次)"""
        if Aria2Controller._initialized:
            return

        # 延迟导入,避免循环依赖
        from app.services.aria2_manager import get_aria2_manager

        self._manager = get_aria2_manager()
        Aria2Controller._initialized = True

    # ==================== 配置信息查询 ====================

    @property
    def rpc_port(self) -> int:
        """获取 RPC 端口"""
        return self._manager.rpc_port

    @property
    def rpc_secret(self) -> str:
        """获取 RPC 密钥"""
        return self._manager.rpc_secret

    @property
    def download_dir(self) -> Path:
        """获取下载目录"""
        return self._manager.download_dir

    @property
    def aria2c_path(self) -> str:
        """获取 aria2c 可执行文件路径"""
        return self._manager.aria2c_path

    @property
    def config_path(self) -> Path:
        """获取 aria2.conf 配置文件路径"""
        return self._manager.config_path

    def get_config(self) -> dict:
        """获取完整配置信息

        Returns:
            dict: 包含所有配置项的字典
        """
        return {
            "rpc_port": self.rpc_port,
            "rpc_secret": self.rpc_secret,
            "download_dir": str(self.download_dir),
            "aria2c_path": self.aria2c_path,
            "config_path": str(self.config_path),
            "max_concurrent_downloads": self._manager.config.get("max_concurrent_downloads", 50),
            "max_connection_per_server": self._manager.config.get("max_connection_per_server", 16),
        }

    # ==================== RPC 连接信息 ====================

    def get_rpc_url(self) -> str:
        """获取 RPC 服务器 URL

        Returns:
            str: RPC URL,格式如 http://localhost:6800/jsonrpc
        """
        return self._manager.get_rpc_url()

    def get_rpc_credentials(self) -> dict:
        """获取 RPC 连接凭据

        Returns:
            dict: 包含 host, port, secret 的字典
        """
        return {
            "host": "http://localhost",
            "port": self.rpc_port,
            "secret": self.rpc_secret if self.rpc_secret else ""
        }

    # ==================== 状态查询 ====================

    def is_running(self) -> bool:
        """检查 Aria2 进程是否正在运行

        Returns:
            bool: 运行中返回 True,否则返回 False
        """
        return self._manager.is_running()

    def get_process_pid(self) -> Optional[int]:
        """获取 Aria2 进程 PID

        Returns:
            Optional[int]: 进程 PID,如果未运行返回 None
        """
        if self._manager.process:
            return self._manager.process.pid
        return None

    # ==================== 进程控制 (仅供管理使用) ====================

    def start(self, enable_debug_output: bool = False) -> bool:
        """启动 Aria2 进程 (管理员操作)

        Args:
            enable_debug_output: 是否启用调试输出

        Returns:
            bool: 启动成功返回 True
        """
        return self._manager.start(enable_debug_output=enable_debug_output)

    def stop(self) -> bool:
        """停止 Aria2 进程 (管理员操作)

        Returns:
            bool: 停止成功返回 True
        """
        return self._manager.stop()

    def restart(self) -> bool:
        """重启 Aria2 进程 (管理员操作)

        Returns:
            bool: 重启成功返回 True
        """
        return self._manager.restart()

    def start_health_check(self, interval: int = 30) -> None:
        """启动健康检查任务

        Args:
            interval: 检查间隔(秒)
        """
        self._manager.start_health_check(interval)

    def stop_health_check(self) -> None:
        """停止健康检查任务"""
        self._manager.stop_health_check()


# ==================== 全局单例访问函数 ====================

def get_aria2_controller() -> Aria2Controller:
    """获取全局 Aria2 控制器单例

    这是推荐的访问方式,确保全局只有一个控制器实例

    Returns:
        Aria2Controller: 全局控制器实例
    """
    return Aria2Controller()
