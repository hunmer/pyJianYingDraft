"""
Coze插件相关的API路由
"""

from fastapi import APIRouter, HTTPException
from app.models.coze_models import (
    CozeSendDataRequest,
    CozeSendDataResponse,
)
from app.services.coze_service import get_coze_service

router = APIRouter()


@router.post("/send-data", response_model=CozeSendDataResponse, summary="Coze插件数据接收")
async def send_coze_data(request: CozeSendDataRequest):
    """
    接收来自Coze插件的数据

    - **api_base**: Coze插件的API基础URL
    - **client_id**: 客户端唯一标识
    - **data**: 要发送的数据，包含type和data字段

    数据接收后会通过WebSocket转发给对应clientId的订阅客户端
    """
    try:
        coze_service = get_coze_service()
        response = await coze_service.receive_data(request)

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"处理Coze数据时发生错误: {str(e)}"
        )


@router.get("/stats", summary="获取Coze服务统计信息")
async def get_coze_stats():
    """
    获取Coze服务的统计信息

    返回包括：
    - 总订阅数
    - 总接收数据数
    - 总转发数据数
    - 当前活跃连接数
    """
    try:
        coze_service = get_coze_service()
        stats = coze_service.get_stats()

        return {
            "success": True,
            "data": stats,
            "message": "获取统计信息成功"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取统计信息时发生错误: {str(e)}"
        )


@router.get("/health", summary="Coze服务健康检查")
async def health_check():
    """检查Coze服务是否正常运行"""
    try:
        coze_service = get_coze_service()
        stats = coze_service.get_stats()

        return {
            "status": "healthy",
            "service": "coze",
            "stats": stats
        }

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Coze服务不可用: {str(e)}"
        )