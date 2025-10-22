"""
Aria2进程管理器

自动管理aria2c进程的启动、停止、健康检查和配置生成
"""

from __future__ import annotations

import os
import sys
import subprocess
import asyncio
import secrets
import shutil
import json
from pathlib import Path
from typing import Optional
from datetime import datetime


class Aria2ProcessManager:
    """Aria2c进程管理器

    负责aria2c进程的完整生命周期管理：
    - 自动查找或使用指定的aria2c可执行文件
    - 生成默认配置文件
    - 启动、停止、重启进程
    - 健康检查和自动恢复
    """

    def __init__(
        self,
        aria2c_path: Optional[str] = None,
        config_path: Optional[str] = None,
        rpc_port: int = 6800,
        rpc_secret: Optional[str] = None,
        download_dir: Optional[str] = None,
        max_concurrent_downloads: int = 50,
        max_connection_per_server: int = 16,
        min_split_size: str = "1M",
        split: int = 16,
        log_level: str = "notice",
        verbose: bool = True
    ):
        """初始化Aria2进程管理器

        Args:
            aria2c_path: aria2c可执行文件路径（None则自动查找）
            config_path: aria2配置文件路径（None则生成默认配置）
            rpc_port: RPC服务器端口，默认6800
            rpc_secret: RPC密钥（None则不使用密钥,空字符串也表示不使用）
            download_dir: 下载目录（None则使用临时目录）
            max_concurrent_downloads: 最大并发下载数，默认50
            max_connection_per_server: 每个服务器最大连接数，默认16
            min_split_size: 最小分片大小，默认1M
            split: 单文件最大线程数，默认16
            log_level: 日志级别，默认notice
            verbose: 是否显示详细日志，默认True
        """
        self.verbose = verbose
        self.rpc_port = rpc_port
        # 不使用rpc-secret(本地开发环境)
        # 如果需要使用secret,请显式传入rpc_secret参数
        self.rpc_secret = rpc_secret if rpc_secret is not None else ""

        # 查找aria2c可执行文件
        self.aria2c_path = aria2c_path or self._find_aria2c()
        if not self.aria2c_path:
            raise FileNotFoundError(
                "未找到aria2c可执行文件。请安装aria2c或指定aria2c_path参数。\n"
                "安装方法：\n"
                "  Windows: scoop install aria2 或从 https://github.com/aria2/aria2/releases 下载\n"
                "  Linux: apt install aria2 或 yum install aria2\n"
                "  MacOS: brew install aria2"
            )

        self._log(f"使用aria2c: {self.aria2c_path}")

        # 配置文件路径
        if config_path:
            self.config_path = Path(config_path)
        else:
            # 默认放在项目根目录
            project_root = Path(__file__).resolve().parent.parent.parent
            self.config_path = project_root / "aria2/aria2.conf"

        # 下载目录
        if download_dir:
            self.download_dir = Path(download_dir)
        else:
            # 默认使用项目根目录下的downloads文件夹
            project_root = Path(__file__).resolve().parent.parent.parent
            self.download_dir = project_root / "downloads"

        self.download_dir.mkdir(parents=True, exist_ok=True)

        # Aria2配置参数
        self.config = {
            "rpc_port": rpc_port,
            "rpc_secret": self.rpc_secret,
            "download_dir": str(self.download_dir),
            "max_concurrent_downloads": max_concurrent_downloads,
            "max_connection_per_server": max_connection_per_server,
            "min_split_size": min_split_size,
            "split": split,
            "log_level": log_level,
        }

        # 进程对象
        self.process: Optional[subprocess.Popen] = None
        self.health_check_task: Optional[asyncio.Task] = None

    def _log(self, message: str) -> None:
        """输出日志"""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S")
            # 处理Windows控制台编码问题
            try:
                print(f"[Aria2Manager {timestamp}] {message}")
            except UnicodeEncodeError:
                # 替换特殊符号为ASCII兼容字符
                safe_message = message.replace("✓", "[OK]").replace("✗", "[FAIL]").replace("⚠", "[WARN]")
                print(f"[Aria2Manager {timestamp}] {safe_message}")

    def _find_aria2c(self) -> Optional[str]:
        """自动查找系统中的aria2c可执行文件

        查找顺序：
        1. config.json中的ARIA2_PATH配置
        2. 项目resources目录（打包的aria2c）
        3. 系统PATH环境变量
        4. 常见安装路径

        Returns:
            aria2c可执行文件的绝对路径，未找到返回None
        """
        project_root = Path(__file__).resolve().parent.parent.parent

        # 1. 检查config.json中的ARIA2_PATH配置
        config_path = project_root / "config.json"
        if config_path.exists():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    aria2_path = config.get("ARIA2_PATH")
                    if aria2_path:
                        # 查找aria2.exe或aria2c
                        aria2_dir = Path(aria2_path)
                        if sys.platform == "win32":
                            exe_path = aria2_dir / "aria2c.exe"
                        else:
                            exe_path = aria2_dir / "aria2c"

                        if exe_path.exists():
                            self._log(f"从config.json找到aria2c: {exe_path}")
                            return str(exe_path)
                        elif aria2_dir.exists():
                            # 也许直接指向的就是可执行文件
                            if aria2_dir.is_file():
                                self._log(f"从config.json找到aria2c: {aria2_dir}")
                                return str(aria2_dir)
            except (json.JSONDecodeError, IOError, KeyError) as e:
                self._log(f"读取config.json失败: {e}")

        # 2. 检查项目resources目录
        resources_dir = project_root / "resources"

        if sys.platform == "win32":
            bundled_path = resources_dir / "aria2c.exe"
        else:
            bundled_path = resources_dir / "aria2c"

        if bundled_path.exists():
            self._log(f"找到打包的aria2c: {bundled_path}")
            return str(bundled_path)

        # 3. 使用shutil.which在PATH中查找
        aria2c = shutil.which("aria2c")
        if aria2c:
            self._log(f"在PATH中找到aria2c: {aria2c}")
            return aria2c

        # 4. 检查常见安装路径（Windows）
        if sys.platform == "win32":
            common_paths = [
                Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "aria2" / "aria2c.exe",
                Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")) / "aria2" / "aria2c.exe",
                Path(os.environ.get("LOCALAPPDATA", "")) / "aria2" / "aria2c.exe",
            ]

            for path in common_paths:
                if path.exists():
                    self._log(f"在常见路径找到aria2c: {path}")
                    return str(path)

        self._log("未找到aria2c可执行文件")
        return None

    def generate_config(self) -> None:
        """生成aria2.conf配置文件"""
        # RPC配置部分
        rpc_config = f"""# RPC配置
enable-rpc=true
rpc-listen-all=false
rpc-listen-port={self.config['rpc_port']}"""

        # 只有当rpc_secret不为空时才添加rpc-secret配置
        if self.config['rpc_secret']:
            rpc_config += f"\nrpc-secret={self.config['rpc_secret']}"

        rpc_config += "\nrpc-allow-origin-all=true"

        config_content = f"""# Aria2配置文件
# 由pyJianYingDraftServer自动生成于 {datetime.now().isoformat()}

{rpc_config}

# 下载配置
dir={self.config['download_dir']}
max-concurrent-downloads={self.config['max_concurrent_downloads']}
max-connection-per-server={self.config['max_connection_per_server']}
min-split-size={self.config['min_split_size']}
split={self.config['split']}
continue=true
check-integrity=true

# 网络配置
timeout=60
connect-timeout=30
max-tries=5
retry-wait=3

# 日志配置
log-level={self.config['log_level']}
console-log-level=warn

# 性能优化
file-allocation=falloc
disk-cache=64M
enable-mmap=true

# 其他选项
auto-file-renaming=true
allow-overwrite=false
"""

        with open(self.config_path, "w", encoding="utf-8") as f:
            f.write(config_content)

        self._log(f"已生成配置文件: {self.config_path}")

    def start(self, enable_debug_output: bool = False) -> bool:
        """启动aria2c进程

        Args:
            enable_debug_output: 是否启用调试输出（将aria2c的stdout/stderr输出到终端）

        Returns:
            bool: 启动成功返回True，失败返回False
        """
        if self.is_running():
            self._log("Aria2进程已在运行")
            # 即使进程在运行，也要验证RPC连接
            if self._verify_rpc_connection():
                return True
            else:
                self._log("⚠ Aria2进程运行中但RPC连接失败，尝试重启...")
                self.stop()

        # 生成配置文件（如果不存在）
        if not self.config_path.exists():
            self.generate_config()

        try:
            # 构建启动命令
            cmd = [
                str(self.aria2c_path),
                f"--conf-path={self.config_path}"
            ]

            self._log(f"执行命令: {' '.join(cmd)}")

            # 启动进程（后台运行，不显示窗口）
            if sys.platform == "win32":
                # Windows: 使用CREATE_NO_WINDOW标志隐藏窗口
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE

                if enable_debug_output:
                    # 调试模式：输出到终端
                    self.process = subprocess.Popen(
                        cmd,
                        startupinfo=startupinfo,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                else:
                    # 正常模式：静默运行
                    self.process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        startupinfo=startupinfo,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
            else:
                # Linux/MacOS
                if enable_debug_output:
                    self.process = subprocess.Popen(
                        cmd,
                        start_new_session=True
                    )
                else:
                    self.process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True
                    )

            self._log(f"Aria2进程已启动 (PID: {self.process.pid})")

            # 等待并验证启动成功
            return self._wait_for_startup()

        except Exception as e:
            self._log(f"✗ 启动Aria2进程时出错: {e}")
            import traceback
            if self.verbose:
                traceback.print_exc()
            return False

    def _wait_for_startup(self, max_retries: int = 15, retry_interval: float = 1.0) -> bool:
        """等待aria2c启动并验证RPC连接

        Args:
            max_retries: 最大重试次数
            retry_interval: 重试间隔（秒）

        Returns:
            bool: 启动成功返回True，失败返回False
        """
        import time

        self._log(f"等待Aria2启动并验证RPC连接...")

        for attempt in range(1, max_retries + 1):
            time.sleep(retry_interval)

            # 检查进程是否还在运行
            if not self.is_running():
                self._log(f"✗ Aria2进程意外退出 (尝试 {attempt}/{max_retries})")
                return False

            # 验证RPC连接
            if self._verify_rpc_connection():
                self._log(f"✓ Aria2启动成功 (PID: {self.process.pid}, RPC端口: {self.rpc_port})")
                return True

            if attempt < max_retries:
                self._log(f"RPC连接未就绪，重试中... ({attempt}/{max_retries})")

        self._log(f"✗ Aria2启动失败：RPC连接超时 ({max_retries * retry_interval}秒)")
        return False

    def _verify_rpc_connection(self) -> bool:
        """验证aria2 RPC连接是否可用

        Returns:
            bool: 连接成功返回True，失败返回False
        """
        try:
            import aria2p

            # 创建临时客户端进行连接测试
            # 注意: aria2p.Client的host参数只需要协议+域名,不包含路径
            test_client = aria2p.Client(
                host=f"http://localhost",
                port=self.rpc_port,
                secret=self.rpc_secret if self.rpc_secret else "",  # 空字符串表示无密钥
                timeout=10  # 设置超时时间
            )

            # 尝试获取版本信息（轻量级测试）
            version = test_client.get_version()
            if self.verbose:
                self._log(f"✓ RPC连接成功 (Aria2 版本: {version['version']})")

            return True

        except ImportError:
            self._log("⚠ 警告: aria2p未安装，无法验证RPC连接")
            return True  # 如果没有aria2p，假设连接成功
        except ConnectionError as e:
            # 连接错误，RPC服务未就绪
            print(e)
            return False
        except Exception as e:
            # 其他错误（JSON解析错误等），可能是服务还未完全启动
            error_msg = str(e)
            print(error_msg)
            if "Expecting value" in error_msg or "Connection" in error_msg:
                # JSON解析错误或连接问题，服务还未就绪
                return False
            else:
                # 其他未知错误，记录详细信息
                if self.verbose:
                    self._log(f"RPC连接测试出现异常: {type(e).__name__}: {e}")
                return False

    def stop(self) -> bool:
        """停止aria2c进程

        Returns:
            bool: 停止成功返回True，失败返回False
        """
        if not self.is_running():
            self._log("Aria2进程未运行")
            return True

        try:
            if self.process:
                self.process.terminate()

                # 等待进程结束（最多5秒）
                try:
                    self.process.wait(timeout=5)
                    self._log("✓ Aria2进程已停止")
                    return True
                except subprocess.TimeoutExpired:
                    # 强制结束
                    self.process.kill()
                    self.process.wait()
                    self._log("✓ Aria2进程已强制停止")
                    return True
        except Exception as e:
            self._log(f"✗ 停止Aria2进程时出错: {e}")
            return False

    def restart(self) -> bool:
        """重启aria2c进程

        Returns:
            bool: 重启成功返回True，失败返回False
        """
        self._log("正在重启Aria2进程...")
        self.stop()
        import time
        time.sleep(1)
        return self.start()

    def is_running(self) -> bool:
        """检查aria2c进程是否在运行

        Returns:
            bool: 进程运行中返回True，否则返回False
        """
        if self.process is None:
            return False

        # 检查进程状态
        return_code = self.process.poll()
        return return_code is None

    async def health_check_loop(self, interval: int = 30) -> None:
        """健康检查后台任务

        定期检查aria2c进程状态，如果发现进程异常退出则自动重启

        Args:
            interval: 检查间隔（秒），默认30秒
        """
        self._log(f"启动健康检查任务 (间隔: {interval}秒)")

        while True:
            try:
                await asyncio.sleep(interval)

                if not self.is_running():
                    self._log("⚠ 检测到Aria2进程异常退出，正在自动重启...")
                    if self.start():
                        self._log("✓ Aria2进程已自动恢复")
                    else:
                        self._log("✗ Aria2进程恢复失败")

            except asyncio.CancelledError:
                self._log("健康检查任务已停止")
                break
            except Exception as e:
                self._log(f"健康检查时出错: {e}")

    def start_health_check(self, interval: int = 30) -> None:
        """启动健康检查后台任务

        Args:
            interval: 检查间隔（秒），默认30秒
        """
        if self.health_check_task is not None:
            self._log("健康检查任务已在运行")
            return

        try:
            loop = asyncio.get_running_loop()
            self.health_check_task = loop.create_task(self.health_check_loop(interval))
        except RuntimeError:
            # 没有运行中的事件循环
            self._log("警告: 无法启动健康检查任务（需要asyncio事件循环）")

    def stop_health_check(self) -> None:
        """停止健康检查后台任务"""
        if self.health_check_task is not None:
            self.health_check_task.cancel()
            self.health_check_task = None
            self._log("健康检查任务已停止")

    def get_rpc_url(self) -> str:
        """获取RPC服务器URL

        Returns:
            str: RPC URL，格式如 http://localhost:6800/jsonrpc
        """
        return f"http://localhost:{self.rpc_port}/jsonrpc"

    def get_rpc_secret(self) -> str:
        """获取RPC密钥

        Returns:
            str: RPC密钥
        """
        return self.rpc_secret

    def __del__(self):
        """析构函数：确保进程被正确清理"""
        if hasattr(self, 'health_check_task'):
            self.stop_health_check()
        if hasattr(self, 'process') and self.is_running():
            self.stop()


# 全局单例
_global_manager: Optional[Aria2ProcessManager] = None


def get_aria2_manager(
    aria2c_path: Optional[str] = None,
    config_path: Optional[str] = None,
    **kwargs
) -> Aria2ProcessManager:
    """获取全局Aria2进程管理器单例

    Args:
        aria2c_path: aria2c可执行文件路径（仅首次调用时生效）
        config_path: 配置文件路径（仅首次调用时生效）
        **kwargs: 其他初始化参数

    Returns:
        Aria2ProcessManager: 全局管理器实例
    """
    global _global_manager

    if _global_manager is None:
        _global_manager = Aria2ProcessManager(
            aria2c_path=aria2c_path,
            config_path=config_path,
            **kwargs
        )

    return _global_manager
