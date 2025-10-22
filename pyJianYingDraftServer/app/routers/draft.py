"""
草稿文件基础操作路由
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.models.draft_models import DraftInfo
from app.services.draft_service import DraftService
from app.config import get_config, update_config

router = APIRouter()


class DraftRootConfig(BaseModel):
    """草稿根目录配置"""
    draft_root: str


class RuleGroupsConfig(BaseModel):
    """规则组配置"""
    rule_groups: List[Dict[str, Any]]


DRAFT_ROOT_CONFIG_KEY = "PYJY_DRAFT_ROOT"
RULE_GROUPS_CONFIG_KEY = "PYJY_RULE_GROUPS"


@router.get("/info", response_model=DraftInfo)
async def get_draft_info(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取草稿文件基础信息

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        草稿文件基础信息，包括分辨率、帧率、时长、轨道列表等
    """
    try:
        return DraftService.get_draft_info(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析草稿文件失败: {str(e)}")


@router.get("/raw")
async def get_draft_raw(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取草稿完整原始内容
    """
    try:
        return DraftService.get_raw_content(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取草稿原始数据失败: {str(e)}")


@router.get("/validate")
async def validate_draft(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    验证草稿文件是否有效

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        验证结果
    """
    try:
        DraftService.load_draft(file_path)
        return {
            "valid": True,
            "message": "草稿文件有效"
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="文件不存在")
    except Exception as e:
        return {
            "valid": False,
            "message": f"草稿文件无效: {str(e)}"
        }


@router.get("/list")
async def list_drafts(
    base_path: str = Query(..., description="剪映草稿根目录路径")
):
    """
    列出指定目录下的所有草稿

    Args:
        base_path: 剪映草稿根目录路径 (例如: "D:\\JianyingPro Drafts")

    Returns:
        草稿列表,每个草稿包含:
        - name: 草稿名称
        - path: draft_content.json 文件路径
        - modified_time: 修改时间戳
        - folder_path: 草稿文件夹路径
    """
    try:
        drafts = DraftService.list_drafts(base_path)
        return {
            "count": len(drafts),
            "drafts": drafts
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"列出草稿失败: {str(e)}")


@router.get("/config/root")
async def get_draft_root():
    """
    获取草稿根目录配置

    Returns:
        草稿根目录路径，如果未配置则返回空字符串
    """
    try:
        draft_root = get_config(DRAFT_ROOT_CONFIG_KEY, "")
        return {
            "draft_root": draft_root
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@router.post("/config/root")
async def set_draft_root(config: DraftRootConfig):
    """
    设置草稿根目录配置

    Args:
        config: 包含draft_root的配置对象

    Returns:
        更新后的配置
    """
    try:
        # 验证路径是否存在
        import os
        if config.draft_root and not os.path.exists(config.draft_root):
            raise HTTPException(status_code=400, detail=f"目录不存在: {config.draft_root}")

        # 更新配置
        update_config(DRAFT_ROOT_CONFIG_KEY, config.draft_root)

        return {
            "draft_root": config.draft_root,
            "message": "草稿根目录配置已更新"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")


@router.get("/config/rule-groups")
async def get_rule_groups():
    """
    获取规则组配置

    Returns:
        规则组列表,如果未配置则返回空列表
    """
    try:
        rule_groups = get_config(RULE_GROUPS_CONFIG_KEY, [])
        return {
            "rule_groups": rule_groups
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取规则组配置失败: {str(e)}")


@router.post("/config/rule-groups")
async def set_rule_groups(config: RuleGroupsConfig):
    """
    设置规则组配置

    Args:
        config: 包含rule_groups的配置对象

    Returns:
        更新后的配置
    """
    try:
        # 更新配置
        update_config(RULE_GROUPS_CONFIG_KEY, config.rule_groups)

        return {
            "rule_groups": config.rule_groups,
            "message": "规则组配置已更新"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新规则组配置失败: {str(e)}")
