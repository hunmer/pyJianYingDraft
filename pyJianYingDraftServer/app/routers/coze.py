"""
Coze API 路由
提供工作流、任务管理和插件数据接收功能
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.coze_models import (
    CozeSendDataRequest,
    CozeSendDataResponse,
    Task,
    CreateTaskRequest,
    UpdateTaskRequest,
    ExecuteTaskRequest,
    ExecuteTaskResponse,
    TaskListResponse,
    TaskStatistics,
    TaskStatus,
    ExecutionStatus,
)
from app.services.coze_service import get_coze_service
from app.services.coze_workflow_service import get_workflow_service
from app.services.coze_client import get_coze_client

router = APIRouter()


# ==================== 插件数据接收（保留原有功能） ====================

@router.post("/send-data", response_model=CozeSendDataResponse, summary="Coze插件数据接收")
async def send_coze_data(request: CozeSendDataRequest):
    """
    接收来自Coze插件的数据

    - **api_base**: Coze插件的API基础URL
    - **client_id**: 客户端唯一标识
    - **data**: 要发送的数据，包含type和data字段

    数据接收后会通过WebSocket转发给对应clientId的订阅客户端
    """
    try:
        coze_service = get_coze_service()
        response = await coze_service.receive_data(request)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"处理Coze数据时发生错误: {str(e)}"
        )


@router.get("/stats", summary="获取Coze服务统计信息")
async def get_coze_stats():
    """
    获取Coze服务的统计信息

    返回包括：
    - 总订阅数
    - 总接收数据数
    - 总转发数据数
    - 当前活跃连接数
    """
    try:
        coze_service = get_coze_service()
        stats = coze_service.get_stats()

        return {
            "success": True,
            "data": stats,
            "message": "获取统计信息成功"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取统计信息时发生错误: {str(e)}"
        )


@router.get("/health", summary="Coze服务健康检查")
async def health_check():
    """检查Coze服务是否正常运行"""
    try:
        coze_service = get_coze_service()
        stats = coze_service.get_stats()

        return {
            "status": "healthy",
            "service": "coze",
            "stats": stats
        }

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Coze服务不可用: {str(e)}"
        )


# ==================== 工作空间管理 ====================

@router.get("/workspaces", summary="获取工作空间列表")
async def get_workspaces(account_id: str = Query(default="default", description="账号ID")):
    """
    获取工作空间列表

    - **account_id**: 账号ID（默认为 default）
    """
    try:
        client = get_coze_client(account_id)
        if not client:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 Coze 客户端（账号: {account_id}），请检查配置"
            )

        workspaces = await client.list_workspaces()

        return {
            "success": True,
            "workspaces": workspaces,
            "count": len(workspaces)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取工作空间列表失败: {str(e)}"
        )


# ==================== 工作流管理 ====================

@router.get("/workflows/{workflow_id}", summary="获取工作流详情")
async def get_workflow(
    workflow_id: str,
    account_id: str = Query(default="default", description="账号ID")
):
    """
    获取工作流详情

    - **workflow_id**: 工作流ID
    - **account_id**: 账号ID
    """
    try:
        client = get_coze_client(account_id)
        if not client:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 Coze 客户端（账号: {account_id}），请检查配置"
            )

        workflow = await client.retrieve_workflow(workflow_id)

        return {
            "success": True,
            "workflow": workflow
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取工作流详情失败: {str(e)}"
        )


@router.get("/workflows/{workflow_id}/history", summary="获取工作流执行历史")
async def get_workflow_history(
    workflow_id: str,
    account_id: str = Query(default="default", description="账号ID"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    page_index: int = Query(default=1, ge=1, description="页码")
):
    """
    获取工作流执行历史

    - **workflow_id**: 工作流ID
    - **account_id**: 账号ID
    - **page_size**: 每页数量（1-100）
    - **page_index**: 页码（从1开始）
    """
    try:
        client = get_coze_client(account_id)
        if not client:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 Coze 客户端（账号: {account_id}），请检查配置"
            )

        history = await client.get_execution_history(
            workflow_id=workflow_id,
            page_size=page_size,
            page_index=page_index
        )

        return {
            "success": True,
            **history
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取执行历史失败: {str(e)}"
        )


# ==================== 任务管理 ====================

@router.get("/tasks", response_model=TaskListResponse, summary="获取任务列表")
async def get_tasks(
    workflow_id: Optional[str] = Query(default=None, description="工作流ID筛选"),
    status: Optional[TaskStatus] = Query(default=None, description="任务状态筛选"),
    execution_status: Optional[ExecutionStatus] = Query(default=None, description="执行状态筛选"),
    limit: int = Query(default=50, ge=1, le=200, description="限制返回数量"),
    offset: int = Query(default=0, ge=0, description="偏移量")
):
    """
    获取任务列表，支持筛选和分页

    - **workflow_id**: 按工作流ID筛选
    - **status**: 按任务状态筛选
    - **execution_status**: 按执行状态筛选
    - **limit**: 限制返回数量（1-200）
    - **offset**: 偏移量
    """
    try:
        service = get_workflow_service()
        result = await service.list_tasks(
            workflow_id=workflow_id,
            status=status,
            execution_status=execution_status,
            limit=limit,
            offset=offset
        )

        return TaskListResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务列表时发生错误: {str(e)}"
        )


@router.get("/tasks/statistics", response_model=TaskStatistics, summary="获取任务统计")
async def get_task_statistics(
    workflow_id: Optional[str] = Query(default=None, description="工作流ID筛选")
):
    """
    获取任务统计信息

    - **workflow_id**: 按工作流ID筛选统计
    """
    try:
        service = get_workflow_service()
        stats = await service.get_task_statistics(workflow_id=workflow_id)

        return TaskStatistics(**stats)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务统计时发生错误: {str(e)}"
        )


@router.get("/tasks/{task_id}", response_model=Task, summary="获取单个任务")
async def get_task(task_id: str):
    """获取指定任务的详细信息"""
    try:
        service = get_workflow_service()
        task = await service.get_task(task_id)

        if not task:
            raise HTTPException(
                status_code=404,
                detail=f"任务 {task_id} 不存在"
            )

        return task

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务时发生错误: {str(e)}"
        )


@router.post("/tasks", response_model=Task, summary="创建任务")
async def create_task(
    request: CreateTaskRequest,
    account_id: str = Query(default="default", description="账号ID")
):
    """
    创建新任务（不执行）

    - **name**: 任务名称（可选，默认使用工作流名称）
    - **description**: 任务描述
    - **workflow_id**: 工作流ID
    - **workflow_name**: 工作流名称（可选）
    - **input_parameters**: 输入参数
    - **tags**: 标签
    - **priority**: 优先级
    - **metadata**: 扩展元数据
    """
    try:
        service = get_workflow_service()
        task = await service.create_task(request, account_id=account_id)

        return task

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"创建任务时发生错误: {str(e)}"
        )


@router.put("/tasks/{task_id}", response_model=Task, summary="更新任务")
async def update_task(task_id: str, request: UpdateTaskRequest):
    """
    更新任务信息

    支持部分更新，只更新提供的字段
    """
    try:
        service = get_workflow_service()
        task = await service.update_task(task_id, request)

        return task

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新任务时发生错误: {str(e)}"
        )


@router.delete("/tasks/{task_id}", summary="删除任务")
async def delete_task(task_id: str):
    """删除指定任务"""
    try:
        service = get_workflow_service()
        success = await service.delete_task(task_id)

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"任务 {task_id} 不存在"
            )

        return {
            "success": True,
            "message": f"任务 {task_id} 已删除"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除任务时发生错误: {str(e)}"
        )


@router.post("/tasks/execute", response_model=ExecuteTaskResponse, summary="执行任务")
async def execute_task(
    request: ExecuteTaskRequest,
    account_id: str = Query(default="default", description="账号ID")
):
    """
    执行工作流任务（真实调用 Coze API）

    - **task_id**: 任务ID（可选，不携带则生成新任务）
    - **workflow_id**: 工作流ID
    - **input_parameters**: 输入参数（可选，使用任务存储的参数）
    - **save_as_task**: 是否保存为任务（默认true）
    - **task_name**: 任务名称（保存为任务时使用）
    - **task_description**: 任务描述

    **注意**: 此接口会真实调用 Coze API 执行工作流，并自动管理任务状态
    """
    try:
        service = get_workflow_service()
        response = await service.execute_task(request, account_id=account_id)

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"执行任务时发生错误: {str(e)}"
        )
