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
import socketio

from app.routers import draft, subdrafts, materials, tracks, files, rules, file_watch

# 创建Socket.IO服务器
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

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
app.include_router(rules.router, prefix="/api/rules", tags=["规则测试"])
app.include_router(file_watch.router, prefix="/api/file-watch", tags=["文件监控"])

# 注入Socket.IO实例到文件版本管理器
from app.services.file_watch_service import get_file_version_manager
file_manager = get_file_version_manager()
file_manager.sio = sio

# WebSocket事件处理
@sio.event
async def connect(sid, environ):
    """客户端连接事件"""
    print(f"客户端已连接: {sid}")

@sio.event
async def disconnect(sid):
    """客户端断开连接事件"""
    print(f"客户端已断开: {sid}")

@sio.event
async def get_file_versions(sid, data):
    """获取文件版本列表"""
    try:
        file_path = data.get('file_path')
        if not file_path:
            await sio.emit('file_versions_error', {'error': '文件路径不能为空'}, room=sid)
            return

        from app.services.file_watch_service import get_file_version_manager
        manager = get_file_version_manager()
        result = manager.get_versions(file_path)

        await sio.emit('file_versions', {
            'file_path': result.file_path,
            'versions': [
                {
                    'version': v.version,
                    'timestamp': v.timestamp.isoformat() if hasattr(v.timestamp, 'isoformat') else str(v.timestamp),
                    'file_size': v.file_size,
                    'file_hash': v.file_hash
                }
                for v in result.versions
            ]
        }, room=sid)
    except Exception as e:
        await sio.emit('file_versions_error', {'error': str(e)}, room=sid)

@sio.event
async def get_version_content(sid, data):
    """获取指定版本的文件内容"""
    try:
        file_path = data.get('file_path')
        version = data.get('version')

        if not file_path or version is None:
            await sio.emit('version_content_error', {'error': '文件路径和版本号不能为空'}, room=sid)
            return

        from app.services.file_watch_service import get_file_version_manager
        manager = get_file_version_manager()
        result = manager.get_version_content(file_path, version)

        await sio.emit('version_content', {
            'file_path': result.file_path,
            'version': result.version,
            'content': result.content,
            'timestamp': result.timestamp.isoformat() if hasattr(result.timestamp, 'isoformat') else str(result.timestamp),
            'file_size': result.file_size
        }, room=sid)
    except Exception as e:
        await sio.emit('version_content_error', {'error': str(e)}, room=sid)

# 将Socket.IO集成到FastAPI
socket_app = socketio.ASGIApp(sio, app)


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
