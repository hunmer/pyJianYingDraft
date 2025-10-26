"""
任务管理HTTP接口

提供任务提交、查询、取消等REST API
"""

import httpx
from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

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
        json_url=task.json_url,
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


@router.api_route("/submit_with_url", methods=["GET", "POST"])
async def submit_task_with_url(url: str = Query(..., description="远程 JSON 数据的 URL 地址")):
    """通过 URL 提交草稿生成任务并重定向到状态页面

    从指定的 URL 获取 JSON 数据,验证后提交任务,然后重定向到任务状态展示页面

    支持 GET 和 POST 请求,方便在浏览器中直接访问

    Args:
        url: 远程 JSON 数据的 URL 地址,必须包含 ruleGroup, materials, testData 等字段

    Returns:
        RedirectResponse: 重定向到任务状态页面

    Raises:
        HTTPException: 当 URL 无效、获取失败或数据格式不正确时
    """
    try:
        # 1. 验证 URL 格式
        if not url:
            raise HTTPException(status_code=400, detail="url 参数不能为空")

        if not url.startswith(('http://', 'https://')):
            raise HTTPException(status_code=400, detail="url 必须是有效的 HTTP/HTTPS 地址")

        # 2. 获取远程 JSON 数据
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"无法获取 URL 内容: HTTP {e.response.status_code}"
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"请求 URL 失败: {str(e)}"
                )

            # 3. 解析 JSON 数据
            try:
                json_data = response.json()
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"URL 返回的内容不是有效的 JSON: {str(e)}"
                )

        # 4. 验证必需字段
        required_fields = ['ruleGroup', 'materials', 'testData']
        missing_fields = [field for field in required_fields if field not in json_data]

        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"JSON 数据缺少必需字段: {', '.join(missing_fields)}"
            )

        # 5. 验证字段类型
        if not isinstance(json_data.get('ruleGroup'), dict):
            raise HTTPException(
                status_code=400,
                detail="ruleGroup 字段必须是对象类型"
            )

        if not isinstance(json_data.get('materials'), list):
            raise HTTPException(
                status_code=400,
                detail="materials 字段必须是数组类型"
            )

        if not isinstance(json_data.get('testData'), dict):
            raise HTTPException(
                status_code=400,
                detail="testData 字段必须是对象类型"
            )

        # 6. 构建任务提交请求
        task_request = TaskSubmitRequest(
            ruleGroup=json_data['ruleGroup'],
            materials=json_data['materials'],
            testData=json_data['testData'],
            segment_styles=json_data.get('segment_styles'),
            use_raw_segments=json_data.get('use_raw_segments', False),
            raw_segments=json_data.get('raw_segments'),
            raw_materials=json_data.get('raw_materials'),
            draft_config=json_data.get('draft_config', {})
        )

        # 7. 提交任务
        queue = get_task_queue()
        task_id = await queue.create_task(task_request)
        task = queue.get_task(task_id)

        if not task:
            raise HTTPException(status_code=500, detail="任务创建失败")

        # 7.1. 保存 JSON URL
        task.json_url = url

        # 8. 保存生成记录
        try:
            import time
            import random
            from app.services.generation_record_service import get_generation_record_service
            from app.models.generation_record_models import GenerationRecordCreateRequest

            # 生成唯一的记录ID
            record_id = f"rec_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"

            # 获取规则组信息
            rule_group = json_data['ruleGroup']
            rule_group_id = rule_group.get('id', '')
            rule_group_title = rule_group.get('title', '未命名规则组')

            # 创建生成记录
            generation_record_service = get_generation_record_service()
            await generation_record_service.create_record(
                GenerationRecordCreateRequest(
                    record_id=record_id,
                    task_id=task_id,
                    rule_group_id=rule_group_id,
                    rule_group_title=rule_group_title,
                    rule_group=rule_group,
                    draft_config=json_data.get('draft_config', {}),
                    materials=json_data.get('materials', []),
                    test_data=json_data.get('testData'),
                    segment_styles=json_data.get('segment_styles'),
                    use_raw_segments=json_data.get('use_raw_segments', False),
                    raw_segments=json_data.get('raw_segments'),
                    raw_materials=json_data.get('raw_materials'),
                )
            )
            print(f"[submit_with_url] 生成记录已保存, record_id: {record_id}, task_id: {task_id}")
        except Exception as e:
            print(f"[submit_with_url] 保存生成记录失败: {e}")
            # 即使保存失败也不影响主流程

        # 9. 重定向到任务状态页面(携带原始 json_url)
        encoded_url = quote(url, safe='')
        return RedirectResponse(
            url=f"/static/task_status.html?task_id={task_id}&json_url={encoded_url}",
            status_code=303  # 303 See Other - POST 后重定向到 GET
        )

    except HTTPException:
        raise
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
