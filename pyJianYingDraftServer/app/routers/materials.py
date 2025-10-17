"""
素材管理路由
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any

from app.services.draft_service import DraftService

router = APIRouter()


@router.get("/all")
async def get_all_materials(
    file_path: str = Query(..., description="草稿文件绝对路径")
) -> Dict[str, Any]:
    """
    获取草稿文件中的所有素材信息

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        所有素材信息，按类型分组并包含统计信息
    """
    try:
        return DraftService.get_materials(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取素材信息失败: {str(e)}")


@router.get("/type/{material_type}")
async def get_materials_by_type(
    material_type: str,
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    根据类型获取素材信息

    Args:
        material_type: 素材类型，如videos, audios, texts, stickers等
        file_path: draft_content.json文件的绝对路径

    Returns:
        指定类型的素材列表
    """
    try:
        materials = DraftService.get_materials(file_path, material_type)
        return materials
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取素材信息失败: {str(e)}")


@router.get("/videos")
async def get_videos(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取所有视频素材

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        视频素材列表
    """
    try:
        return DraftService.get_materials(file_path, "videos")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取视频素材失败: {str(e)}")


@router.get("/audios")
async def get_audios(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取所有音频素材

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        音频素材列表
    """
    try:
        return DraftService.get_materials(file_path, "audios")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取音频素材失败: {str(e)}")


@router.get("/texts")
async def get_texts(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取所有文本素材

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        文本素材列表
    """
    try:
        return DraftService.get_materials(file_path, "texts")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文本素材失败: {str(e)}")


@router.get("/statistics")
async def get_material_statistics(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取素材统计信息

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        素材统计信息，包括各类型素材数量
    """
    try:
        all_materials = DraftService.get_materials(file_path)

        statistics = {}
        total_count = 0

        for material_type, material_data in all_materials.items():
            if isinstance(material_data, dict) and 'count' in material_data:
                count = material_data['count']
                statistics[material_type] = count
                total_count += count

        return {
            "total_count": total_count,
            "by_type": statistics
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")
