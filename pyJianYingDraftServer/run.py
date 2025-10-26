"""
便捷启动脚本
"""

import sys
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

import uvicorn

if __name__ == "__main__":
    # 检测是否为 PyInstaller 打包环境
    is_frozen = getattr(sys, 'frozen', False)

    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=False if is_frozen else True,  # 打包后禁用热重载
        log_level="info"
    )
