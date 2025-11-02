"""
便捷启动脚本
"""

import sys
import uvicorn
from pathlib import Path

# 将父目录添加到 Python 路径,以便导入 pyJianYingDraft 模块
if getattr(sys, 'frozen', False):
    # 打包环境：使用 exe 所在目录
    parent_dir = Path(sys.executable).parent
else:
    # 开发环境：使用项目根目录
    parent_dir = Path(__file__).resolve().parent.parent

if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))


if __name__ == "__main__":
    # 检测是否为 PyInstaller 打包环境
    is_frozen = getattr(sys, 'frozen', False)

    # 启动前清理所有 aria2c 进程 (防止热重载导致的多进程)
    try:
        from cleanup_aria2 import cleanup_aria2
        cleanup_aria2()
    except Exception as e:
        print(f"警告: 清理 aria2c 进程失败: {e}")

    # 设置环境变量以确保日志实时输出
    import os
    os.environ["PYTHONUNBUFFERED"] = "1"

    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # ⚠️ 重要: 禁用热重载,防止多个 aria2c 进程
        log_level="info",  # 使用 info 级别减少噪音
        access_log=True,  # 启用访问日志
        use_colors=True,  # 启用彩色日志
        # 使用默认日志配置，避免复杂的自定义配置导致递归
    )
