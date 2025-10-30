"""
Coze插件相关的数据模型
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum


class CozeDataType(str, Enum):
    """Coze数据类型枚举"""
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"
    TEXT = "text"


class CozePluginData(BaseModel):
    """Coze插件数据模型"""
    type: CozeDataType
    data: Dict[str, Any] = Field(description="数据内容，包含url、title等字段")
    client_id: str = Field(description="客户端ID")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now, description="数据时间戳")


class CozeSendDataRequest(BaseModel):
    """Coze发送数据请求模型"""
    api_base: str = Field(description="API基础URL")
    client_id: str = Field(description="客户端ID")
    data: Dict[str, Any] = Field(description="要发送的数据")


class CozeSendDataResponse(BaseModel):
    """Coze发送数据响应模型"""
    success: bool
    message: str
    client_id: str
    processed_at: datetime = Field(default_factory=datetime.now)


class CozeSubscribeRequest(BaseModel):
    """Coze订阅请求模型"""
    client_id: str = Field(description="客户端ID")
    workflow_id: Optional[str] = Field(default=None, description="工作流ID（可选）")


class CozeSubscribeResponse(BaseModel):
    """Coze订阅响应模型"""
    success: bool
    client_id: str
    message: str
    subscribed_at: datetime = Field(default_factory=datetime.now)


class CozeUnsubscribeRequest(BaseModel):
    """Coze取消订阅请求模型"""
    client_id: str = Field(description="客户端ID")


class CozeUnsubscribeResponse(BaseModel):
    """Coze取消订阅响应模型"""
    success: bool
    client_id: str
    message: str
    unsubscribed_at: datetime = Field(default_factory=datetime.now)


# 内存存储的订阅管理数据结构
class CozeSubscription(BaseModel):
    """Coze订阅信息"""
    client_id: str
    socket_id: str  # Socket.IO连接ID
    workflow_id: Optional[str] = None
    subscribed_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True
    data_received_count: int = 0


class CozeDataCache(BaseModel):
    """Coze数据缓存（用于临时存储和转发）"""
    id: str
    client_id: str
    data: CozePluginData
    received_at: datetime = Field(default_factory=datetime.now)
    forwarded_at: Optional[datetime] = None
    is_forwarded: bool = False


# 任务管理相关模型

class TaskStatus(str, Enum):
    """任务状态枚举"""
    DRAFT = "draft"                      # 草稿状态（未执行）
    EXECUTING = "executing"              # 执行中
    COMPLETED = "completed"              # 执行完成
    FAILED = "failed"                    # 执行失败
    CANCELLED = "cancelled"              # 已取消


class ExecutionStatus(str, Enum):
    """执行状态枚举"""
    PENDING = "pending"                  # 等待执行
    RUNNING = "running"                  # 运行中
    SUCCESS = "success"                  # 成功
    FAILED = "failed"                    # 失败
    TIMEOUT = "timeout"                  # 超时
    CANCELLED = "cancelled"              # 已取消


class Task(BaseModel):
    """任务模型"""
    id: str = Field(description="任务ID")
    name: str = Field(description="任务名称")
    description: Optional[str] = Field(default=None, description="任务描述")
    workflow_id: str = Field(description="关联的工作流ID")
    workflow_name: str = Field(description="工作流名称")
    workflow_version: Optional[int] = Field(default=None, description="工作流版本")

    # 输入输出数据
    input_parameters: Dict[str, Any] = Field(default_factory=dict, description="输入参数")
    output_data: Optional[Dict[str, Any]] = Field(default=None, description="输出结果")
    error_message: Optional[str] = Field(default=None, description="错误信息")

    # 执行状态
    status: TaskStatus = Field(default=TaskStatus.DRAFT, description="任务状态")
    execution_status: Optional[ExecutionStatus] = Field(default=None, description="执行状态")

    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    executed_at: Optional[datetime] = Field(default=None, description="执行时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")

    # 执行关联
    coze_execution_id: Optional[str] = Field(default=None, description="Coze执行ID")
    coze_conversation_id: Optional[str] = Field(default=None, description="Coze会话ID")

    # 元数据
    tags: Optional[List[str]] = Field(default=None, description="标签")
    priority: Optional[str] = Field(default="medium", description="优先级")
    created_by: Optional[str] = Field(default=None, description="创建者")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="扩展元数据")


class CreateTaskRequest(BaseModel):
    """创建任务请求模型"""
    name: Optional[str] = Field(default=None, description="任务名称")
    description: Optional[str] = Field(default=None, description="任务描述")
    workflow_id: str = Field(description="工作流ID")
    workflow_name: Optional[str] = Field(default=None, description="工作流名称")
    input_parameters: Dict[str, Any] = Field(default_factory=dict, description="输入参数")
    tags: Optional[List[str]] = Field(default=None, description="标签")
    priority: Optional[str] = Field(default="medium", description="优先级")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="扩展元数据")


class UpdateTaskRequest(BaseModel):
    """更新任务请求模型"""
    name: Optional[str] = Field(default=None, description="任务名称")
    description: Optional[str] = Field(default=None, description="任务描述")
    input_parameters: Optional[Dict[str, Any]] = Field(default=None, description="输入参数")
    output_data: Optional[Dict[str, Any]] = Field(default=None, description="输出结果")
    status: Optional[TaskStatus] = Field(default=None, description="任务状态")
    execution_status: Optional[ExecutionStatus] = Field(default=None, description="执行状态")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    executed_at: Optional[datetime] = Field(default=None, description="执行时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    coze_execution_id: Optional[str] = Field(default=None, description="Coze执行ID")
    coze_conversation_id: Optional[str] = Field(default=None, description="Coze会话ID")
    tags: Optional[List[str]] = Field(default=None, description="标签")
    priority: Optional[str] = Field(default=None, description="优先级")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="扩展元数据")


class ExecuteTaskRequest(BaseModel):
    """执行任务请求模型"""
    task_id: Optional[str] = Field(default=None, description="任务ID（可选，不携带则生成新任务）")
    workflow_id: str = Field(description="工作流ID")
    input_parameters: Optional[Dict[str, Any]] = Field(default=None, description="输入参数")
    save_as_task: bool = Field(default=True, description="是否保存为任务")
    task_name: Optional[str] = Field(default=None, description="任务名称")
    task_description: Optional[str] = Field(default=None, description="任务描述")


class ExecuteTaskResponse(BaseModel):
    """执行任务响应模型"""
    task_id: Optional[str] = Field(default=None, description="任务ID")
    execution_id: str = Field(description="执行ID")
    status: str = Field(description="执行状态")
    message: Optional[str] = Field(default=None, description="消息")


class TaskFilter(BaseModel):
    """任务查询过滤器模型"""
    workflow_id: Optional[str] = Field(default=None, description="工作流ID")
    status: Optional[TaskStatus] = Field(default=None, description="任务状态")
    execution_status: Optional[ExecutionStatus] = Field(default=None, description="执行状态")
    tags: Optional[List[str]] = Field(default=None, description="标签")
    priority: Optional[str] = Field(default=None, description="优先级")
    created_after: Optional[datetime] = Field(default=None, description="创建时间筛选")
    created_before: Optional[datetime] = Field(default=None, description="创建时间筛选")
    limit: Optional[int] = Field(default=50, description="限制数量")
    offset: Optional[int] = Field(default=0, description="偏移量")


class TaskListResponse(BaseModel):
    """任务列表响应模型"""
    tasks: List[Task] = Field(description="任务列表")
    total: int = Field(description="总数")
    has_more: bool = Field(description="是否有更多")


class TaskStatistics(BaseModel):
    """任务统计信息模型"""
    total: int = Field(description="总任务数")
    by_status: Dict[str, int] = Field(default_factory=dict, description="按状态统计")
    by_execution_status: Dict[str, int] = Field(default_factory=dict, description="按执行状态统计")
    by_workflow: Dict[str, int] = Field(default_factory=dict, description="按工作流统计")
    recent_executions: List[Task] = Field(default_factory=list, description="最近执行的任务")