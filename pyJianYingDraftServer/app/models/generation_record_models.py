"""
生成记录相关的数据模型

用于保存和管理草稿生成记录
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.download_models import TaskStatus, DownloadProgressInfo


class GenerationRecord(BaseModel):
    """草稿生成记录模型"""
    record_id: str = Field(description="记录ID（唯一标识符，可用于重新导入）")
    task_id: Optional[str] = Field(default=None, description="关联的任务ID")

    # 草稿相关信息
    rule_group_id: Optional[str] = Field(default=None, description="规则组ID")
    rule_group_title: Optional[str] = Field(default=None, description="规则组标题")
    rule_group: Optional[Dict[str, Any]] = Field(default=None, description="规则组数据")
    draft_config: Optional[Dict[str, Any]] = Field(default=None, description="草稿配置")
    materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="素材数据")
    test_data: Optional[Dict[str, Any]] = Field(default=None, description="测试数据")
    segment_styles: Optional[Dict[str, Any]] = Field(default=None, description="片段样式")
    raw_segments: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始片段数据")
    raw_materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始素材数据")

    # 状态信息
    status: TaskStatus = Field(default=TaskStatus.PENDING, description="任务状态")
    progress: Optional[DownloadProgressInfo] = Field(default=None, description="下载进度")

    # 结果信息
    draft_path: Optional[str] = Field(default=None, description="生成的草稿路径")
    draft_name: Optional[str] = Field(default=None, description="草稿名称")
    error_message: Optional[str] = Field(default=None, description="错误信息")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")

    class Config:
        json_schema_extra = {
            "example": {
                "record_id": "rec_1234567890",
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "rule_group_id": "group_123",
                "rule_group_title": "示例规则组",
                "status": "completed",
                "draft_name": "生成的草稿",
                "created_at": "2025-10-22T10:00:00Z"
            }
        }


class GenerationRecordCreateRequest(BaseModel):
    """创建生成记录请求模型"""
    record_id: str = Field(description="记录ID（唯一标识符）")
    task_id: Optional[str] = Field(default=None, description="任务ID")
    rule_group_id: Optional[str] = Field(default=None, description="规则组ID")
    rule_group_title: Optional[str] = Field(default=None, description="规则组标题")
    rule_group: Optional[Dict[str, Any]] = Field(default=None, description="规则组数据")
    draft_config: Optional[Dict[str, Any]] = Field(default=None, description="草稿配置")
    materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="素材数据")
    test_data: Optional[Dict[str, Any]] = Field(default=None, description="测试数据")
    segment_styles: Optional[Dict[str, Any]] = Field(default=None, description="片段样式")
    raw_segments: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始片段数据")
    raw_materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始素材数据")


class GenerationRecordListResponse(BaseModel):
    """生成记录列表响应模型"""
    records: List[GenerationRecord] = Field(description="生成记录列表")
    total: int = Field(description="总数")
    limit: int = Field(description="每页数量")
    offset: int = Field(description="偏移量")

    class Config:
        json_schema_extra = {
            "example": {
                "records": [],
                "total": 50,
                "limit": 20,
                "offset": 0
            }
        }
