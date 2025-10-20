"""
草稿文件相关数据模型
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TimerangeInfo(BaseModel):
    """时间范围信息"""
    start: int = Field(description="开始时间(微秒)")
    duration: int = Field(description="持续时长(微秒)")
    start_seconds: float = Field(description="开始时间(秒)")
    duration_seconds: float = Field(description="持续时长(秒)")


class SegmentInfo(BaseModel):
    """片段基础信息"""
    id: str = Field(description="片段ID")
    material_id: str = Field(description="素材ID")
    target_timerange: TimerangeInfo = Field(description="目标时间范围")
    source_timerange: Optional[TimerangeInfo] = Field(None, description="素材时间范围")
    speed: Optional[float] = Field(None, description="播放速度")
    volume: Optional[float] = Field(None, description="音量")
    style: Optional[Dict[str, Any]] = Field(default=None, description="segment style attributes")


class TrackInfo(BaseModel):
    """轨道基础信息"""
    id: str = Field(description="轨道ID")
    name: str = Field(description="轨道名称")
    type: str = Field(description="轨道类型")
    render_index: int = Field(description="渲染索引")
    segment_count: int = Field(description="片段数量")
    segments: List[SegmentInfo] = Field(default_factory=list, description="片段列表")


class MaterialInfo(BaseModel):
    """素材基础信息"""
    id: str = Field(description="素材ID")
    name: str = Field(description="素材名称")
    type: str = Field(description="素材类型")
    path: Optional[str] = Field(None, description="素材路径")
    duration: Optional[int] = Field(None, description="时长(微秒)")
    duration_seconds: Optional[float] = Field(None, description="时长(秒)")
    width: Optional[int] = Field(None, description="宽度")
    height: Optional[int] = Field(None, description="高度")


class DraftInfo(BaseModel):
    """草稿文件基础信息"""
    width: int = Field(description="画布宽度")
    height: int = Field(description="画布高度")
    fps: int = Field(description="帧率")
    duration: int = Field(description="总时长(微秒)")
    duration_seconds: float = Field(description="总时长(秒)")
    track_count: int = Field(description="轨道数量")
    tracks: List[TrackInfo] = Field(default_factory=list, description="轨道列表")


class SubdraftInfo(BaseModel):
    """复合片段信息"""
    id: str = Field(description="复合片段ID")
    name: str = Field(description="复合片段名称")
    type: str = Field(description="复合片段类型")
    combination_id: str = Field(description="组合ID")
    draft_info: DraftInfo = Field(description="嵌套草稿信息")
    material_stats: Dict[str, int] = Field(default_factory=dict, description="素材统计")
