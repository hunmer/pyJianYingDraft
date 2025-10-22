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

from app.routers import draft, subdrafts, materials, tracks, files, rules, file_watch, tasks

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
app.include_router(tasks.router, tags=["异步任务"])

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

# ==================== 异步任务WebSocket事件 ====================

@sio.event
async def subscribe_task(sid, data):
    """订阅任务进度更新"""
    try:
        task_id = data.get('task_id')
        if not task_id:
            await sio.emit('subscribe_error', {'error': '任务ID不能为空'}, room=sid)
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()

        # 订阅任务
        success = queue.subscribe(task_id, sid)

        if success:
            # 立即发送当前任务状态
            task = queue.get_task(task_id)
            if task:
                await sio.emit('task_subscribed', {
                    'task_id': task_id,
                    'status': task.status.value,
                    'progress': task.progress.model_dump() if task.progress else None
                }, room=sid)
            else:
                await sio.emit('subscribe_error', {'error': f'任务不存在: {task_id}'}, room=sid)
        else:
            await sio.emit('subscribe_error', {'error': f'订阅失败: {task_id}'}, room=sid)
    except Exception as e:
        await sio.emit('subscribe_error', {'error': str(e)}, room=sid)

@sio.event
async def unsubscribe_task(sid, data):
    """取消订阅任务进度更新"""
    try:
        task_id = data.get('task_id')
        if not task_id:
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        queue.unsubscribe(task_id, sid)

        await sio.emit('task_unsubscribed', {'task_id': task_id}, room=sid)
    except Exception as e:
        print(f"取消订阅失败: {e}")

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


# ==================== 应用生命周期事件 ====================

@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    print("=" * 60)
    print("🚀 pyJianYingDraft API Server 启动中...")
    print("=" * 60)

    # 启动Aria2进程管理器
    try:
        from app.services.aria2_manager import get_aria2_manager
        manager = get_aria2_manager()

        if manager.start():
            print(f"✓ Aria2进程已启动")
            print(f"  - RPC URL: {manager.get_rpc_url()}")
            print(f"  - 下载目录: {manager.download_dir}")

            # 启动健康检查
            manager.start_health_check(interval=30)
            print(f"✓ Aria2健康检查已启动（间隔: 30秒）")
        else:
            print("⚠ Aria2进程启动失败，异步下载功能将不可用")
    except Exception as e:
        print(f"✗ Aria2初始化失败: {e}")

    # 启动任务队列进度监控
    try:
        from app.services.task_queue import get_task_queue
        queue = get_task_queue()

        # 注入Socket.IO实例以便推送进度
        queue.sio = sio

        await queue.start_progress_monitor()
        print(f"✓ 任务队列进度监控已启动（间隔: 1秒）")
    except Exception as e:
        print(f"✗ 任务队列启动失败: {e}")

    # 初始化数据库
    try:
        from app.db import get_database
        await get_database()
        print(f"✓ 数据库已初始化")
    except Exception as e:
        print(f"✗ 数据库初始化失败: {e}")

    print("=" * 60)
    print("✅ 服务器启动完成！")
    print("📚 API文档: http://localhost:8000/docs")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    print("\n" + "=" * 60)
    print("🛑 pyJianYingDraft API Server 关闭中...")
    print("=" * 60)

    # 停止任务队列进度监控
    try:
        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        await queue.stop_progress_monitor()
        print("✓ 任务队列进度监控已停止")
    except Exception as e:
        print(f"✗ 停止任务队列失败: {e}")

    # 停止Aria2进程
    try:
        from app.services.aria2_manager import get_aria2_manager
        manager = get_aria2_manager()
        manager.stop_health_check()
        manager.stop()
        print("✓ Aria2进程已停止")
    except Exception as e:
        print(f"✗ 停止Aria2失败: {e}")

    print("=" * 60)
    print("✅ 服务器已关闭")
    print("=" * 60)
