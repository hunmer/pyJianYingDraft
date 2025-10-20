"""
规则组与测试数据相关的模型定义
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class MaterialPayload(BaseModel):
    """测试请求中的素材信息（兼容剪映原始结构）"""

    id: str = Field(..., description="素材ID")
    type: Optional[str] = Field(default=None, description="素材类型")
    path: Optional[str] = Field(default=None, description="素材路径")
    name: Optional[str] = Field(default=None, description="素材名称")

    model_config = ConfigDict(extra='allow')


class RuleModel(BaseModel):
    """单条规则定义"""

    type: str = Field(..., description="规则类型")
    title: str = Field(..., description="规则标题")
    material_ids: List[str] = Field(default_factory=list, description="关联的素材ID列表")
    meta: Optional[Dict[str, Any]] = Field(default=None, description="规则元数据")


class RuleGroupModel(BaseModel):
    """规则组定义"""

    id: str = Field(..., description="规则组ID")
    title: str = Field(..., description="规则组标题")
    rules: List[RuleModel] = Field(default_factory=list, description="规则列表")
    createdAt: Optional[str] = Field(default=None, description="创建时间")
    updatedAt: Optional[str] = Field(default=None, description="更新时间")


class TestTrackModel(BaseModel):
    """测试轨道描述"""

    id: str = Field(..., description="轨道ID")
    type: str = Field(..., description="轨道类型")
    title: Optional[str] = Field(default=None, description="轨道名称")


class TestItemModel(BaseModel):
    """测试素材项"""

    type: str = Field(..., description="规则类型")
    data: Dict[str, Any] = Field(default_factory=dict, description="素材数据")


class TestDataModel(BaseModel):
    """测试数据集合"""

    tracks: List[TestTrackModel] = Field(default_factory=list, description="测试轨道列表")
    items: List[TestItemModel] = Field(default_factory=list, description="测试素材项列表")


SegmentStylesPayload = Dict[str, Dict[str, Any]]


class RawSegmentPayload(BaseModel):
    """原始片段载荷，允许直接写入草稿结构"""

    track_id: str = Field(..., description="轨道ID")
    track_type: str = Field(..., description="轨道类型")
    track_name: Optional[str] = Field(default=None, description="轨道名称")
    material_id: Optional[str] = Field(default=None, description="素材ID")
    segment: Dict[str, Any] = Field(default_factory=dict, description="完整片段数据")
    material: Optional[Dict[str, Any]] = Field(default=None, description="片段附带的素材数据")
    material_category: Optional[str] = Field(default=None, description="片段附带素材分类")
    extra_materials: Optional[Dict[str, List[Dict[str, Any]]]] = Field(
        default=None,
        description="片段所依赖的额外素材，按分类划分",
    )

    model_config = ConfigDict(extra="allow")


class RawMaterialPayload(BaseModel):
    """原始素材载荷"""

    id: str = Field(..., description="素材ID")
    category: str = Field(..., description="素材分类，如 videos、audios")
    data: Dict[str, Any] = Field(default_factory=dict, description="素材完整JSON数据")

    model_config = ConfigDict(extra="allow")


class RuleGroupTestRequest(BaseModel):
    """规则组测试请求体"""

    ruleGroup: RuleGroupModel = Field(..., description="规则组定义")
    materials: List[MaterialPayload] = Field(default_factory=list, description="素材信息列表")
    testData: TestDataModel = Field(..., description="测试数据")
    segment_styles: Optional[SegmentStylesPayload] = Field(default=None, description="素材样式映射")
    use_raw_segments: bool = Field(default=False, description="是否直接写入原始片段")
    raw_segments: Optional[List[RawSegmentPayload]] = Field(default=None, description="原始片段列表")
    raw_materials: Optional[List[RawMaterialPayload]] = Field(default=None, description="原始素材列表")
    canvas_width: Optional[int] = Field(default=None, description="画布宽度")
    canvas_height: Optional[int] = Field(default=None, description="画布高度")
    fps: Optional[int] = Field(default=None, description="帧率")


class RuleGroupTestResponse(BaseModel):
    """规则组测试响应"""

    status_code: int = Field(..., description="执行状态码")
    draft_path: str = Field(..., description="生成的草稿目录")
    message: Optional[str] = Field(default=None, description="补充信息")
