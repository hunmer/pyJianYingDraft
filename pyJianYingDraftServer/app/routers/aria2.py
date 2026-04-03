"""
Aria2下载管理相关路由
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ==================== 请求/响应模型 ====================

class UpdateConfigRequest(BaseModel):
    aria2_path: str


class RetryFailedRequest(BaseModel):
    batch_id: str


# ==================== 下载组管理 ====================

@router.get("/groups")
async def get_download_groups():
    """获取所有下载组列表"""
    try:
        from app.services.task_queue import get_task_queue

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        groups = []
        seen_group_ids = set()

        for task in queue.tasks.values():
            group_id = task.batch_id if task.batch_id else task.task_id

            if group_id not in seen_group_ids:
                seen_group_ids.add(group_id)

                group_info = {
                    'groupId': group_id,
                    'groupName': task.rule_group.get('title', '未命名') if task.rule_group else '未命名',
                    'status': task.status.value,
                    'createdAt': task.created_at.isoformat() if task.created_at else None,
                    'updatedAt': task.updated_at.isoformat() if task.updated_at else None
                }

                # 尝试获取实时批次进度
                batch_progress = None
                if task.batch_id and aria2_client:
                    batch_progress = aria2_client.get_batch_progress(task.batch_id)

                if batch_progress:
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
                    progress = task.progress
                    group_info.update({
                        'totalDownloads': progress.total_files if progress else 0,
                        'completedDownloads': progress.completed_files if progress else 0,
                        'failedDownloads': progress.failed_files if progress else 0,
                        'activeDownloads': progress.active_files if progress else 0,
                        'totalSize': progress.total_size if progress else 0,
                        'downloadedSize': progress.downloaded_size if progress else 0,
                        'progressPercent': progress.progress_percent if progress else 0,
                        'downloadSpeed': 0,
                        'etaSeconds': None
                    })

                groups.append(group_info)

        return {'groups': groups, 'total': len(groups)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/groups/{group_id}/downloads")
async def get_group_downloads(group_id: str):
    """获取指定下载组的下载任务列表"""
    try:
        from app.services.task_queue import get_task_queue

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        # 查找对应任务
        task = None
        for t in queue.tasks.values():
            if t.batch_id == group_id or t.task_id == group_id:
                task = t
                break

        if not task:
            raise HTTPException(status_code=404, detail=f'任务不存在: {group_id}')

        # 获取实时下载进度
        batch_progress = None
        if task.batch_id and aria2_client:
            batch_progress = aria2_client.get_batch_progress(task.batch_id)

        downloads = []

        if batch_progress:
            for download in batch_progress.downloads:
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
            if task.materials:
                for i, material in enumerate(task.materials):
                    material_path = material.get('path', '') or material.get('url', '')
                    is_remote = material_path.startswith(('http://', 'https://'))

                    downloads.append({
                        'gid': f'pending-{i}',
                        'status': 'waiting' if is_remote else 'complete',
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
                        'materialInfo': material
                    })

        return {
            'groupId': group_id,
            'taskStatus': task.status.value,
            'downloads': downloads,
            'total': len(downloads),
            'testData': task.test_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 配置管理 ====================


class Aria2ConfigResponse(BaseModel):
    """Aria2配置响应"""
    aria2_path: str
    rpc_port: int
    rpc_secret: str
    download_dir: str
    max_concurrent_downloads: int


@router.get("/config/download-dir")
async def get_download_dir():
    """
    获取下载目录配置

    Returns:
        下载目录路径
    """
    try:
        from app.services.aria2_controller import get_aria2_controller

        controller = get_aria2_controller()

        return {
            "download_dir": str(controller.download_dir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取下载目录失败: {str(e)}")


# ==================== 新增端点：配置更新 ====================

class RetryFailedRequest(BaseModel):
    batch_id: str


@router.put("/config")
async def update_aria2_config(request: UpdateConfigRequest):
    """更新 Aria2 配置并重启"""
    try:
        from app.services.aria2_controller import get_aria2_controller
        from app.services.task_queue import get_task_queue
        from app.config import update_config

        if not request.aria2_path:
            raise HTTPException(status_code=400, detail="Aria2路径不能为空")

        update_config('ARIA2_PATH', request.aria2_path)

        controller = get_aria2_controller()
        restart_success = controller.restart()
        if not restart_success:
            raise HTTPException(status_code=500, detail="Aria2进程重启失败")

        queue = get_task_queue()
        client_success = queue.reinitialize_aria2_client()
        if not client_success:
            raise HTTPException(status_code=500, detail="Aria2客户端初始化失败")

        return {
            "success": True,
            "message": "Aria2配置已更新并重启成功",
            "aria2Path": request.aria2_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 新增端点：下载控制 ====================

@router.post("/downloads/{gid}/pause")
async def pause_download(gid: str):
    """暂停下载"""
    try:
        from app.services.task_queue import get_task_queue

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            raise HTTPException(status_code=500, detail="Aria2客户端未初始化")

        success = aria2_client.pause_download(gid)
        if not success:
            raise HTTPException(status_code=500, detail="暂停下载失败")

        return {"success": True, "gid": gid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/downloads/{gid}/resume")
async def resume_download(gid: str):
    """恢复下载"""
    try:
        from app.services.task_queue import get_task_queue

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            raise HTTPException(status_code=500, detail="Aria2客户端未初始化")

        success = aria2_client.resume_download(gid)
        if not success:
            raise HTTPException(status_code=500, detail="恢复下载失败")

        return {"success": True, "gid": gid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/downloads/{gid}")
async def remove_download(gid: str):
    """移除下载"""
    try:
        from app.services.task_queue import get_task_queue

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            raise HTTPException(status_code=500, detail="Aria2客户端未初始化")

        success = await aria2_client.cancel_download(gid)
        if not success:
            raise HTTPException(status_code=500, detail="移除下载失败")

        return {"success": True, "gid": gid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/downloads/retry-failed")
async def retry_failed_downloads(request: RetryFailedRequest):
    """重试失败的下载"""
    try:
        from app.services.task_queue import get_task_queue

        queue = get_task_queue()
        aria2_client = queue.aria2_client

        if not aria2_client:
            raise HTTPException(status_code=500, detail="Aria2客户端未初始化")

        batch_progress = aria2_client.get_batch_progress(request.batch_id)
        if not batch_progress:
            raise HTTPException(status_code=404, detail="未找到批次信息")

        failed_gids = [d.gid for d in batch_progress.downloads if d.status == 'error']

        if not failed_gids:
            return {
                "success": True,
                "restarted_count": 0,
                "total_failed": 0,
                "message": "没有失败的下载任务"
            }

        restarted_count = 0
        for gid in failed_gids:
            aria2_client.retry_count[gid] = 0
            new_gid = await aria2_client._restart_failed_download(gid)
            if new_gid:
                restarted_count += 1

        return {
            "success": True,
            "restarted_count": restarted_count,
            "total_failed": len(failed_gids),
            "message": f"已重新启动 {restarted_count}/{len(failed_gids)} 个失败任务"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 原有端点 ====================

@router.get("/config", response_model=Aria2ConfigResponse)
async def get_aria2_config():
    """
    获取完整的Aria2配置信息

    Returns:
        Aria2配置对象
    """
    try:
        from app.services.aria2_controller import get_aria2_controller
        from app.config import get_config

        controller = get_aria2_controller()
        config = controller.get_config()

        return {
            "aria2_path": get_config('ARIA2_PATH', ''),
            "rpc_port": config['rpc_port'],
            "rpc_secret": config['rpc_secret'],
            "download_dir": config['download_dir'],
            "max_concurrent_downloads": config['max_concurrent_downloads']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取Aria2配置失败: {str(e)}")


@router.delete("/groups/{group_id}")
async def delete_download_group(group_id: str):
    """
    删除指定的下载组

    Args:
        group_id: 下载组ID

    Returns:
        删除结果
    """
    try:
        from app.services.task_queue import get_task_queue
        from app.db import get_database

        queue = get_task_queue()
        db = await get_database()

        # 查找对应的任务
        task = None
        for t in queue.tasks.values():
            if t.batch_id == group_id or t.task_id == group_id:
                task = t
                break

        if not task:
            raise HTTPException(status_code=404, detail=f"下载组不存在: {group_id}")

        # 从任务队列中删除
        if task.task_id in queue.tasks:
            del queue.tasks[task.task_id]

        # 从数据库中删除
        await db.delete_task(task.task_id)

        return {
            "success": True,
            "message": f"下载组 {group_id} 已删除",
            "task_id": task.task_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除下载组失败: {str(e)}")


@router.post("/groups/clear-all")
async def clear_all_download_groups():
    """
    清空所有下载组

    Returns:
        清空结果
    """
    try:
        from app.services.task_queue import get_task_queue
        from app.db import get_database

        queue = get_task_queue()
        db = await get_database()

        # 获取所有任务ID
        task_ids = list(queue.tasks.keys())
        task_count = len(task_ids)

        # 从数据库中删除所有任务
        deleted_count = 0
        for task_id in task_ids:
            success = await db.delete_task(task_id)
            if success:
                deleted_count += 1

        # 清空内存中的任务队列
        queue.tasks.clear()

        return {
            "success": True,
            "message": f"已清空所有下载组",
            "deleted_count": deleted_count,
            "memory_cleared": task_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空下载组失败: {str(e)}")
