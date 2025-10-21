"""
文件监控API路由
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List

from app.models.file_watch_models import (
    WatchFileRequest,
    WatchedFileInfo,
    FileVersionListResponse,
    FileContentResponse
)
from app.services.file_watch_service import get_file_version_manager

router = APIRouter()


@router.post("/watch", response_model=WatchedFileInfo, summary="添加文件监控")
async def add_watch(request: WatchFileRequest):
    """
    添加文件到监控列表

    - **file_path**: 要监控的文件路径（绝对路径或相对路径）
    - **watch_name**: 可选的监控名称，默认使用文件名
    """
    try:
        manager = get_file_version_manager()
        info = manager.add_watch(request.file_path, request.watch_name)
        return info
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加监控失败: {str(e)}")


@router.delete("/watch", summary="移除文件监控")
async def remove_watch(file_path: str = Query(..., description="文件路径")):
    """
    从监控列表中移除文件

    - **file_path**: 要移除的文件路径
    """
    try:
        manager = get_file_version_manager()
        success = manager.remove_watch(file_path)
        if success:
            return {"message": "移除成功", "file_path": file_path}
        else:
            raise HTTPException(status_code=404, detail="文件未在监控列表中")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移除监控失败: {str(e)}")


@router.get("/watch/list", response_model=List[WatchedFileInfo], summary="获取监控文件列表")
async def get_watched_files():
    """
    获取所有被监控的文件列表
    """
    try:
        manager = get_file_version_manager()
        return manager.get_watched_files()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取列表失败: {str(e)}")


@router.post("/watch/start", summary="开始监控文件")
async def start_watch(file_path: str = Query(..., description="文件路径")):
    """
    开始监控指定文件的变化

    - **file_path**: 要开始监控的文件路径
    """
    try:
        manager = get_file_version_manager()
        success = manager.start_watch(file_path)
        if success:
            return {"message": "开始监控", "file_path": file_path}
        else:
            return {"message": "文件已在监控中", "file_path": file_path}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"开始监控失败: {str(e)}")


@router.post("/watch/stop", summary="停止监控文件")
async def stop_watch(file_path: str = Query(..., description="文件路径")):
    """
    停止监控指定文件的变化

    - **file_path**: 要停止监控的文件路径
    """
    try:
        manager = get_file_version_manager()
        success = manager.stop_watch(file_path)
        if success:
            return {"message": "停止监控", "file_path": file_path}
        else:
            return {"message": "文件未在监控中", "file_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"停止监控失败: {str(e)}")


@router.get("/versions", response_model=FileVersionListResponse, summary="获取文件版本列表")
async def get_file_versions(file_path: str = Query(..., description="文件路径")):
    """
    获取指定文件的所有版本列表

    - **file_path**: 文件路径
    """
    try:
        manager = get_file_version_manager()
        return manager.get_versions(file_path)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取版本列表失败: {str(e)}")


@router.get("/version/content", response_model=FileContentResponse, summary="获取指定版本内容")
async def get_version_content(
    file_path: str = Query(..., description="文件路径"),
    version: int = Query(..., description="版本号", ge=1)
):
    """
    获取指定版本的文件内容

    - **file_path**: 文件路径
    - **version**: 版本号（从1开始）
    """
    try:
        manager = get_file_version_manager()
        return manager.get_version_content(file_path, version)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件内容失败: {str(e)}")
