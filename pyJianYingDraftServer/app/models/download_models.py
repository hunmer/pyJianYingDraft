"""
下载任务相关的数据模型

定义任务状态、进度信息等Pydantic模型
"""

from __future__ import annotations

from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"  # 等待中
    DOWNLOADING = "downloading"  # 下载中
    PROCESSING = "processing"  # 处理中（生成草稿）
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败
    CANCELLED = "cancelled"  # 已取消


class DownloadProgressInfo(BaseModel):
    """下载进度信息"""
    total_files: int = Field(description="总文件数")
    completed_files: int = Field(default=0, description="已完成文件数")
    failed_files: int = Field(default=0, description="失败文件数")
    active_files: int = Field(default=0, description="正在下载的文件数")
    total_size: int = Field(default=0, description="总大小（字节）")
    downloaded_size: int = Field(default=0, description="已下载大小（字节）")
    progress_percent: float = Field(default=0.0, description="进度百分比（0-100）")
    download_speed: int = Field(default=0, description="下载速度（字节/秒）")
    eta_seconds: Optional[int] = Field(default=None, description="预计剩余时间（秒）")

    class Config:
        json_schema_extra = {
            "example": {
                "total_files": 10,
                "completed_files": 3,
                "failed_files": 0,
                "active_files": 5,
                "total_size": 104857600,
                "downloaded_size": 31457280,
                "progress_percent": 30.0,
                "download_speed": 1048576,
                "eta_seconds": 70
            }
        }


class DownloadTask(BaseModel):
    """下载任务模型"""
    task_id: str = Field(description="任务ID")
    status: TaskStatus = Field(default=TaskStatus.PENDING, description="任务状态")
    batch_id: Optional[str] = Field(default=None, description="Aria2批次ID")

    # 草稿相关信息
    rule_group_id: Optional[str] = Field(default=None, description="规则组ID")
    rule_group: Optional[Dict[str, Any]] = Field(default=None, description="规则组数据")
    draft_config: Optional[Dict[str, Any]] = Field(default=None, description="草稿配置")
    materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="素材数据（MaterialInfo数组）")
    test_data: Optional[Dict[str, Any]] = Field(default=None, description="测试数据")
    segment_styles: Optional[Dict[str, Any]] = Field(default=None, description="片段样式")
    use_raw_segments: bool = Field(default=False, description="是否使用原始片段")
    raw_segments: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始片段数据")
    raw_materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始素材数据")

    # 下载路径映射（GID → 文件路径）
    gid_to_path_map: Optional[Dict[str, str]] = Field(default=None, description="GID到文件路径的映射")

    # 进度信息
    progress: Optional[DownloadProgressInfo] = Field(default=None, description="下载进度")

    # 结果信息
    draft_path: Optional[str] = Field(default=None, description="生成的草稿路径")
    error_message: Optional[str] = Field(default=None, description="错误信息")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")

    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "downloading",
                "batch_id": "aria2_batch_123",
                "rule_group_id": "group_1761106907762",
                "draft_config": {
                    "canvas_width": 1920,
                    "canvas_height": 1080,
                    "fps": 30
                },
                "progress": {
                    "total_files": 10,
                    "completed_files": 3,
                    "progress_percent": 30.0
                },
                "created_at": "2025-10-22T10:00:00Z",
                "updated_at": "2025-10-22T10:01:30Z"
            }
        }


class TaskSubmitRequest(BaseModel):
    """任务提交请求模型"""
    ruleGroup: Dict[str, Any] = Field(description="规则组数据")
    materials: List[Dict[str, Any]] = Field(description="素材数据（MaterialInfo数组）")
    testData: Optional[Dict[str, Any]] = Field(default=None, description="测试数据")
    segment_styles: Optional[Dict[str, Any]] = Field(default=None, description="片段样式")
    use_raw_segments: bool = Field(default=False, description="是否使用原始片段")
    raw_segments: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始片段数据")
    raw_materials: Optional[List[Dict[str, Any]]] = Field(default=None, description="原始素材数据")
    draft_config: Dict[str, Any] = Field(description="草稿配置")

    class Config:
        json_schema_extra = {
            "example": {
                "ruleGroup": {
                    "id": "group_123",
                    "title": "测试规则组",
                    "rules": []
                },
                "materials": [
                    {
                        "id": "material_1",
                        "name": "video.mp4",
                        "type": "video"
                    },
                    {
                        "id": "material_2",
                        "name": "audio.mp3",
                        "type": "audio"
                    }
                ],
                "draft_config": {
                    "canvas_config": {
                        "canvas_width": 1920,
                        "canvas_height": 1080
                    },
                    "fps": 30
                }
            }
        }


class TaskResponse(BaseModel):
    """任务响应模型"""
    task_id: str = Field(description="任务ID")
    status: TaskStatus = Field(description="任务状态")
    message: str = Field(description="响应消息")
    progress: Optional[DownloadProgressInfo] = Field(default=None, description="进度信息")
    draft_path: Optional[str] = Field(default=None, description="草稿路径")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")

    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "downloading",
                "message": "任务正在下载中",
                "progress": {
                    "total_files": 10,
                    "completed_files": 3,
                    "progress_percent": 30.0
                },
                "created_at": "2025-10-22T10:00:00Z",
                "updated_at": "2025-10-22T10:01:30Z"
            }
        }


class TaskListResponse(BaseModel):
    """任务列表响应模型"""
    tasks: List[TaskResponse] = Field(description="任务列表")
    total: int = Field(description="总数")
    limit: int = Field(description="每页数量")
    offset: int = Field(description="偏移量")

    class Config:
        json_schema_extra = {
            "example": {
                "tasks": [],
                "total": 100,
                "limit": 20,
                "offset": 0
            }
        }


class TaskCancelRequest(BaseModel):
    """任务取消请求模型"""
    task_id: str = Field(description="任务ID")


class TaskCancelResponse(BaseModel):
    """任务取消响应模型"""
    success: bool = Field(description="是否成功")
    message: str = Field(description="响应消息")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "任务已取消"
            }
        }
