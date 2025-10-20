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
