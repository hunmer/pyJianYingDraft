"""
FastAPI 主应用入口
"""

import sys
import io
import logging
import uuid
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

# 设置标准输出/错误流为UTF-8编码(解决Windows GBK编码问题)
# 延迟执行，避免在某些环境下引起递归错误
try:
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
except Exception:
    # 如果设置失败，使用默认配置
    pass

# 最小化日志配置 - 避免与其他库冲突
try:
    # 只配置我们应用的日志，不影响其他库
    logger = logging.getLogger("pyJianYingDraft")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    logger.propagate = False  # 防止传播到根日志记录器
except Exception:
    # 如果配置失败，跳过自定义日志配置
    pass

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
from fastapi.staticfiles import StaticFiles
import socketio

from app.routers import draft, subdrafts, materials, tracks, files, rules, file_watch, tasks, aria2, generation_records, coze

# 创建Socket.IO服务器 - 简化日志配置
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,  # 禁用 Socket.IO 日志避免递归
    engineio_logger=False  # 禁用 Engine.IO 日志避免递归
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # ==================== 启动事件 ====================
    def flush_logs():
        """强制刷新日志缓冲区 - 简化版本避免递归"""
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass  # 忽略刷新错误

    print("=" * 60)
    print("🚀 pyJianYingDraft API Server 启动中...")
    print("=" * 60)
    flush_logs()  # 立即刷新输出

    # 启动Aria2进程管理器
    try:
        from app.services.aria2_manager import get_aria2_manager
        manager = get_aria2_manager()

        if manager.start():
            print(f"✓ Aria2进程已启动")
            print(f"  - RPC URL: {manager.get_rpc_url()}")
            print(f"  - 下载目录: {manager.download_dir}")
            flush_logs()  # 刷新输出

            # 启动健康检查
            manager.start_health_check(interval=30)
            print(f"✓ Aria2健康检查已启动（间隔: 30秒）")
            flush_logs()  # 刷新输出
        else:
            print("⚠ Aria2进程启动失败，异步下载功能将不可用")
            flush_logs()  # 刷新输出
    except Exception as e:
        print(f"✗ Aria2初始化失败: {e}")
        flush_logs()  # 刷新输出

    # 初始化数据库
    try:
        from app.db import get_database
        await get_database()
        print(f"✓ 数据库已初始化")
        flush_logs()  # 刷新输出
    except Exception as e:
        print(f"✗ 数据库初始化失败: {e}")
        flush_logs()  # 刷新输出

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
            flush_logs()  # 刷新输出
        else:
            print(f"⚠ 任务队列启动失败，Aria2客户端可能未初始化")
            flush_logs()  # 刷新输出

        # 从数据库加载历史任务
        await queue.load_tasks_from_db()
        flush_logs()  # 刷新异步操作输出

        # 启动进度监控
        await queue.start_progress_monitor()
        print(f"✓ 任务队列进度监控已启动（间隔: 1秒）")
        flush_logs()  # 刷新输出
    except Exception as e:
        print(f"✗ 任务队列启动失败: {e}")
        import traceback
        traceback.print_exc()
        flush_logs()  # 刷新输出

    print("=" * 60)
    print("✅ 服务器启动完成！")
    print("📚 API文档: http://localhost:8000/docs")
    print("=" * 60)
    flush_logs()  # 最终刷新输出

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
app.include_router(generation_records.router, tags=["生成记录"])
app.include_router(coze.router, prefix="/api/coze", tags=["Coze插件"])

# 挂载静态文件目录
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    print(f"✓ 静态文件目录已挂载: {static_dir}")

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

    # 清理Coze订阅
    try:
        from app.services.coze_service import get_coze_service
        coze_service = get_coze_service()
        coze_service.remove_socket_subscriptions(sid)
    except Exception as e:
        print(f"清理Coze订阅失败: {e}")

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

        # 获取所有任务，按 task_id (或 batch_id) 分组
        groups = []
        seen_group_ids = set()

        for task in queue.tasks.values():
            # 使用 batch_id 如果存在，否则使用 task_id 作为组ID
            group_id = task.batch_id if task.batch_id else task.task_id

            if group_id not in seen_group_ids:
                seen_group_ids.add(group_id)

                # 基础组信息
                group_info = {
                    'groupId': group_id,
                    'groupName': task.rule_group.get('title', '未命名') if task.rule_group else '未命名',
                    'status': task.status.value,
                    'createdAt': task.created_at.isoformat() if task.created_at else None,
                    'updatedAt': task.updated_at.isoformat() if task.updated_at else None
                }

                # 尝试获取批次进度（如果任务已经开始下载且Aria2在运行）
                batch_progress = None
                if task.batch_id and aria2_client:
                    batch_progress = aria2_client.get_batch_progress(task.batch_id)

                # 如果有实时批次进度，使用实时数据；否则使用任务中保存的进度
                if batch_progress:
                    # 使用Aria2实时数据
                    group_info.update({
                        'totalDownloads': len(batch_progress.downloads),
                        'completedDownloads': batch_progress.completed_count,
                        'failedDownloads': batch_progress.failed_count,
                        'activeDownloads': batch_progress.active_count,
                        'totalSize': batch_progress.total_size,
                        'downloadedSize': batch_progress.downloaded_size,
                        'progressPercent': batch_progress.progress_percent,
                        'downloadSpeed': batch_progress.total_speed,
                        'etaSeconds': batch_progress.eta_seconds
                    })
                else:
                    # 使用数据库中保存的进度信息（服务器重启后的情况）
                    progress = task.progress
                    group_info.update({
                        'totalDownloads': progress.total_files if progress else 0,
                        'completedDownloads': progress.completed_files if progress else 0,
                        'failedDownloads': progress.failed_files if progress else 0,
                        'activeDownloads': progress.active_files if progress else 0,
                        'totalSize': progress.total_size if progress else 0,
                        'downloadedSize': progress.downloaded_size if progress else 0,
                        'progressPercent': progress.progress_percent if progress else 0,
                        'downloadSpeed': 0,  # 服务器重启后无实时速度
                        'etaSeconds': None   # 服务器重启后无预计时间
                    })

                groups.append(group_info)

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

        # 先尝试通过 group_id 找到对应的任务
        task = None
        for t in queue.tasks.values():
            if t.batch_id == group_id or t.task_id == group_id:
                task = t
                break

        if not task:
            await sio.emit('group_downloads_error', {'error': f'任务不存在: {group_id}'}, room=sid)
            return

        # 如果任务有 batch_id，尝试获取实时下载进度
        batch_progress = None
        if task.batch_id and aria2_client:
            batch_progress = aria2_client.get_batch_progress(task.batch_id)

        # 转换下载信息
        downloads = []

        if batch_progress:
            # 有实时下载进度，返回 Aria2 的下载列表
            for download in batch_progress.downloads:
                # 构建文件信息（包含真实路径）
                files = []
                if download.file_path:
                    files.append({
                        'path': download.file_path,
                        'length': download.total_length,
                        'completedLength': download.completed_length,
                        'selected': 'true',
                        'uris': []
                    })

                downloads.append({
                    'gid': download.gid,
                    'status': download.status,
                    'totalLength': download.total_length,
                    'completedLength': download.completed_length,
                    'uploadLength': 0,
                    'downloadSpeed': download.download_speed,
                    'uploadSpeed': download.upload_speed,
                    'files': files,
                    'errorCode': download.error_code,
                    'errorMessage': download.error_message
                })
        elif task.download_files:
            # 服务器重启后，从数据库中保存的 download_files 恢复下载列表
            for file_info in task.download_files:
                downloads.append({
                    'gid': file_info.gid,
                    'status': file_info.status,
                    'totalLength': file_info.total_length,
                    'completedLength': file_info.completed_length,
                    'uploadLength': 0,
                    'downloadSpeed': 0,
                    'uploadSpeed': 0,
                    'files': [{
                        'path': file_info.file_path,
                        'length': file_info.total_length,
                        'completedLength': file_info.completed_length,
                        'selected': 'true',
                        'uris': []
                    }],
                    'errorCode': file_info.error_code or '',
                    'errorMessage': file_info.error_message or ''
                })
        else:
            # 任务还未开始下载（pending状态），返回任务的素材列表
            if task.materials:
                for i, material in enumerate(task.materials):
                    # 检查素材是否需要下载（有 HTTP/HTTPS URL）
                    material_path = material.get('path', '') or material.get('url', '')
                    is_remote = material_path.startswith(('http://', 'https://'))

                    downloads.append({
                        'gid': f'pending-{i}',  # 临时GID
                        'status': 'waiting' if is_remote else 'complete',  # 本地文件视为已完成
                        'totalLength': 0,
                        'completedLength': 0,
                        'uploadLength': 0,
                        'downloadSpeed': 0,
                        'uploadSpeed': 0,
                        'files': [{
                            'path': material_path,
                            'length': 0,
                            'completedLength': 0,
                            'selected': 'true',
                            'uris': []
                        }],
                        'errorCode': '',
                        'errorMessage': '',
                        'materialInfo': material  # 添加素材完整信息
                    })

        await sio.emit('group_downloads', {
            'groupId': group_id,
            'taskStatus': task.status.value,  # 添加任务状态
            'downloads': downloads,
            'total': len(downloads),
            'testData': task.test_data  # 添加testData
        }, room=sid)

    except Exception as e:
        await sio.emit('group_downloads_error', {'error': str(e)}, room=sid)

@sio.event
async def get_aria2_config(sid, data):
    """获取 Aria2 配置"""
    try:
        from app.services.aria2_controller import get_aria2_controller
        from app.config import get_config

        controller = get_aria2_controller()
        aria2_config = controller.get_config()

        config = {
            'aria2Path': get_config('ARIA2_PATH', ''),
            'rpcPort': aria2_config['rpc_port'],
            'rpcSecret': aria2_config['rpc_secret'],
            'downloadDir': aria2_config['download_dir'],
            'maxConcurrentDownloads': aria2_config['max_concurrent_downloads']
        }

        await sio.emit('aria2_config', config, room=sid)

    except Exception as e:
        await sio.emit('aria2_config_error', {'error': str(e)}, room=sid)

@sio.event
async def update_aria2_config(sid, data):
    """更新 Aria2 配置并重启"""
    try:
        from app.services.aria2_controller import get_aria2_controller
        from app.services.task_queue import get_task_queue
        from app.config import update_config

        aria2_path = data.get('aria2_path')
        if not aria2_path:
            await sio.emit('update_aria2_config_error', {'error': 'Aria2路径不能为空'}, room=sid)
            return

        # 更新配置
        update_config('ARIA2_PATH', aria2_path)

        # 重启 Aria2 进程
        controller = get_aria2_controller()
        restart_success = controller.restart()

        if not restart_success:
            await sio.emit('update_aria2_config_error', {'error': 'Aria2进程重启失败'}, room=sid)
            return

        # 重新初始化 Aria2 客户端
        queue = get_task_queue()
        client_success = queue.reinitialize_aria2_client()

        if client_success:
            await sio.emit('aria2_config_updated', {
                'message': 'Aria2配置已更新并重启成功,客户端已重新初始化',
                'aria2Path': aria2_path
            }, room=sid)
        else:
            await sio.emit('update_aria2_config_error', {'error': 'Aria2客户端初始化失败'}, room=sid)

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

@sio.event
async def retry_failed_downloads(sid, data):
    """重新下载失败的任务"""
    try:
        batch_id = data.get('batch_id')
        if not batch_id:
            await sio.emit('retry_failed_error', {'error': '批次ID不能为空'}, room=sid)
            return

        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            await sio.emit('retry_failed_error', {'error': 'Aria2客户端未初始化'}, room=sid)
            return

        # 获取批次进度
        batch_progress = aria2_client.get_batch_progress(batch_id)
        if not batch_progress:
            await sio.emit('retry_failed_error', {'error': '未找到批次信息'}, room=sid)
            return

        # 筛选失败的下载
        failed_gids = [d.gid for d in batch_progress.downloads if d.status == 'error']

        if not failed_gids:
            await sio.emit('retry_failed_completed', {
                'batch_id': batch_id,
                'restarted_count': 0,
                'message': '没有失败的下载任务'
            }, room=sid)
            return

        # 重启失败的下载
        restarted_count = 0
        for gid in failed_gids:
            # 重置重试计数
            aria2_client.retry_count[gid] = 0
            new_gid = await aria2_client._restart_failed_download(gid)
            if new_gid:
                restarted_count += 1

        await sio.emit('retry_failed_completed', {
            'batch_id': batch_id,
            'restarted_count': restarted_count,
            'total_failed': len(failed_gids),
            'message': f'已重新启动 {restarted_count}/{len(failed_gids)} 个失败任务'
        }, room=sid)

    except Exception as e:
        await sio.emit('retry_failed_error', {'error': str(e)}, room=sid)

# ==================== Coze 插件 WebSocket 事件 ====================

@sio.event
async def subscribe_coze_data(sid, data):
    """订阅Coze数据推送"""
    try:
        from app.models.coze_models import CozeSubscribeRequest
        from app.services.coze_service import get_coze_service

        # 验证请求数据
        client_id = data.get('client_id')
        if not client_id:
            await sio.emit('coze_subscribe_error', {
                'error': 'client_id不能为空'
            }, room=sid)
            return

        workflow_id = data.get('workflow_id')

        # 创建订阅请求
        request = CozeSubscribeRequest(
            client_id=client_id,
            workflow_id=workflow_id
        )

        # 执行订阅
        coze_service = get_coze_service()
        response = await coze_service.subscribe(request, sid)

        if response.success:
            await sio.emit('coze_subscribed', {
                'success': True,
                'client_id': response.client_id,
                'message': response.message,
                'subscribed_at': response.subscribed_at.isoformat() if response.subscribed_at else None
            }, room=sid)

            # 立即推送待发送的数据
            await _push_pending_coze_data(coze_service, sid, client_id)
        else:
            await sio.emit('coze_subscribe_error', {
                'error': response.message,
                'client_id': client_id
            }, room=sid)

    except Exception as e:
        print(f"Coze订阅失败: {e}")
        await sio.emit('coze_subscribe_error', {
            'error': str(e)
        }, room=sid)


@sio.event
async def unsubscribe_coze_data(sid, data):
    """取消订阅Coze数据推送"""
    try:
        from app.models.coze_models import CozeUnsubscribeRequest
        from app.services.coze_service import get_coze_service

        # 验证请求数据
        client_id = data.get('client_id')
        if not client_id:
            await sio.emit('coze_unsubscribe_error', {
                'error': 'client_id不能为空'
            }, room=sid)
            return

        # 创建取消订阅请求
        request = CozeUnsubscribeRequest(client_id=client_id)

        # 执行取消订阅
        coze_service = get_coze_service()
        response = await coze_service.unsubscribe(request, sid)

        await sio.emit('coze_unsubscribed', {
            'success': response.success,
            'client_id': response.client_id,
            'message': response.message,
            'unsubscribed_at': response.unsubscribed_at.isoformat() if response.unsubscribed_at else None
        }, room=sid)

    except Exception as e:
        print(f"Coze取消订阅失败: {e}")
        await sio.emit('coze_unsubscribe_error', {
            'error': str(e)
        }, room=sid)


async def _push_pending_coze_data(coze_service, socket_id: str, client_id: str):
    """推送待发送的Coze数据"""
    try:
        pending_data = coze_service.get_pending_data(client_id)

        if not pending_data:
            return

        for cache_item in pending_data:
            # 构建推送数据
            push_data = {
                'id': cache_item.id,
                'client_id': cache_item.client_id,
                'data': {
                    'type': cache_item.data.type.value,
                    'data': cache_item.data.data,
                    'clientId': cache_item.data.client_id,
                    'timestamp': cache_item.data.timestamp.isoformat() if cache_item.data.timestamp else None
                },
                'received_at': cache_item.received_at.isoformat(),
                'is_read': False
            }

            # 推送数据
            await sio.emit('coze_data_update', push_data, room=socket_id)

            # 标记为已转发
            coze_service.mark_data_forwarded(cache_item.id, client_id)

            print(f"Coze数据推送: cache_id={cache_item.id}, client_id={client_id}, type={cache_item.data.type}")

    except Exception as e:
        print(f"推送Coze数据失败: {e}")


async def broadcast_coze_data_to_subscribers(client_id: str, coze_data):
    """向订阅指定client_id的所有客户端广播数据"""
    try:
        from app.services.coze_service import get_coze_service
        coze_service = get_coze_service()

        # 获取所有活跃订阅
        subscriptions = coze_service.get_active_subscriptions(client_id)

        if not subscriptions:
            return

        # 向每个订阅的Socket连接推送数据
        for subscription in subscriptions:
            try:
                push_data = {
                    'id': str(uuid.uuid4()),
                    'client_id': client_id,
                    'workflow_id': subscription.workflow_id,
                    'data': {
                        'type': coze_data.type.value,
                        'data': coze_data.data,
                        'clientId': coze_data.client_id,
                        'timestamp': coze_data.timestamp.isoformat() if coze_data.timestamp else None
                    },
                    'received_at': datetime.now().isoformat(),
                    'is_read': False
                }

                await sio.emit('coze_data_update', push_data, room=subscription.socket_id)
                print(f"Coze数据广播: client_id={client_id}, socket_id={subscription.socket_id}, type={coze_data.type}")

            except Exception as e:
                print(f"向Socket推送Coze数据失败: {e}")

    except Exception as e:
        print(f"广播Coze数据失败: {e}")


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


@app.post("/shutdown")
async def shutdown():
    """优雅关闭服务器和所有子进程"""
    import asyncio
    import signal

    print("\n" + "=" * 60)
    print("📥 收到关闭请求,正在执行优雅关闭...")
    print("=" * 60)

    # 在后台执行关闭流程
    async def shutdown_sequence():
        # 给一点时间让响应返回
        await asyncio.sleep(0.5)

        # 停止任务队列进度监控
        try:
            from app.services.task_queue import get_task_queue
            queue = get_task_queue()
            await queue.stop_progress_monitor()
            print("✓ 任务队列进度监控已停止")
        except Exception as e:
            print(f"✗ 停止任务队列失败: {e}")

        # 停止 Aria2 进程
        try:
            from app.services.aria2_manager import get_aria2_manager
            manager = get_aria2_manager()
            manager.stop_health_check()
            manager.stop()
            print("✓ Aria2进程已停止")
        except Exception as e:
            print(f"✗ 停止Aria2失败: {e}")

        print("=" * 60)
        print("✅ 优雅关闭完成,服务器即将退出")
        print("=" * 60)

        # 发送退出信号
        import os
        os.kill(os.getpid(), signal.SIGTERM)

    # 异步启动关闭序列
    asyncio.create_task(shutdown_sequence())

    return {"status": "shutting down", "message": "服务器正在关闭..."}
