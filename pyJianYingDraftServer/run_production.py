"""
生产环境启动脚本
用于打包后的可执行文件运行
"""

import sys
from pathlib import Path

# 将父目录添加到 Python 路径,以便导入 pyJianYingDraft 模块
parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

import uvicorn

if __name__ == "__main__":
    # 生产环境配置:禁用热重载
    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # 生产环境禁用热重载
        log_level="info",
        access_log=True
    )
