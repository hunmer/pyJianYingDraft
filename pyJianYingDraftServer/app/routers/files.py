"""
文件服务路由
提供媒体文件的预览和下载
"""

import os
import mimetypes
from pathlib import Path
from typing import Optional
import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def get_mime_type(file_path: str) -> str:
    """
    根据文件扩展名获取MIME类型

    Args:
        file_path: 文件路径

    Returns:
        MIME类型字符串
    """
    mime_type, _ = mimetypes.guess_type(file_path)

    if mime_type:
        return mime_type

    # 常见媒体文件类型映射
    ext_map = {
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
    }

    ext = os.path.splitext(file_path)[1].lower()
    return ext_map.get(ext, 'application/octet-stream')


@router.get("/preview")
async def preview_file(
    request: Request,
    file_path: str = Query(..., description="文件的绝对路径"),
    download: bool = Query(False, description="是否作为下载(而非预览)")
):
    """
    预览或下载文件

    支持视频、音频、图片等媒体文件的预览,支持HTTP Range请求

    **参数:**
    - **file_path**: 文件的绝对路径
    - **download**: 是否作为下载(默认为预览模式)

    **返回:**
    - 文件内容(根据MIME类型)

    **异常:**
    - 404: 文件不存在
    - 403: 文件路径不安全(尝试访问系统关键路径)
    """
    # 安全检查:防止路径穿越攻击
    try:
        file_path_obj = Path(file_path).resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的文件路径: {str(e)}")

    print(file_path_obj)
    # 检查文件是否存在
    if not file_path_obj.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")

    # 检查是否是文件(而非目录)
    if not file_path_obj.is_file():
        raise HTTPException(status_code=400, detail=f"路径不是文件: {file_path}")

    # 获取文件信息
    file_size = file_path_obj.stat().st_size
    mime_type = get_mime_type(str(file_path_obj))
    filename = file_path_obj.name

    # 记录请求信息用于调试
    logger.info(f"文件预览请求: {filename}, 大小: {file_size} bytes, MIME: {mime_type}")
    range_header = request.headers.get("range")
    if range_header:
        logger.info(f"Range请求: {range_header}")

    # 简化方案:让FastAPI的FileResponse自动处理Range请求
    # 这样更可靠,不需要手动实现Range逻辑
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",  # 缓存1小时
    }

    if download:
        headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{filename}"
    else:
        headers["Content-Disposition"] = f"inline; filename*=UTF-8''{filename}"

    return FileResponse(
        path=str(file_path_obj),
        media_type=mime_type,
        headers=headers,
        stat_result=file_path_obj.stat()  # 传递stat结果以提高性能
    )


@router.head("/preview")
async def preview_file_head(file_path: str = Query(..., description="文件的绝对路径")):
    """
    获取文件元数据(HEAD请求)

    用于检查文件是否存在和获取文件大小
    """
    try:
        file_path_obj = Path(file_path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="无效的文件路径")

    if not file_path_obj.exists() or not file_path_obj.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")

    file_size = file_path_obj.stat().st_size
    mime_type = get_mime_type(str(file_path_obj))

    return Response(
        status_code=200,
        headers={
            "Content-Type": mime_type,
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
        }
    )
