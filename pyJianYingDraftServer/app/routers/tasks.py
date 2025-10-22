"""
任务管理HTTP接口

提供任务提交、查询、取消等REST API
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.download_models import (
    TaskSubmitRequest,
    TaskResponse,
    TaskListResponse,
    TaskCancelResponse,
    TaskStatus,
    DownloadTask
)
from app.services.task_queue import get_task_queue


router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _task_to_response(task: DownloadTask) -> TaskResponse:
    """将DownloadTask转换为TaskResponse"""
    return TaskResponse(
        task_id=task.task_id,
        status=task.status,
        message=_get_status_message(task.status),
        progress=task.progress,
        draft_path=task.draft_path,
        error_message=task.error_message,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at
    )


def _get_status_message(status: TaskStatus) -> str:
    """获取状态对应的消息"""
    messages = {
        TaskStatus.PENDING: "任务等待中",
        TaskStatus.DOWNLOADING: "正在下载素材",
        TaskStatus.PROCESSING: "正在生成草稿",
        TaskStatus.COMPLETED: "任务已完成",
        TaskStatus.FAILED: "任务失败",
        TaskStatus.CANCELLED: "任务已取消"
    }
    return messages.get(status, "未知状态")


@router.post("/submit", response_model=TaskResponse)
async def submit_task(request: TaskSubmitRequest):
    """提交新的草稿生成任务

    Args:
        request: 任务提交请求

    Returns:
        TaskResponse: 任务信息
    """
    try:
        queue = get_task_queue()
        task_id = await queue.create_task(request)
        task = queue.get_task(task_id)

        if not task:
            raise HTTPException(status_code=500, detail="任务创建失败")

        return _task_to_response(task)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提交任务失败: {str(e)}")


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """查询任务状态和进度

    Args:
        task_id: 任务ID

    Returns:
        TaskResponse: 任务信息
    """
    queue = get_task_queue()
    task = queue.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    return _task_to_response(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[TaskStatus] = Query(None, description="状态筛选"),
    limit: int = Query(20, ge=1, le=100, description="每页数量"),
    offset: int = Query(0, ge=0, description="偏移量")
):
    """列出任务

    Args:
        status: 状态筛选（可选）
        limit: 每页数量，默认20
        offset: 偏移量，默认0

    Returns:
        TaskListResponse: 任务列表
    """
    queue = get_task_queue()
    tasks, total = queue.list_tasks(status=status, limit=limit, offset=offset)

    task_responses = [_task_to_response(task) for task in tasks]

    return TaskListResponse(
        tasks=task_responses,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/{task_id}/cancel", response_model=TaskCancelResponse)
async def cancel_task(task_id: str):
    """取消任务

    Args:
        task_id: 任务ID

    Returns:
        TaskCancelResponse: 取消结果
    """
    queue = get_task_queue()
    task = queue.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    success = await queue.cancel_task(task_id)

    if success:
        return TaskCancelResponse(
            success=True,
            message=f"任务 {task_id} 已取消"
        )
    else:
        return TaskCancelResponse(
            success=False,
            message=f"无法取消任务 {task_id}（可能已完成或失败）"
        )
