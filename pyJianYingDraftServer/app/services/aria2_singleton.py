"""
Aria2 单例守护者

使用文件锁和 PID 文件确保全局只有一个 aria2c 进程,
即使在热重载、多进程、多线程环境下也能保证唯一性
"""

import os
import sys
import json
import psutil
import signal
from pathlib import Path
from typing import Optional
from datetime import datetime

# Windows 和 Unix 的锁实现不同
if sys.platform == 'win32':
    import msvcrt
else:
    import fcntl


class Aria2Singleton:
    """Aria2 单例守护者

    使用文件系统级别的锁确保全局唯一性:
    1. 锁文件: .aria2.lock (防止并发启动)
    2. PID 文件: .aria2.pid (记录当前进程)
    3. 端口文件: .aria2.port (记录当前端口)
    """

    def __init__(self, base_dir: Optional[Path] = None):
        """初始化单例守护者

        Args:
            base_dir: 锁文件存储目录,默认为项目根目录
        """
        if base_dir is None:
            if getattr(sys, 'frozen', False):
                base_dir = Path(sys.executable).parent
            else:
                base_dir = Path(__file__).resolve().parent.parent.parent

        self.lock_dir = base_dir / ".aria2_locks"
        self.lock_dir.mkdir(exist_ok=True)

        self.lock_file = self.lock_dir / "aria2.lock"
        self.pid_file = self.lock_dir / "aria2.pid"
        self.port_file = self.lock_dir / "aria2.port"

        self._lock_fd = None

    def acquire_lock(self, port: int, timeout: float = 10) -> bool:
        """获取全局锁

        Args:
            port: 要使用的端口号
            timeout: 超时时间(秒)

        Returns:
            bool: 获取成功返回 True
        """
        import time

        start_time = time.time()

        while True:
            try:
                # 尝试打开锁文件(如果不存在则创建)
                self._lock_fd = open(self.lock_file, 'w')

                # Windows 不支持 fcntl,使用 msvcrt
                if sys.platform == 'win32':
                    import msvcrt
                    msvcrt.locking(self._lock_fd.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    # Linux/MacOS 使用 fcntl
                    fcntl.flock(self._lock_fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

                # 成功获取锁,写入端口信息
                self.port_file.write_text(str(port))
                self._log(f"✓ 获取全局锁成功 (端口: {port})")
                return True

            except (IOError, OSError) as e:
                # 锁已被占用
                if time.time() - start_time > timeout:
                    self._log(f"✗ 获取锁超时 ({timeout}秒)")
                    return False

                # 检查是否是相同端口
                if self.port_file.exists():
                    try:
                        existing_port = int(self.port_file.read_text().strip())
                        if existing_port == port:
                            self._log(f"检测到端口 {port} 已被锁定,可能已有进程运行")
                            return False
                    except:
                        pass

                # 等待一段时间后重试
                time.sleep(0.1)

    def release_lock(self):
        """释放全局锁"""
        if self._lock_fd:
            try:
                if sys.platform == 'win32':
                    import msvcrt
                    msvcrt.locking(self._lock_fd.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(self._lock_fd.fileno(), fcntl.LOCK_UN)

                self._lock_fd.close()
                self._lock_fd = None

                # 清理 PID 和端口文件
                self.pid_file.unlink(missing_ok=True)
                self.port_file.unlink(missing_ok=True)

                self._log("✓ 释放全局锁成功")
            except Exception as e:
                self._log(f"释放锁时出错: {e}")

    def register_process(self, pid: int, port: int):
        """注册 aria2c 进程

        Args:
            pid: 进程 PID
            port: RPC 端口
        """
        data = {
            "pid": pid,
            "port": port,
            "started_at": datetime.now().isoformat()
        }

        self.pid_file.write_text(json.dumps(data, indent=2))
        self._log(f"✓ 注册进程 PID={pid}, 端口={port}")

    def get_registered_process(self) -> Optional[dict]:
        """获取已注册的进程信息

        Returns:
            dict 或 None: 包含 pid, port, started_at 的字典
        """
        if not self.pid_file.exists():
            return None

        try:
            data = json.loads(self.pid_file.read_text())

            # 验证进程是否仍在运行
            pid = data.get("pid")
            if pid and psutil.pid_exists(pid):
                return data
            else:
                # 进程已不存在,清理文件
                self.pid_file.unlink(missing_ok=True)
                return None
        except Exception as e:
            self._log(f"读取 PID 文件失败: {e}")
            return None

    def kill_registered_process(self) -> bool:
        """杀死已注册的进程

        Returns:
            bool: 成功返回 True
        """
        process_info = self.get_registered_process()
        if not process_info:
            return True

        pid = process_info.get("pid")
        if not pid:
            return True

        try:
            # 使用 psutil 优雅杀死进程树
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)

            # 先杀子进程
            for child in children:
                try:
                    child.terminate()
                except psutil.NoSuchProcess:
                    pass

            # 再杀父进程
            parent.terminate()

            # 等待进程结束(最多5秒)
            gone, alive = psutil.wait_procs([parent] + children, timeout=5)

            # 强制杀死未结束的进程
            for p in alive:
                try:
                    p.kill()
                except psutil.NoSuchProcess:
                    pass

            self._log(f"✓ 已杀死进程 PID={pid}")
            return True

        except psutil.NoSuchProcess:
            self._log(f"进程 PID={pid} 不存在")
            return True
        except Exception as e:
            self._log(f"✗ 杀死进程失败: {e}")
            return False

    def cleanup_all(self):
        """清理所有锁文件和已注册进程"""
        self.kill_registered_process()
        self.release_lock()

        # 清理所有锁文件
        for f in [self.lock_file, self.pid_file, self.port_file]:
            f.unlink(missing_ok=True)

        self._log("✓ 清理完成")

    def _log(self, message: str):
        """输出日志"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[Aria2Singleton {timestamp}] {message}")

    def __enter__(self):
        """上下文管理器入口"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口"""
        self.release_lock()


# 全局单例实例
_singleton_instance: Optional[Aria2Singleton] = None


def get_aria2_singleton() -> Aria2Singleton:
    """获取全局单例实例

    Returns:
        Aria2Singleton: 全局单例
    """
    global _singleton_instance

    if _singleton_instance is None:
        _singleton_instance = Aria2Singleton()

    return _singleton_instance
