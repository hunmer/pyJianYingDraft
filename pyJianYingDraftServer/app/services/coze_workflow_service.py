"""
Coze 工作流执行服务
提供工作流执行和任务管理的高级业务逻辑
"""

import uuid
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

from app.models.coze_models import (
    Task,
    TaskStatus,
    ExecutionStatus,
    CreateTaskRequest,
    UpdateTaskRequest,
    ExecuteTaskRequest,
    ExecuteTaskResponse,
)
from app.services.coze_client import get_coze_client, CozeWorkflowClient


class CozeWorkflowService:
    """Coze 工作流执行服务"""

    def __init__(self):
        """初始化服务"""
        # 内存存储任务（生产环境应该使用数据库）
        self._tasks_storage: Dict[str, Task] = {}
        self._task_counter = 0

    def _generate_task_id(self) -> str:
        """生成任务 ID"""
        self._task_counter += 1
        return f"task_{self._task_counter}_{int(datetime.now().timestamp() * 1000)}"

    def _get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        return self._tasks_storage.get(task_id)

    async def create_task(self, request: CreateTaskRequest, account_id: str = "default") -> Task:
        """
        创建任务（不执行）

        Args:
            request: 创建任务请求
            account_id: 账号 ID

        Returns:
            Task 任务对象
        """
        task_id = self._generate_task_id()
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
            metadata=request.metadata or {},
            status=TaskStatus.DRAFT,
        )

        # 存储任务
        self._tasks_storage[task_id] = task

        print(f"✅ 任务创建成功: {task_id} - {task_name}")
        return task

    async def update_task(self, task_id: str, request: UpdateTaskRequest) -> Task:
        """
        更新任务

        Args:
            task_id: 任务 ID
            request: 更新任务请求

        Returns:
            Task 更新后的任务对象
        """
        task = self._get_task(task_id)
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")

        # 更新字段
        update_data = request.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        # 更新时间戳
        task.updated_at = datetime.now()

        self._tasks_storage[task_id] = task
        print(f"✅ 任务更新成功: {task_id}")
        return task

    async def execute_task(
        self,
        request: ExecuteTaskRequest,
        account_id: str = "default"
    ) -> ExecuteTaskResponse:
        """
        执行任务

        Args:
            request: 执行任务请求
            account_id: 账号 ID

        Returns:
            ExecuteTaskResponse 执行响应
        """
        execution_id = str(uuid.uuid4())
        task_id = None
        task = None

        try:
            # 获取 Coze 客户端
            client = get_coze_client(account_id)
            if not client:
                raise ValueError(f"无法获取 Coze 客户端（账号: {account_id}）")

            # 1. 处理任务（加载现有任务 或 创建新任务）
            if request.task_id:
                # 加载现有任务
                task = self._get_task(request.task_id)
                if not task:
                    raise ValueError(f"任务 {request.task_id} 不存在")

                task_id = task.id

                # 更新任务状态
                task.status = TaskStatus.EXECUTING
                task.execution_status = ExecutionStatus.PENDING
                task.executed_at = datetime.now()
                task.updated_at = datetime.now()

            elif request.save_as_task:
                # 创建新任务
                task_id = self._generate_task_id()
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

                self._tasks_storage[task_id] = task

            # 2. 执行工作流
            print(f"🚀 开始执行工作流: {request.workflow_id}")

            # 更新任务状态为运行中
            if task:
                task.execution_status = ExecutionStatus.RUNNING
                task.updated_at = datetime.now()

            # 调用 Coze API 执行工作流
            result = await client.execute_workflow(
                workflow_id=request.workflow_id,
                parameters=request.input_parameters or {},
            )

            # 3. 更新任务状态（基于执行结果）
            if task:
                task.coze_execution_id = result.get("execution_id")
                task.coze_conversation_id = result.get("conversation_id")
                task.output_data = result.get("output_data", {})
                task.error_message = result.get("error_message")
                task.completed_at = datetime.now()
                task.updated_at = datetime.now()

                # 根据执行结果设置状态
                if result.get("status") == "success":
                    task.status = TaskStatus.COMPLETED
                    task.execution_status = ExecutionStatus.SUCCESS
                elif result.get("status") == "failed":
                    task.status = TaskStatus.FAILED
                    task.execution_status = ExecutionStatus.FAILED
                else:
                    task.status = TaskStatus.FAILED
                    task.execution_status = ExecutionStatus.FAILED

            # 4. 返回执行响应
            return ExecuteTaskResponse(
                task_id=task_id,
                execution_id=result.get("execution_id") or execution_id,
                status="success" if result.get("status") == "success" else "failed",
                message="任务执行完成" if result.get("status") == "success" else f"任务执行失败: {result.get('error_message')}"
            )

        except Exception as e:
            # 更新任务为失败状态
            if task:
                task.status = TaskStatus.FAILED
                task.execution_status = ExecutionStatus.FAILED
                task.error_message = str(e)
                task.completed_at = datetime.now()
                task.updated_at = datetime.now()

            print(f"⚠️ 任务执行失败: {e}")

            return ExecuteTaskResponse(
                task_id=task_id,
                execution_id=execution_id,
                status="failed",
                message=f"任务执行失败: {str(e)}"
            )

    async def get_task(self, task_id: str) -> Optional[Task]:
        """
        获取任务

        Args:
            task_id: 任务 ID

        Returns:
            Task 或 None
        """
        return self._get_task(task_id)

    async def list_tasks(
        self,
        workflow_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        execution_status: Optional[ExecutionStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        获取任务列表

        Args:
            workflow_id: 工作流 ID 过滤
            status: 任务状态过滤
            execution_status: 执行状态过滤
            limit: 限制数量
            offset: 偏移量

        Returns:
            任务列表响应
        """
        # 筛选任务
        filtered_tasks = []
        for task in self._tasks_storage.values():
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

        return {
            "tasks": tasks,
            "total": total,
            "has_more": has_more
        }

    async def delete_task(self, task_id: str) -> bool:
        """
        删除任务

        Args:
            task_id: 任务 ID

        Returns:
            是否成功
        """
        if task_id in self._tasks_storage:
            del self._tasks_storage[task_id]
            print(f"✅ 任务删除成功: {task_id}")
            return True
        return False

    async def get_task_statistics(self, workflow_id: Optional[str] = None) -> Dict[str, Any]:
        """
        获取任务统计

        Args:
            workflow_id: 工作流 ID 过滤

        Returns:
            统计信息
        """
        # 筛选任务
        tasks = list(self._tasks_storage.values())
        if workflow_id:
            tasks = [t for t in tasks if t.workflow_id == workflow_id]

        # 统计信息
        total = len(tasks)
        by_status = {}
        by_execution_status = {}
        by_workflow = {}

        # 按状态统计
        for s in TaskStatus:
            by_status[s.value] = len([t for t in tasks if t.status == s])

        # 按执行状态统计
        for es in ExecutionStatus:
            by_execution_status[es.value] = len([t for t in tasks if t.execution_status == es])

        # 按工作流统计
        for task in tasks:
            workflow_name = task.workflow_name
            by_workflow[workflow_name] = by_workflow.get(workflow_name, 0) + 1

        # 最近执行的任务
        recent_executions = [t for t in tasks if t.executed_at is not None]
        recent_executions.sort(key=lambda t: t.executed_at, reverse=True)
        recent_executions = recent_executions[:10]

        return {
            "total": total,
            "by_status": by_status,
            "by_execution_status": by_execution_status,
            "by_workflow": by_workflow,
            "recent_executions": recent_executions
        }


# 全局服务实例
_workflow_service: Optional[CozeWorkflowService] = None


def get_workflow_service() -> CozeWorkflowService:
    """获取工作流服务单例"""
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = CozeWorkflowService()
    return _workflow_service
