"""
轨道管理路由
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List

from app.models.draft_models import TrackInfo
from app.services.draft_service import DraftService

router = APIRouter()


@router.get("/type/{track_type}", response_model=List[TrackInfo])
async def get_tracks_by_type(
    track_type: str,
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    根据类型获取轨道列表

    Args:
        track_type: 轨道类型，如video, audio, text, effect, filter等
        file_path: draft_content.json文件的绝对路径

    Returns:
        指定类型的轨道信息列表
    """
    try:
        return DraftService.get_tracks_by_type(file_path, track_type)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取轨道信息失败: {str(e)}")


@router.get("/video", response_model=List[TrackInfo])
async def get_video_tracks(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取所有视频轨道

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        视频轨道列表
    """
    try:
        return DraftService.get_tracks_by_type(file_path, "video")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取视频轨道失败: {str(e)}")


@router.get("/audio", response_model=List[TrackInfo])
async def get_audio_tracks(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取所有音频轨道

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        音频轨道列表
    """
    try:
        return DraftService.get_tracks_by_type(file_path, "audio")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取音频轨道失败: {str(e)}")


@router.get("/text", response_model=List[TrackInfo])
async def get_text_tracks(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取所有文本轨道

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        文本轨道列表
    """
    try:
        return DraftService.get_tracks_by_type(file_path, "text")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文本轨道失败: {str(e)}")


@router.get("/statistics")
async def get_track_statistics(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取轨道统计信息

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        轨道统计信息，包括各类型轨道数量和片段数量
    """
    try:
        draft_info = DraftService.get_draft_info(file_path)

        # 按类型统计轨道
        track_stats = {}
        total_segments = 0

        for track in draft_info.tracks:
            track_type = track.type
            if track_type not in track_stats:
                track_stats[track_type] = {
                    "track_count": 0,
                    "segment_count": 0
                }

            track_stats[track_type]["track_count"] += 1
            track_stats[track_type]["segment_count"] += track.segment_count
            total_segments += track.segment_count

        return {
            "total_tracks": draft_info.track_count,
            "total_segments": total_segments,
            "by_type": track_stats
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")
