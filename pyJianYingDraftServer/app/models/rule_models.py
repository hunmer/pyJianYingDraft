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


class RuleGroupTestRequest(BaseModel):
    """规则组测试请求体"""

    ruleGroup: RuleGroupModel = Field(..., description="规则组定义")
    materials: List[MaterialPayload] = Field(default_factory=list, description="素材信息列表")
    testData: TestDataModel = Field(..., description="测试数据")


class RuleGroupTestResponse(BaseModel):
    """规则组测试响应"""

    status_code: int = Field(..., description="执行状态码")
    draft_path: str = Field(..., description="生成的草稿目录")
    message: Optional[str] = Field(default=None, description="补充信息")
