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
from app.services.event_log_service import get_event_log_service

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


# ==================== 账号管理 ====================

@router.get("/accounts", summary="获取账号列表")
async def get_accounts():
    """
    获取所有配置的账号 ID 列表

    返回所有在 config.json 中配置的 Coze 账号
    """
    try:
        from app.services.coze_config import get_config_manager

        config_manager = get_config_manager()
        account_ids = config_manager.get_all_account_ids()

        return {
            "success": True,
            "accounts": account_ids,
            "count": len(account_ids)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取账号列表失败: {str(e)}"
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

@router.get("/workflows", summary="获取工作流列表")
async def get_workflows(
    workspace_id: Optional[str] = Query(default=None, description="工作空间ID"),
    account_id: str = Query(default="default", description="账号ID"),
    page_num: int = Query(default=1, ge=1, description="页码（从1开始）"),
    page_size: int = Query(default=30, ge=1, le=30, description="每页数量（1-30）")
):
    """
    获取工作流列表

    - **workspace_id**: 工作空间ID（可选）
    - **account_id**: 账号ID
    - **page_num**: 页码（从1开始）
    - **page_size**: 每页数量（1-30，Coze API 限制）
    """
    try:
        client = get_coze_client(account_id)
        if not client:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 Coze 客户端（账号: {account_id}），请检查配置"
            )

        result = await client.list_workflows(
            workspace_id=workspace_id,
            page_num=page_num,
            page_size=page_size
        )

        return {
            "success": True,
            **result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取工作流列表失败: {str(e)}"
        )


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


@router.get("/workflows/{workflow_id}/history", summary="获取工作流执行历史列表")
async def get_workflow_history(
    workflow_id: str,
    account_id: str = Query(default="default", description="账号ID"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    page_index: int = Query(default=1, ge=1, description="页码")
):
    """
    获取工作流执行历史列表（从本地存储读取）

    - **workflow_id**: 工作流ID
    - **account_id**: 账号ID（保留参数以兼容，但不再使用）
    - **page_size**: 每页数量（1-100）
    - **page_index**: 页码（从1开始）
    """
    try:
        from app.services.execution_history_service import get_execution_history_service

        history_service = get_execution_history_service()

        history = await history_service.get_execution_history(
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
            detail=f"获取执行历史列表失败: {str(e)}"
        )


@router.get("/workflows/{workflow_id}/history/{execute_id}", summary="获取单个执行记录详情")
async def get_execution_detail(
    workflow_id: str,
    execute_id: str,
    account_id: str = Query(default="default", description="账号ID")
):
    """
    获取单个执行记录的详细信息（从本地存储读取）

    - **workflow_id**: 工作流ID
    - **execute_id**: 执行ID
    - **account_id**: 账号ID（保留参数以兼容，但不再使用）

    返回包含输入输出数据、调试URL等详细信息
    """
    try:
        from app.services.execution_history_service import get_execution_history_service

        history_service = get_execution_history_service()

        detail = await history_service.get_execution_detail(
            workflow_id=workflow_id,
            execute_id=execute_id
        )

        if not detail:
            raise HTTPException(
                status_code=404,
                detail=f"执行记录不存在: {execute_id}"
            )

        return {
            "success": True,
            "execution": detail
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取执行记录详情失败: {str(e)}"
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


@router.post("/workflows/stream_run", summary="流式执行工作流")
async def stream_run_workflow(
    request: dict,
    account_id: str = Query(default="default", description="账号ID")
):
    """
    流式执行工作流（Server-Sent Events）

    请求体格式:
    {
        "workflow_id": "工作流ID",
        "parameters": {"参数名": "参数值"},
        "bot_id": "Bot ID（可选）",
        "conversation_id": "会话ID（可选）",
        "user_id": "用户ID（可选）"
    }

    **注意**: 此接口返回 Server-Sent Events 流，需要使用 EventSource 或 fetch 处理流式响应
    """
    from fastapi.responses import StreamingResponse
    import asyncio
    import json

    def safe_serialize(obj):
        """安全序列化对象，处理不可序列化的类型"""
        if obj is None:
            return None
        elif isinstance(obj, (str, int, float, bool)):
            return obj
        elif isinstance(obj, (list, tuple)):
            return [safe_serialize(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: safe_serialize(value) for key, value in obj.items()}
        elif hasattr(obj, '__dict__'):
            # 对于有 __dict__ 的对象，尝试序列化其属性
            try:
                return {key: safe_serialize(value) for key, value in obj.__dict__.items() if not key.startswith('_')}
            except:
                return str(obj)
        else:
            # 其他类型转换为字符串
            return str(obj)

    try:
        # 获取 Coze 客户端
        client = get_coze_client(account_id)
        if not client:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 Coze 客户端（账号: {account_id}），请检查配置"
            )

        # 提取请求参数
        workflow_id = request.get("workflow_id")
        parameters = request.get("parameters", {})
        bot_id = request.get("bot_id")
        conversation_id = request.get("conversation_id")
        user_id = request.get("user_id")

        if not workflow_id:
            raise HTTPException(
                status_code=400,
                detail="workflow_id 参数是必需的"
            )

        async def generate_events():
            """生成流式事件"""
            from app.services.execution_history_service import get_execution_history_service

            history_service = get_execution_history_service()
            event_log_service = get_event_log_service()
            execution_id = None
            execute_status = "success"
            output_data = {}
            error_message = None
            error_code = None
            workflow_name = None
            
            # 获取工作流名称
            try:
                workflow_detail = await client.retrieve_workflow(workflow_id)
                workflow_name = workflow_detail.get('name', workflow_id)
            except:
                workflow_name = workflow_id

            try:
                # 1. 创建执行记录（工作流开始）
                execution_record = await history_service.create_execution_record(
                    workflow_id=workflow_id,
                    parameters=parameters,
                    bot_id=bot_id,
                    conversation_id=conversation_id
                )
                execution_id = execution_record["execute_id"]

                # 记录工作流开始事件日志
                event_log_service.add_log(
                    event="workflow_started",
                    workflow_id=workflow_id,
                    workflow_name=workflow_name,
                    execute_id=execution_id,
                    level="info",
                    message=f"工作流开始执行",
                    data={
                        "parameters": parameters,
                        "bot_id": bot_id,
                        "conversation_id": conversation_id
                    }
                )

                # 发送工作流开始事件
                start_event = {
                    "event": "workflow_started",
                    "data": {
                        "workflow_id": workflow_id,
                        "parameters": parameters,
                        "execution_id": execution_id
                    },
                    "timestamp": asyncio.get_event_loop().time()
                }
                yield f"data: {json.dumps(start_event)}\n\n"

                # 执行工作流流式调用
                async for event in client.execute_workflow_stream(
                    workflow_id=workflow_id,
                    parameters=parameters,
                    bot_id=bot_id,
                    conversation_id=conversation_id
                ):
                    # 安全地提取事件数据
                    try:
                        event_type = event.event.value if hasattr(event.event, 'value') else str(event.event)
                        event_data = {
                            "event": "data",
                            "data": {
                                "type": event_type,
                                "execute_id": safe_serialize(getattr(event, 'execute_id', None)),
                                "node_id": safe_serialize(getattr(event, 'node_id', None)),
                                "status": safe_serialize(getattr(event, 'status', None)),
                                "message": safe_serialize(getattr(event, 'message', None)),
                                "error": safe_serialize(getattr(event, 'error', None)),
                                "data": safe_serialize(getattr(event, 'data', None))
                            },
                            "timestamp": asyncio.get_event_loop().time()
                        }
                        
                        # 记录流式事件日志
                        event_log_service.add_log(
                            event=event_type,
                            workflow_id=workflow_id,
                            workflow_name=workflow_name,
                            execute_id=execution_id,
                            level="info",
                            message=f"工作流事件: {event_type}",
                            data=event_data["data"]
                        )

                        # 收集输出和错误信息
                        if hasattr(event, "message") and event.message:
                            # 安全地序列化消息对象
                            try:
                                if hasattr(event.message, '__dict__'):
                                    # 如果是对象，提取可序列化的属性
                                    message_data = {}
                                    for attr in ['content', 'role', 'type']:
                                        if hasattr(event.message, attr):
                                            message_data[attr] = getattr(event.message, attr)
                                    output_data["message"] = message_data
                                else:
                                    # 如果是基础类型，直接使用
                                    output_data["message"] = event.message
                            except Exception as msg_error:
                                # 序列化失败时使用字符串形式
                                output_data["message"] = str(event.message)
                                print(f"⚠️ 消息序列化失败，使用字符串形式: {msg_error}")

                        if hasattr(event, "error") and event.error:
                            execute_status = "failed"
                            error_message = str(event.error)
                            error_code = getattr(event, "error_code", None)
                            
                            # 记录错误日志
                            event_log_service.add_log(
                                event="workflow_error",
                                workflow_id=workflow_id,
                                workflow_name=workflow_name,
                                execute_id=execution_id,
                                level="error",
                                message=f"工作流执行错误: {error_message}",
                                data={"error_code": error_code, "error": error_message}
                            )

                        # 记录 Coze API 返回的执行 ID
                        if hasattr(event, "execute_id") and event.execute_id:
                            if event.execute_id != execution_id:
                                await history_service.update_execution_record(
                                    workflow_id=workflow_id,
                                    execute_id=execution_id,
                                    metadata={"coze_execute_id": event.execute_id}
                                )

                    except Exception as serialize_error:
                        # 序列化失败时，发送错误事件但继续执行
                        event_data = {
                            "event": "error",
                            "data": {
                                "message": f"事件序列化失败: {str(serialize_error)}",
                                "type": "serialization_error",
                                "original_event_type": str(type(event).__name__)
                            },
                            "timestamp": asyncio.get_event_loop().time()
                        }

                    # 添加会话ID（如果有）
                    if conversation_id:
                        event_data["conversation_id"] = conversation_id

                    yield f"data: {json.dumps(event_data)}\n\n"

            except Exception as e:
                # 标记为失败
                execute_status = "failed"
                error_message = str(e)
                
                # 记录异常日志
                event_log_service.add_log(
                    event="workflow_exception",
                    workflow_id=workflow_id,
                    workflow_name=workflow_name,
                    execute_id=execution_id,
                    level="error",
                    message=f"工作流执行异常: {error_message}",
                    data={"exception": str(e)}
                )

                # 发送错误事件
                error_event = {
                    "event": "error",
                    "data": {
                        "message": str(e),
                        "type": "execution_error"
                    },
                    "timestamp": asyncio.get_event_loop().time()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
            finally:
                # 2. 更新执行记录（工作流完成）
                if execution_id:
                    await history_service.update_execution_record(
                        workflow_id=workflow_id,
                        execute_id=execution_id,
                        execute_status=execute_status,
                        output=output_data if output_data else None,
                        error_code=error_code,
                        error_message=error_message
                    )
                    
                    # 记录工作流完成日志
                    event_log_service.add_log(
                        event="workflow_finished",
                        workflow_id=workflow_id,
                        workflow_name=workflow_name,
                        execute_id=execution_id,
                        level="success" if execute_status == "success" else "error",
                        message=f"工作流执行{'成功' if execute_status == 'success' else '失败'}",
                        data={
                            "status": execute_status,
                            "output": output_data if output_data else None,
                            "error_message": error_message
                        }
                    )

                # 结束流
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_events(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"流式执行工作流时发生错误: {str(e)}"
        )


@router.post("/workflows/cancel_run", summary="取消工作流执行")
async def cancel_workflow_run(
    request: dict,
    account_id: str = Query(default="default", description="账号ID")
):
    """
    取消工作流执行

    请求体格式:
    {
        "conversation_id": "会话ID"
    }
    """
    try:
        # 获取 Coze 客户端
        client = get_coze_client(account_id)
        if not client:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 Coze 客户端（账号: {account_id}），请检查配置"
            )

        # 提取请求参数
        conversation_id = request.get("conversation_id")
        if not conversation_id:
            raise HTTPException(
                status_code=400,
                detail="conversation_id 参数是必需的"
            )

        # 取消执行
        success = await client.cancel_workflow_execution(conversation_id)

        return {
            "success": success,
            "message": "取消成功" if success else "取消失败",
            "conversation_id": conversation_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"取消工作流执行时发生错误: {str(e)}"
        )


# ==================== 事件日志管理 ====================

@router.get("/event-logs", summary="获取事件日志列表")
async def get_event_logs(
    limit: int = Query(default=200, ge=1, le=1000, description="返回数量限制"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    workflow_id: Optional[str] = Query(default=None, description="按工作流ID筛选"),
    execute_id: Optional[str] = Query(default=None, description="按执行ID筛选"),
    level: Optional[str] = Query(default=None, description="按日志级别筛选")
):
    """
    获取事件日志列表（分页）
    
    - **limit**: 返回数量限制（1-1000）
    - **offset**: 偏移量
    - **workflow_id**: 按工作流ID筛选
    - **execute_id**: 按执行ID筛选（任务ID）
    - **level**: 按日志级别筛选（info/warning/error/success）
    
    **注意**: 事件日志仅在内存中保存最近1000条，不持久化
    """
    try:
        event_log_service = get_event_log_service()
        result = event_log_service.get_logs(
            limit=limit,
            offset=offset,
            workflow_id=workflow_id,
            execute_id=execute_id,
            level=level
        )
        
        return {
            "success": True,
            **result
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取事件日志失败: {str(e)}"
        )


@router.delete("/event-logs", summary="清空事件日志")
async def clear_event_logs():
    """
    清空所有事件日志
    """
    try:
        event_log_service = get_event_log_service()
        event_log_service.clear_logs()
        
        return {
            "success": True,
            "message": "事件日志已清空"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"清空事件日志失败: {str(e)}"
        )


@router.get("/event-logs/count", summary="获取事件日志总数")
async def get_event_logs_count():
    """
    获取事件日志总数
    """
    try:
        event_log_service = get_event_log_service()
        count = event_log_service.get_log_count()
        
        return {
            "success": True,
            "count": count
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取事件日志总数失败: {str(e)}"
        )
