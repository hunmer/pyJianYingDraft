"""
复合片段(Subdrafts)操作路由
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List

from app.models.draft_models import SubdraftInfo
from app.services.draft_service import DraftService

router = APIRouter()


@router.get("/list", response_model=List[SubdraftInfo])
async def list_subdrafts(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取草稿文件中的所有复合片段列表

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        复合片段信息列表，包括每个复合片段的详细信息
    """
    try:
        return DraftService.get_subdrafts(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析复合片段失败: {str(e)}")


@router.get("/{subdraft_index}", response_model=SubdraftInfo)
async def get_subdraft_by_index(
    subdraft_index: int,
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    根据索引获取特定复合片段的详细信息

    Args:
        subdraft_index: 复合片段索引（从0开始）
        file_path: draft_content.json文件的绝对路径

    Returns:
        指定索引的复合片段详细信息
    """
    try:
        subdrafts = DraftService.get_subdrafts(file_path)

        if subdraft_index < 0 or subdraft_index >= len(subdrafts):
            raise HTTPException(
                status_code=404,
                detail=f"复合片段索引 {subdraft_index} 超出范围 [0, {len(subdrafts)})"
            )

        return subdrafts[subdraft_index]
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析复合片段失败: {str(e)}")


@router.get("/{subdraft_index}/tracks")
async def get_subdraft_tracks(
    subdraft_index: int,
    file_path: str = Query(..., description="草稿文件绝对路径"),
    track_type: str = Query(None, description="轨道类型过滤，如video/audio/text")
):
    """
    获取复合片段中的轨道信息

    Args:
        subdraft_index: 复合片段索引（从0开始）
        file_path: draft_content.json文件的绝对路径
        track_type: 可选的轨道类型过滤

    Returns:
        轨道信息列表
    """
    try:
        subdrafts = DraftService.get_subdrafts(file_path)

        if subdraft_index < 0 or subdraft_index >= len(subdrafts):
            raise HTTPException(
                status_code=404,
                detail=f"复合片段索引 {subdraft_index} 超出范围"
            )

        tracks = subdrafts[subdraft_index].draft_info.tracks

        if track_type:
            tracks = [t for t in tracks if t.type == track_type]

        return {
            "subdraft_name": subdrafts[subdraft_index].name,
            "track_count": len(tracks),
            "tracks": tracks
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取轨道信息失败: {str(e)}")


@router.get("/{subdraft_index}/materials")
async def get_subdraft_materials(
    subdraft_index: int,
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取复合片段中的素材统计信息

    Args:
        subdraft_index: 复合片段索引（从0开始）
        file_path: draft_content.json文件的绝对路径

    Returns:
        素材统计信息
    """
    try:
        subdrafts = DraftService.get_subdrafts(file_path)

        if subdraft_index < 0 or subdraft_index >= len(subdrafts):
            raise HTTPException(
                status_code=404,
                detail=f"复合片段索引 {subdraft_index} 超出范围"
            )

        subdraft = subdrafts[subdraft_index]

        return {
            "subdraft_name": subdraft.name,
            "subdraft_id": subdraft.id,
            "material_stats": subdraft.material_stats
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取素材信息失败: {str(e)}")
