"""
FastAPI 主应用入口
"""

import sys
import io
from pathlib import Path
from contextlib import asynccontextmanager

# 设置标准输出/错误流为UTF-8编码(解决Windows GBK编码问题)
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 将父目录添加到 Python 路径,以便导入 pyJianYingDraft 模块
if getattr(sys, 'frozen', False):
    # 打包环境：使用 exe 所在目录
    parent_dir = Path(sys.executable).parent
else:
    # 开发环境：从 app/main.py 回到项目根目录
    parent_dir = Path(__file__).resolve().parent.parent.parent

if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app.routers import draft, subdrafts, materials, tracks, files, rules, file_watch, tasks, aria2

# 创建Socket.IO服务器
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # ==================== 启动事件 ====================
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

    # 启动任务队列和Aria2客户端
    try:
        from app.services.task_queue import get_task_queue
        queue = get_task_queue()

        # 注入Socket.IO实例以便推送进度
        queue.sio = sio

        # 启动任务队列(初始化Aria2客户端)
        if queue.start():
            print(f"✓ 任务队列已启动")
            print(f"  - Aria2客户端已初始化")
        else:
            print(f"⚠ 任务队列启动失败，Aria2客户端可能未初始化")

        # 启动进度监控
        await queue.start_progress_monitor()
        print(f"✓ 任务队列进度监控已启动（间隔: 1秒）")
    except Exception as e:
        print(f"✗ 任务队列启动失败: {e}")
        import traceback
        traceback.print_exc()

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

    yield

    # ==================== 关闭事件 ====================
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


app = FastAPI(
    title="pyJianYingDraft API",
    description="剪映草稿文件解析和操作API服务",
    version="0.1.0",
    lifespan=lifespan
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
app.include_router(aria2.router, prefix="/api/aria2", tags=["Aria2下载管理"])

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

# ==================== Aria2 下载管理 WebSocket 事件 ====================

@sio.event
async def get_aria2_groups(sid, data):
    """获取所有下载组列表"""
    try:
        from app.services.task_queue import get_task_queue
        from app.services.aria2_client import get_aria2_client

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            await sio.emit('aria2_groups_error', {'error': 'Aria2客户端未初始化'}, room=sid)
            return

        # 获取所有任务，按 batch_id (group) 分组
        groups = []
        seen_batch_ids = set()

        for task in queue.tasks.values():
            if task.batch_id and task.batch_id not in seen_batch_ids:
                seen_batch_ids.add(task.batch_id)

                # 获取批次进度
                batch_progress = aria2_client.get_batch_progress(task.batch_id)
                if batch_progress:
                    groups.append({
                        'groupId': task.batch_id,
                        'groupName': task.rule_group.get('title', '未命名') if task.rule_group else '未命名',
                        'totalDownloads': len(batch_progress.downloads),
                        'completedDownloads': batch_progress.completed_count,
                        'failedDownloads': batch_progress.failed_count,
                        'activeDownloads': batch_progress.active_count,
                        'totalSize': batch_progress.total_size,
                        'downloadedSize': batch_progress.downloaded_size,
                        'progressPercent': batch_progress.progress_percent,
                        'downloadSpeed': batch_progress.total_speed,
                        'etaSeconds': batch_progress.eta_seconds,
                        'createdAt': task.created_at.isoformat() if task.created_at else None,
                        'updatedAt': task.updated_at.isoformat() if task.updated_at else None
                    })

        await sio.emit('aria2_groups', {
            'groups': groups,
            'total': len(groups)
        }, room=sid)

    except Exception as e:
        await sio.emit('aria2_groups_error', {'error': str(e)}, room=sid)

@sio.event
async def get_group_downloads(sid, data):
    """获取指定组的下载任务列表"""
    try:
        group_id = data.get('group_id')
        if not group_id:
            await sio.emit('group_downloads_error', {'error': '组ID不能为空'}, room=sid)
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            await sio.emit('group_downloads_error', {'error': 'Aria2客户端未初始化'}, room=sid)
            return

        # 获取批次进度
        batch_progress = aria2_client.get_batch_progress(group_id)
        if not batch_progress:
            await sio.emit('group_downloads_error', {'error': f'组不存在: {group_id}'}, room=sid)
            return

        # 转换下载信息
        downloads = []
        for download in batch_progress.downloads:
            downloads.append({
                'gid': download.gid,
                'status': download.status,
                'totalLength': download.total_length,
                'completedLength': download.completed_length,
                'uploadLength': 0,
                'downloadSpeed': download.download_speed,
                'uploadSpeed': download.upload_speed,
                'files': [],  # aria2p没有提供详细文件信息，这里简化
                'errorCode': download.error_code,
                'errorMessage': download.error_message
            })

        await sio.emit('group_downloads', {
            'groupId': group_id,
            'downloads': downloads,
            'total': len(downloads)
        }, room=sid)

    except Exception as e:
        await sio.emit('group_downloads_error', {'error': str(e)}, room=sid)

@sio.event
async def get_aria2_config(sid, data):
    """获取 Aria2 配置"""
    try:
        from app.services.aria2_manager import get_aria2_manager
        from app.config import get_config

        manager = get_aria2_manager()

        config = {
            'aria2Path': get_config('ARIA2_PATH', ''),
            'rpcPort': manager.rpc_port,
            'rpcSecret': manager.rpc_secret if manager.rpc_secret else '',
            'downloadDir': str(manager.download_dir),
            'maxConcurrentDownloads': manager.config.get('max_concurrent_downloads', 50)
        }

        await sio.emit('aria2_config', config, room=sid)

    except Exception as e:
        await sio.emit('aria2_config_error', {'error': str(e)}, room=sid)

@sio.event
async def update_aria2_config(sid, data):
    """更新 Aria2 配置并重启"""
    try:
        from app.services.aria2_manager import get_aria2_manager
        from app.config import update_config

        aria2_path = data.get('aria2_path')
        if not aria2_path:
            await sio.emit('update_aria2_config_error', {'error': 'Aria2路径不能为空'}, room=sid)
            return

        # 更新配置
        update_config('ARIA2_PATH', aria2_path)

        # 重启 Aria2
        manager = get_aria2_manager()
        success = manager.restart()

        if success:
            await sio.emit('aria2_config_updated', {
                'message': 'Aria2配置已更新并重启成功',
                'aria2Path': aria2_path
            }, room=sid)
        else:
            await sio.emit('update_aria2_config_error', {'error': 'Aria2重启失败'}, room=sid)

    except Exception as e:
        await sio.emit('update_aria2_config_error', {'error': str(e)}, room=sid)

@sio.event
async def pause_download(sid, data):
    """暂停下载"""
    try:
        gid = data.get('gid')
        if not gid:
            await sio.emit('pause_download_error', {'error': 'GID不能为空'}, room=sid)
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            await sio.emit('pause_download_error', {'error': 'Aria2客户端未初始化'}, room=sid)
            return

        success = aria2_client.pause_download(gid)
        if success:
            await sio.emit('download_paused', {'gid': gid}, room=sid)
        else:
            await sio.emit('pause_download_error', {'error': '暂停下载失败'}, room=sid)

    except Exception as e:
        await sio.emit('pause_download_error', {'error': str(e)}, room=sid)

@sio.event
async def resume_download(sid, data):
    """恢复下载"""
    try:
        gid = data.get('gid')
        if not gid:
            await sio.emit('resume_download_error', {'error': 'GID不能为空'}, room=sid)
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            await sio.emit('resume_download_error', {'error': 'Aria2客户端未初始化'}, room=sid)
            return

        success = aria2_client.resume_download(gid)
        if success:
            await sio.emit('download_resumed', {'gid': gid}, room=sid)
        else:
            await sio.emit('resume_download_error', {'error': '恢复下载失败'}, room=sid)

    except Exception as e:
        await sio.emit('resume_download_error', {'error': str(e)}, room=sid)

@sio.event
async def remove_download(sid, data):
    """移除下载"""
    try:
        gid = data.get('gid')
        if not gid:
            await sio.emit('remove_download_error', {'error': 'GID不能为空'}, room=sid)
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            await sio.emit('remove_download_error', {'error': 'Aria2客户端未初始化'}, room=sid)
            return

        success = await aria2_client.cancel_download(gid)
        if success:
            await sio.emit('download_removed', {'gid': gid}, room=sid)
        else:
            await sio.emit('remove_download_error', {'error': '移除下载失败'}, room=sid)

    except Exception as e:
        await sio.emit('remove_download_error', {'error': str(e)}, room=sid)

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
