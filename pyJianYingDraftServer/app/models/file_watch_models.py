"""
文件监控相关的数据模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class WatchFileRequest(BaseModel):
    """添加监控文件请求"""
    file_path: str = Field(..., description="要监控的文件路径")
    watch_name: Optional[str] = Field(None, description="监控名称（可选）")


class FileVersionInfo(BaseModel):
    """文件版本信息"""
    version: int = Field(..., description="版本号")
    timestamp: datetime = Field(..., description="创建时间")
    file_size: int = Field(..., description="文件大小（字节）")
    file_hash: str = Field(..., description="文件MD5哈希值")


class WatchedFileInfo(BaseModel):
    """被监控文件信息"""
    file_path: str = Field(..., description="文件路径")
    watch_name: str = Field(..., description="监控名称")
    is_watching: bool = Field(default=False, description="是否正在监控")
    latest_version: int = Field(default=0, description="最新版本号")
    total_versions: int = Field(default=0, description="总版本数")
    created_at: datetime = Field(..., description="添加监控的时间")
    last_modified: Optional[datetime] = Field(None, description="最后修改时间")


class FileVersionListResponse(BaseModel):
    """文件版本列表响应"""
    file_path: str = Field(..., description="文件路径")
    versions: List[FileVersionInfo] = Field(default_factory=list, description="版本列表")


class FileContentResponse(BaseModel):
    """文件内容响应"""
    file_path: str = Field(..., description="文件路径")
    version: int = Field(..., description="版本号")
    content: str = Field(..., description="文件内容")
    timestamp: datetime = Field(..., description="创建时间")
    file_size: int = Field(..., description="文件大小（字节）")
