"""
Aria2下载管理相关路由
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


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
        from app.services.aria2_manager import get_aria2_manager

        manager = get_aria2_manager()

        return {
            "download_dir": str(manager.download_dir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取下载目录失败: {str(e)}")


@router.get("/config", response_model=Aria2ConfigResponse)
async def get_aria2_config():
    """
    获取完整的Aria2配置信息

    Returns:
        Aria2配置对象
    """
    try:
        from app.services.aria2_manager import get_aria2_manager
        from app.config import get_config

        manager = get_aria2_manager()

        return {
            "aria2_path": get_config('ARIA2_PATH', ''),
            "rpc_port": manager.rpc_port,
            "rpc_secret": manager.rpc_secret if manager.rpc_secret else '',
            "download_dir": str(manager.download_dir),
            "max_concurrent_downloads": manager.config.get('max_concurrent_downloads', 50)
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
