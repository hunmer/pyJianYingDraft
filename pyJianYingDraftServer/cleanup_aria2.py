"""
清理所有运行中的 aria2c 进程

在服务器启动前运行此脚本,确保没有遗留的 aria2c 进程
"""

import sys
import io
import subprocess

# 设置标准输出/错误流为UTF-8编码(解决Windows GBK编码问题)
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def cleanup_aria2_windows():
    """Windows 平台清理"""
    try:
        # 查找所有 aria2c.exe 进程
        result = subprocess.run(
            ['tasklist', '|', 'findstr', 'aria2c.exe'],
            shell=True,
            capture_output=True,
            text=True
        )

        if 'aria2c.exe' in result.stdout:
            print("检测到运行中的 aria2c 进程，正在清理...")

            # 强制杀死所有 aria2c.exe 进程
            subprocess.run(
                ['taskkill', '//F', '//IM', 'aria2c.exe'],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            print("✓ 已清理所有 aria2c 进程")
        else:
            print("✓ 没有运行中的 aria2c 进程")

        return True

    except Exception as e:
        print(f"✗ 清理失败: {e}")
        return False


def cleanup_aria2_unix():
    """Linux/MacOS 平台清理"""
    try:
        # 查找所有 aria2c 进程
        result = subprocess.run(
            ['pgrep', '-f', 'aria2c'],
            capture_output=True,
            text=True
        )

        if result.stdout.strip():
            print("检测到运行中的 aria2c 进程，正在清理...")

            # 杀死所有 aria2c 进程
            subprocess.run(
                ['pkill', '-9', 'aria2c'],
                check=False
            )

            print("✓ 已清理所有 aria2c 进程")
        else:
            print("✓ 没有运行中的 aria2c 进程")

        return True

    except Exception as e:
        print(f"✗ 清理失败: {e}")
        return False


def cleanup_aria2():
    """根据平台清理 aria2c 进程"""
    print("=" * 60)
    print("清理 aria2c 进程")
    print("=" * 60)

    if sys.platform == 'win32':
        success = cleanup_aria2_windows()
    else:
        success = cleanup_aria2_unix()

    print("=" * 60)
    return success


if __name__ == "__main__":
    cleanup_aria2()
