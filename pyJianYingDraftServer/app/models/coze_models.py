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