"""
Coze插件相关的API路由
"""

from fastapi import APIRouter, HTTPException
from app.models.coze_models import (
    CozeSendDataRequest,
    CozeSendDataResponse,
    Task,
    CreateTaskRequest,
    UpdateTaskRequest,
    ExecuteTaskRequest,
    ExecuteTaskResponse,
    TaskFilter,
    TaskListResponse,
    TaskStatistics,
    TaskStatus,
    ExecutionStatus,
)
from app.services.coze_service import get_coze_service

router = APIRouter()


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


# ==================== 任务管理API ====================

# 内存存储任务数据（生产环境应使用数据库）
_tasks_storage: dict[str, Task] = {}
_task_counter = 0


def _generate_task_id() -> str:
    """生成任务ID"""
    global _task_counter
    _task_counter += 1
    return f"task_{_task_counter}_{int(__import__('time').time() * 1000)}"


def _get_task_or_404(task_id: str) -> Task:
    """获取任务或抛出404异常"""
    if task_id not in _tasks_storage:
        raise HTTPException(
            status_code=404,
            detail=f"任务 {task_id} 不存在"
        )
    return _tasks_storage[task_id]


@router.get("/tasks", response_model=TaskListResponse, summary="获取任务列表")
async def get_tasks(
    workflow_id: str | None = None,
    status: TaskStatus | None = None,
    execution_status: ExecutionStatus | None = None,
    limit: int = 50,
    offset: int = 0
):
    """
    获取任务列表，支持筛选和分页

    - **workflow_id**: 按工作流ID筛选
    - **status**: 按任务状态筛选
    - **execution_status**: 按执行状态筛选
    - **limit**: ���制返回数量
    - **offset**: 偏移量
    """
    try:
        # 筛选任务
        filtered_tasks = []
        for task in _tasks_storage.values():
            if workflow_id and task.workflow_id != workflow_id:
                continue
            if status and task.status != status:
                continue
            if execution_status and task.execution_status != execution_status:
                continue
            filtered_tasks.append(task)

        # 按创建时间倒序排序
        filtered_tasks.sort(key=lambda t: t.created_at, reverse=True)

        # 分页
        total = len(filtered_tasks)
        tasks = filtered_tasks[offset:offset + limit]
        has_more = offset + limit < total

        return TaskListResponse(
            tasks=tasks,
            total=total,
            has_more=has_more
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务列表时发生错误: {str(e)}"
        )


@router.get("/tasks/statistics", response_model=TaskStatistics, summary="获取任务统计")
async def get_task_statistics(workflow_id: str | None = None):
    """
    获取任务统计信息

    - **workflow_id**: 按工作流ID筛选统计
    """
    try:
        # 筛选任务
        tasks = list(_tasks_storage.values())
        if workflow_id:
            tasks = [t for t in tasks if t.workflow_id == workflow_id]

        # 统计信息
        total = len(tasks)
        by_status = {}
        by_execution_status = {}
        by_workflow = {}

        # 按状态统计
        for status in TaskStatus:
            by_status[status.value] = len([t for t in tasks if t.status == status])

        # 按执行状态统计
        for exec_status in ExecutionStatus:
            by_execution_status[exec_status.value] = len([t for t in tasks if t.execution_status == exec_status])

        # 按工作流统计
        for task in tasks:
            workflow_name = task.workflow_name
            by_workflow[workflow_name] = by_workflow.get(workflow_name, 0) + 1

        # 最近执行的任务（最多10个）
        recent_executions = [
            t for t in tasks
            if t.executed_at is not None
        ]
        recent_executions.sort(key=lambda t: t.executed_at, reverse=True)
        recent_executions = recent_executions[:10]

        return TaskStatistics(
            total=total,
            by_status=by_status,
            by_execution_status=by_execution_status,
            by_workflow=by_workflow,
            recent_executions=recent_executions
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务统计时发生错误: {str(e)}"
        )


@router.get("/tasks/{task_id}", response_model=Task, summary="获取单个任务")
async def get_task(task_id: str):
    """获取指定任务的详细信息"""
    try:
        task = _get_task_or_404(task_id)
        return task
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务时发生错误: {str(e)}"
        )


@router.post("/tasks", response_model=Task, summary="创建任务")
async def create_task(request: CreateTaskRequest):
    """
    创建新任务

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
        task_id = _generate_task_id()
        task_name = request.name or request.workflow_name or f"任务_{task_id}"

        task = Task(
            id=task_id,
            name=task_name,
            description=request.description,
            workflow_id=request.workflow_id,
            workflow_name=request.workflow_name or request.workflow_id,
            input_parameters=request.input_parameters,
            tags=request.tags,
            priority=request.priority,
            metadata=request.metadata
        )

        _tasks_storage[task_id] = task

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
        task = _get_task_or_404(task_id)

        # 更新字段
        update_data = request.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        # 更新时间戳
        from datetime import datetime
        task.updated_at = datetime.now()

        _tasks_storage[task_id] = task
        return task

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新任务时发生错误: {str(e)}"
        )


@router.delete("/tasks/{task_id}", summary="删除任务")
async def delete_task(task_id: str):
    """删除指定任务"""
    try:
        _get_task_or_404(task_id)
        del _tasks_storage[task_id]

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
async def execute_task(request: ExecuteTaskRequest):
    """
    执行工作流任务

    - **task_id**: 任务ID（可选，不携带则生成新任务）
    - **workflow_id**: 工作流ID
    - **input_parameters**: 输入参数（可选，使用任务存储的参数）
    - **save_as_task**: 是否保存为任务（默认true）
    - **task_name**: 任务名称（保存为任务时使用）
    - **task_description**: 任务描述
    """
    try:
        from datetime import datetime
        import uuid

        execution_id = str(uuid.uuid4())
        task_id = None
        task = None

        # 如果指定了任务ID，加载现有任务
        if request.task_id:
            task = _get_task_or_404(request.task_id)
            task_id = task.id
            # 更新任务状态为执行中
            task.status = TaskStatus.EXECUTING
            task.execution_status = ExecutionStatus.PENDING
            task.executed_at = datetime.now()
            task.updated_at = datetime.now()
        # 如果需要保存为新任务
        elif request.save_as_task:
            # 创建新任务
            task_id = _generate_task_id()
            task_name = request.task_name or f"执行任务_{task_id}"

            task = Task(
                id=task_id,
                name=task_name,
                description=request.task_description,
                workflow_id=request.workflow_id,
                workflow_name=request.workflow_id,
                input_parameters=request.input_parameters or {},
                status=TaskStatus.EXECUTING,
                execution_status=ExecutionStatus.PENDING,
                executed_at=datetime.now()
            )

            _tasks_storage[task_id] = task

        # 这里应该调用实际的工作流执行逻辑
        # 暂时模拟执行过程
        if task:
            # 模拟异步执行（实际应该使用后台任务）
            # 这里立即标记为成功，实际应该通过WebSocket或其他方式异步更新状态
            task.status = TaskStatus.COMPLETED
            task.execution_status = ExecutionStatus.SUCCESS
            task.completed_at = datetime.now()
            task.coze_execution_id = execution_id
            task.output_data = {"message": "执行成功", "execution_id": execution_id}

        return ExecuteTaskResponse(
            task_id=task_id,
            execution_id=execution_id,
            status="success",
            message="任务执行已启动"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"执行任务时发生错误: {str(e)}"
        )


@router.get("/tasks/statistics", response_model=TaskStatistics, summary="获取任务统计")
async def get_task_statistics(workflow_id: str | None = None):
    """
    获取任务统计信息

    - **workflow_id**: 按工作流ID筛选统计
    """
    try:
        # 筛选任务
        tasks = list(_tasks_storage.values())
        if workflow_id:
            tasks = [t for t in tasks if t.workflow_id == workflow_id]

        # 统计信息
        total = len(tasks)
        by_status = {}
        by_execution_status = {}
        by_workflow = {}

        # 按状态统计
        for status in TaskStatus:
            by_status[status.value] = len([t for t in tasks if t.status == status])

        # 按执行状态统计
        for exec_status in ExecutionStatus:
            by_execution_status[exec_status.value] = len([t for t in tasks if t.execution_status == exec_status])

        # 按工作流统计
        for task in tasks:
            workflow_name = task.workflow_name
            by_workflow[workflow_name] = by_workflow.get(workflow_name, 0) + 1

        # 最近执行的任务（最多10个）
        recent_executions = [
            t for t in tasks
            if t.executed_at is not None
        ]
        recent_executions.sort(key=lambda t: t.executed_at, reverse=True)
        recent_executions = recent_executions[:10]

        return TaskStatistics(
            total=total,
            by_status=by_status,
            by_execution_status=by_execution_status,
            by_workflow=by_workflow,
            recent_executions=recent_executions
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取任务统计时发生错误: {str(e)}"
        )