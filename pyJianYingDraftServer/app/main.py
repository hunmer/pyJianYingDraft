"""
FastAPI 主应用入口
"""

import sys
from pathlib import Path

# 将父目录添加到 Python 路径,以便导入 pyJianYingDraft 模块
parent_dir = Path(__file__).resolve().parent.parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import draft, subdrafts, materials, tracks, files

app = FastAPI(
    title="pyJianYingDraft API",
    description="剪映草稿文件解析和操作API服务",
    version="0.1.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(draft.router, prefix="/api/draft", tags=["草稿基础"])
app.include_router(subdrafts.router, prefix="/api/subdrafts", tags=["复合片段"])
app.include_router(materials.router, prefix="/api/materials", tags=["素材管理"])
app.include_router(tracks.router, prefix="/api/tracks", tags=["轨道管理"])
app.include_router(files.router, prefix="/api/files", tags=["文件服务"])


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "pyJianYingDraft API Server",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
