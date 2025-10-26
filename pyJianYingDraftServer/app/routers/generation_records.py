"""
生成记录管理HTTP接口

提供生成记录的创建、查询、更新等REST API
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.generation_record_models import (
    GenerationRecord,
    GenerationRecordCreateRequest,
    GenerationRecordListResponse
)
from app.services.generation_record_service import get_generation_record_service

router = APIRouter(prefix="/api/generation-records", tags=["generation-records"])


@router.post("", response_model=GenerationRecord)
async def create_record(request: GenerationRecordCreateRequest):
    """创建生成记录

    Args:
        request: 创建生成记录请求

    Returns:
        GenerationRecord: 创建的生成记录
    """
    try:
        service = get_generation_record_service()
        record = await service.create_record(request)
        return record
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建生成记录失败: {str(e)}")


@router.get("", response_model=GenerationRecordListResponse)
async def list_records(
    status: Optional[str] = Query(None, description="状态筛选"),
    limit: int = Query(20, ge=1, le=100, description="每页数量"),
    offset: int = Query(0, ge=0, description="偏移量")
):
    """获取生成记录列表

    Args:
        status: 状态筛选（可选）
        limit: 每页数量，默认20
        offset: 偏移量，默认0

    Returns:
        GenerationRecordListResponse: 生成记录列表
    """
    try:
        service = get_generation_record_service()
        records, total = await service.list_records(status=status, limit=limit, offset=offset)

        return GenerationRecordListResponse(
            records=records,
            total=total,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取生成记录列表失败: {str(e)}")


@router.get("/{record_id}", response_model=GenerationRecord)
async def get_record(record_id: str):
    """获取生成记录详情

    Args:
        record_id: 记录ID

    Returns:
        GenerationRecord: 生成记录详情
    """
    try:
        service = get_generation_record_service()
        record = await service.get_record(record_id)

        if not record:
            raise HTTPException(status_code=404, detail=f"生成记录不存在: {record_id}")

        return record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取生成记录失败: {str(e)}")


@router.put("/{record_id}", response_model=GenerationRecord)
async def update_record(record_id: str, record: GenerationRecord):
    """更新生成记录

    Args:
        record_id: 记录ID
        record: 更新的生成记录数据

    Returns:
        GenerationRecord: 更新后的生成记录
    """
    try:
        service = get_generation_record_service()

        # 确保record_id匹配
        if record.record_id != record_id:
            raise HTTPException(status_code=400, detail="记录ID不匹配")

        updated_record = await service.update_record(record)

        if not updated_record:
            raise HTTPException(status_code=404, detail=f"生成记录不存在: {record_id}")

        return updated_record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新生成记录失败: {str(e)}")


@router.delete("/{record_id}")
async def delete_record(record_id: str):
    """删除生成记录

    Args:
        record_id: 记录ID

    Returns:
        dict: 删除结果
    """
    try:
        service = get_generation_record_service()
        success = await service.delete_record(record_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"生成记录不存在: {record_id}")

        return {"success": True, "message": f"生成记录已删除: {record_id}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除生成记录失败: {str(e)}")
