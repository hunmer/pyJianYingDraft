"""
Aria2下载管理相关路由
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class Aria2ConfigResponse(BaseModel):
    """Aria2配置响应"""
    aria2_path: str
    rpc_port: int
    rpc_secret: str
    download_dir: str
    max_concurrent_downloads: int


@router.get("/config/download-dir")
async def get_download_dir():
    """
    获取下载目录配置

    Returns:
        下载目录路径
    """
    try:
        from app.services.aria2_manager import get_aria2_manager

        manager = get_aria2_manager()

        return {
            "download_dir": str(manager.download_dir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取下载目录失败: {str(e)}")


@router.get("/config", response_model=Aria2ConfigResponse)
async def get_aria2_config():
    """
    获取完整的Aria2配置信息

    Returns:
        Aria2配置对象
    """
    try:
        from app.services.aria2_manager import get_aria2_manager
        from app.config import get_config

        manager = get_aria2_manager()

        return {
            "aria2_path": get_config('ARIA2_PATH', ''),
            "rpc_port": manager.rpc_port,
            "rpc_secret": manager.rpc_secret if manager.rpc_secret else '',
            "download_dir": str(manager.download_dir),
            "max_concurrent_downloads": manager.config.get('max_concurrent_downloads', 50)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取Aria2配置失败: {str(e)}")
