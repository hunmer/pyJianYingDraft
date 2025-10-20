"""
草稿文件基础操作路由
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.draft_models import DraftInfo
from app.services.draft_service import DraftService

router = APIRouter()


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
