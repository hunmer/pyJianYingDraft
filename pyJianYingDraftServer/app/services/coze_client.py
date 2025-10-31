"""
Coze API 客户端封装
提供工作流和任务管理的高级接口
"""

import asyncio
from typing import Optional, Dict, Any, List, AsyncIterator
from datetime import datetime

from cozepy import (
    AsyncCoze,
    AsyncTokenAuth,
    WorkflowEvent,
    WorkflowEventType,
    COZE_CN_BASE_URL
)

from app.services.coze_config import CozeApiConfig


class CozeWorkflowClient:
    """Coze 工作流客户端（异步）"""

    def __init__(self, config: CozeApiConfig):
        """
        初始化 Coze 客户端

        Args:
            config: Coze API 配置
        """
        self.config = config
        self.client = AsyncCoze(
            auth=AsyncTokenAuth(token=config.api_token),
            base_url=config.base_url
        )

    async def list_workspaces(self) -> List[Dict[str, Any]]:
        """
        获取工作空间列表

        Returns:
            工作空间列表
        """
        try:
            response = await self.client.workspaces.list()

            workspaces = []
            for workspace in response.items or []:
                workspaces.append({
                    "id": str(workspace.id),
                    "name": workspace.name,
                    "description": getattr(workspace, "description", ""),
                    "icon": getattr(workspace, "icon_url", None) or getattr(workspace, "icon", None),
                    "status": "active" if getattr(workspace, "status", "") == "active" else "inactive",
                    "created_time": getattr(workspace, "created_time", None),
                    "updated_time": getattr(workspace, "updated_time", None),
                })

            return workspaces

        except Exception as e:
            print(f"⚠️ 获取工作空间列表失败: {e}")
            raise

    async def list_workflows(
        self,
        workspace_id: Optional[str] = None,
        page_num: int = 1,
        page_size: int = 30
    ) -> Dict[str, Any]:
        """
        获取工作流列表

        Args:
            workspace_id: 工作空间 ID（可选）
            page_num: 页码（从 1 开始）
            page_size: 每页数量（1-30，Coze API 限制）

        Returns:
            工作流列表和分页信息
        """
        try:
            response = await self.client.workflows.list(
                workspace_id=workspace_id,
                page_num=page_num,
                page_size=page_size
            )

            workflows = []
            for workflow in response.items or []:
                workflows.append({
                    "id": workflow.workflow_id,
                    "name": workflow.workflow_name,
                    "description": getattr(workflow, "description", ""),
                    "icon_url": getattr(workflow, "icon_url", ""),
                    "app_id": getattr(workflow, "app_id", ""),
                    "created_at": getattr(workflow, "created_at", None),
                    "updated_at": getattr(workflow, "updated_at", None),
                    "creator": {
                        "user_id": getattr(workflow.creator, "user_id", "") if hasattr(workflow, "creator") and workflow.creator else "",
                        "user_name": getattr(workflow.creator, "user_name", "") if hasattr(workflow, "creator") and workflow.creator else "",
                    } if hasattr(workflow, "creator") and workflow.creator else None,
                })

            return {
                "workflows": workflows,
                "has_more": getattr(response, "has_more", False),
                "total": len(workflows),
            }

        except Exception as e:
            print(f"⚠️ 获取工作流列表失败: {e}")
            raise

    async def retrieve_workflow(self, workflow_id: str, include_schema: bool = True) -> Dict[str, Any]:
        """
        获取工作流详情

        Args:
            workflow_id: 工作流 ID
            include_schema: 是否包含输入输出schema（默认True）

        Returns:
            工作流信息，包含 input_schema 和 output_schema（如果 include_schema=True）
        """
        try:
            import httpx

            # 如果需要 schema，直接调用 REST API
            if include_schema:
                url = f"{self.config.base_url}/v1/workflows/{workflow_id}"
                params = {"include_input_output": "true"}

                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        url,
                        params=params,
                        headers={
                            "Authorization": f"Bearer {self.config.api_token}",
                            "Content-Type": "application/json",
                        },
                    )

                    if response.status_code != 200:
                        raise Exception(f"HTTP {response.status_code}: {response.text}")

                    result = response.json()

                    if result.get("code") != 0:
                        raise Exception(result.get("msg", "获取工作流详情失败"))

                    data = result.get("data", {})
                    workflow_detail = data.get("workflow_detail", {})
                    input_info = data.get("input", {})
                    output_info = data.get("output", {})

                    # 转换输入schema
                    input_schema = None
                    if input_info.get("parameters"):
                        input_schema = {
                            "type": "object",
                            "properties": {},
                            "required": [],
                        }
                        for key, param in input_info["parameters"].items():
                            param_type = param.get("type", "string")
                            if param_type == "txt":
                                param_type = "string"

                            prop = {
                                "type": param_type,
                                "title": key,
                                "description": param.get("description", ""),
                            }

                            if "default_value" in param:
                                prop["default"] = param["default_value"]

                            input_schema["properties"][key] = prop

                            if param.get("required"):
                                input_schema["required"].append(key)

                    # 转换输出schema
                    output_schema = None
                    if output_info.get("parameters"):
                        output_schema = {
                            "type": "object",
                            "properties": {},
                        }
                        for key, param in output_info["parameters"].items():
                            output_schema["properties"][key] = {
                                "type": param.get("type", "string"),
                                "title": key,
                            }

                    return {
                        "id": workflow_detail.get("workflow_id"),
                        "name": workflow_detail.get("workflow_name"),
                        "description": workflow_detail.get("description", ""),
                        "icon_url": workflow_detail.get("icon_url", ""),
                        "app_id": workflow_detail.get("app_id", ""),
                        "created_at": workflow_detail.get("created_at"),
                        "updated_at": workflow_detail.get("updated_at"),
                        "creator": workflow_detail.get("creator"),
                        "input_schema": input_schema,
                        "output_schema": output_schema,
                    }

            # 否则使用 coze-py 的基本方法
            else:
                workflow = await self.client.workflows.retrieve(workflow_id=workflow_id)

                # 访问 workflow_detail 中的字段
                detail = workflow.workflow_detail

                return {
                    "id": detail.workflow_id,
                    "name": detail.workflow_name,
                    "description": getattr(detail, "description", ""),
                    "created_time": getattr(detail, "created_at", None),
                    "updated_time": getattr(detail, "updated_at", None),
                    "icon_url": getattr(detail, "icon_url", ""),
                    "app_id": getattr(detail, "app_id", ""),
                    "creator": getattr(detail, "creator", None),
                }

        except Exception as e:
            print(f"⚠️ 获取工作流详情失败: {e}")
            raise

    async def execute_workflow_stream(
        self,
        workflow_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        bot_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncIterator[WorkflowEvent]:
        """
        执行工作流（流式）

        Args:
            workflow_id: 工作流 ID
            parameters: 输入参数
            bot_id: Bot ID（可选）
            conversation_id: 会话 ID（可选）

        Yields:
            WorkflowEvent 工作流事件
        """
        try:
            # 如果没有会话 ID，创建新会话
            if not conversation_id and bot_id:
                conversation = await self.client.conversations.create()
                conversation_id = conversation.id

            # 执行工作流（流式）
            stream = self.client.workflows.runs.stream(
                workflow_id=workflow_id,
                parameters=parameters or {},
                bot_id=bot_id,
                ext={"conversation_id": conversation_id} if conversation_id else None
            )

            async for event in stream:
                yield event

        except Exception as e:
            print(f"⚠️ 工作流执行失败: {e}")
            raise

    async def execute_workflow(
        self,
        workflow_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        bot_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        执行工作流（非流式，收集完整结果）

        Args:
            workflow_id: 工作流 ID
            parameters: 输入参数
            bot_id: Bot ID（可选）
            conversation_id: 会话 ID（可选）

        Returns:
            执行结果
        """
        from app.services.execution_history_service import get_execution_history_service

        output_data = {}
        error_message = None
        execution_id = None
        status = "success"
        error_code = None

        # 获取执行历史服务
        history_service = get_execution_history_service()

        try:
            # 1. 创建执行记录（工作流开始）
            execution_record = await history_service.create_execution_record(
                workflow_id=workflow_id,
                parameters=parameters,
                bot_id=bot_id,
                conversation_id=conversation_id
            )
            execution_id = execution_record["execute_id"]

            # 2. 执行工作流
            async for event in self.execute_workflow_stream(
                workflow_id=workflow_id,
                parameters=parameters,
                bot_id=bot_id,
                conversation_id=conversation_id
            ):
                # 记录执行 ID（从 Coze API 返回的）
                if hasattr(event, "execute_id") and event.execute_id:
                    # 如果 API 返回了执行 ID，更新记录
                    if event.execute_id != execution_id:
                        await history_service.update_execution_record(
                            workflow_id=workflow_id,
                            execute_id=execution_id,
                            metadata={"coze_execute_id": event.execute_id}
                        )

                # 处理消息事件
                if event.event == WorkflowEventType.MESSAGE:
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

                # 处理错误事件
                elif event.event == WorkflowEventType.ERROR:
                    status = "failed"
                    if hasattr(event, "error") and event.error:
                        error_message = str(event.error)
                        error_code = getattr(event, "error_code", None)

                # 处理中断事件（暂不支持）
                elif event.event == WorkflowEventType.INTERRUPT:
                    status = "interrupted"
                    error_message = "工作流执行被中断"

            # 3. 更新执行记录（工作流完成）
            await history_service.update_execution_record(
                workflow_id=workflow_id,
                execute_id=execution_id,
                execute_status=status,
                output=output_data,
                error_code=error_code,
                error_message=error_message
            )

            return {
                "execution_id": execution_id,
                "status": status,
                "output_data": output_data,
                "error_message": error_message,
                "conversation_id": conversation_id,
            }

        except Exception as e:
            # 更新执行记录为失败状态
            if execution_id:
                await history_service.update_execution_record(
                    workflow_id=workflow_id,
                    execute_id=execution_id,
                    execute_status="failed",
                    error_message=str(e)
                )

            return {
                "execution_id": execution_id,
                "status": "failed",
                "output_data": {},
                "error_message": str(e),
                "conversation_id": conversation_id,
            }

    async def get_execution_history(
        self,
        workflow_id: str,
        page_size: int = 20,
        page_index: int = 1
    ) -> Dict[str, Any]:
        """
        获取工作流执行历史列表
        注意: Coze SDK 没有提供 list 方法，需要直接调用 REST API

        Args:
            workflow_id: 工作流 ID
            page_size: 每页数量
            page_index: 页码（从 1 开始）

        Returns:
            执行历史列表
        """
        try:
            import httpx

            url = f"{self.config.base_url}/v1/workflows/{workflow_id}/run_histories"
            params = {
                "page_size": page_size,
                "page_num": page_index
            }

            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(
                    url,
                    params=params,
                    headers={
                        "Authorization": f"Bearer {self.config.api_token}",
                        "Content-Type": "application/json",
                    },
                )

                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}: {response.text}")

                result = response.json()

                if result.get("code") != 0:
                    raise Exception(result.get("msg", "获取执行历史列表失败"))

                data = result.get("data", {})
                run_histories = data.get("run_histories", [])

                histories = []
                for history in run_histories:
                    histories.append({
                        "execute_id": history.get("execute_id"),
                        "workflow_id": workflow_id,
                        "create_time": history.get("create_time"),
                        "execute_status": history.get("execute_status", "unknown"),
                        "error_message": history.get("error_message"),
                    })

                return {
                    "histories": histories,
                    "total": data.get("total", len(histories)),
                    "has_more": data.get("has_more", False),
                }

        except Exception as e:
            print(f"⚠️ 获取执行历史列表失败: {e}")
            raise

    async def get_execution_detail(
        self,
        workflow_id: str,
        execute_id: str
    ) -> Dict[str, Any]:
        """
        获取单个执行记录的详细信息

        Args:
            workflow_id: 工作流 ID
            execute_id: 执行 ID

        Returns:
            执行记录详情
        """
        try:
            run_history = await self.client.workflows.runs.run_histories.retrieve(
                workflow_id=workflow_id,
                execute_id=execute_id
            )

            return {
                "execute_id": run_history.execute_id,
                "workflow_id": workflow_id,
                "create_time": run_history.create_time,
                "update_time": run_history.update_time,
                "execute_status": run_history.execute_status.value if hasattr(run_history.execute_status, 'value') else str(run_history.execute_status),
                "error_code": run_history.error_code,
                "error_message": run_history.error_message or None,
                "output": run_history.output,
                "debug_url": run_history.debug_url,
                "run_mode": run_history.run_mode.value if hasattr(run_history.run_mode, 'value') else int(run_history.run_mode),
                "bot_id": run_history.bot_id,
                "connector_id": run_history.connector_id,
                "connector_uid": run_history.connector_uid,
                "is_output_trimmed": run_history.is_output_trimmed,
                "usage": getattr(run_history, "usage", None),
                "node_execute_status": getattr(run_history, "node_execute_status", None),
            }

        except Exception as e:
            print(f"⚠️ 获取执行记录详情失败: {e}")
            raise

    async def cancel_workflow_execution(
        self,
        conversation_id: str,
    ) -> bool:
        """
        取消工作流执行

        Args:
            conversation_id: 会话 ID

        Returns:
            是否成功取消
        """
        try:
            import httpx

            url = f"{self.config.base_url}/v1/workflow/cancel_run"

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json={"conversation_id": conversation_id},
                    headers={
                        "Authorization": f"Bearer {self.config.api_token}",
                        "Content-Type": "application/json",
                    },
                )

                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}: {response.text}")

                result = response.json()
                return result.get("code") == 0

        except Exception as e:
            print(f"⚠️ 取消工作流执行失败: {e}")
            return False

    async def close(self):
        """关闭客户端连接"""
        # AsyncCoze 客户端基于 httpx，自动管理连接
        pass


# 客户端缓存
_coze_clients: Dict[str, CozeWorkflowClient] = {}


def get_coze_client(account_id: str = "default") -> Optional[CozeWorkflowClient]:
    """
    获取 Coze 客户端实例

    Args:
        account_id: 账号 ID

    Returns:
        CozeWorkflowClient 或 None
    """
    global _coze_clients

    # 如果已缓存，直接返回
    if account_id in _coze_clients:
        return _coze_clients[account_id]

    # 加载配置
    from app.services.coze_config import get_config_manager

    config_manager = get_config_manager()
    config = config_manager.get_coze_config(account_id)

    if not config:
        print(f"⚠️ 无法为账号 {account_id} 创建 Coze 客户端：配置缺失")
        return None

    # 创建客户端
    try:
        client = CozeWorkflowClient(config)
        _coze_clients[account_id] = client
        return client
    except Exception as e:
        print(f"⚠️ 创建 Coze 客户端失败: {e}")
        return None


def set_coze_client(client: CozeWorkflowClient, account_id: str = "default"):
    """
    设置 Coze 客户端实例

    Args:
        client: Coze 客户端
        account_id: 账号 ID
    """
    global _coze_clients
    _coze_clients[account_id] = client


async def close_all_clients():
    """关闭所有 Coze 客户端"""
    global _coze_clients
    for client in _coze_clients.values():
        await client.close()
    _coze_clients.clear()
