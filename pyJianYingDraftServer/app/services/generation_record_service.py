"""
生成记录服务

管理草稿生成记录的存储和检索
"""

import json
from pathlib import Path
from typing import List, Tuple, Optional
from datetime import datetime

from app.models.generation_record_models import (
    GenerationRecord,
    GenerationRecordCreateRequest
)
from app.models.download_models import TaskStatus


class GenerationRecordService:
    """生成记录服务类"""

    def __init__(self, storage_dir: str = None):
        """初始化服务

        Args:
            storage_dir: 存储目录路径
        """
        if storage_dir is None:
            # 默认存储在项目目录下的 data/generation_records
            storage_dir = Path(__file__).parent.parent.parent / "data" / "generation_records"

        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _get_record_file_path(self, record_id: str) -> Path:
        """获取记录文件路径

        Args:
            record_id: 记录ID

        Returns:
            Path: 记录文件路径
        """
        return self.storage_dir / f"{record_id}.json"

    async def create_record(self, request: GenerationRecordCreateRequest) -> GenerationRecord:
        """创建生成记录

        Args:
            request: 创建请求

        Returns:
            GenerationRecord: 创建的记录
        """
        # 创建记录
        record = GenerationRecord(
            record_id=request.record_id,
            task_id=request.task_id,
            rule_group_id=request.rule_group_id,
            rule_group_title=request.rule_group_title,
            rule_group=request.rule_group,
            draft_config=request.draft_config,
            materials=request.materials,
            test_data=request.test_data,
            segment_styles=request.segment_styles,
            use_raw_segments=request.use_raw_segments,
            raw_segments=request.raw_segments,
            raw_materials=request.raw_materials,
            status=TaskStatus.PENDING,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        # 保存到文件
        file_path = self._get_record_file_path(record.record_id)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(record.model_dump(mode='json'), f, ensure_ascii=False, indent=2, default=str)

        return record

    async def get_record(self, record_id: str) -> Optional[GenerationRecord]:
        """获取生成记录

        Args:
            record_id: 记录ID

        Returns:
            GenerationRecord: 记录，如果不存在返回None
        """
        file_path = self._get_record_file_path(record_id)

        if not file_path.exists():
            return None

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return GenerationRecord(**data)

    async def update_record(self, record: GenerationRecord) -> Optional[GenerationRecord]:
        """更新生成记录

        Args:
            record: 更新的记录

        Returns:
            GenerationRecord: 更新后的记录，如果不存在返回None
        """
        file_path = self._get_record_file_path(record.record_id)

        if not file_path.exists():
            return None

        # 更新时间
        record.updated_at = datetime.now()

        # 保存到文件
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(record.model_dump(mode='json'), f, ensure_ascii=False, indent=2, default=str)

        return record

    async def delete_record(self, record_id: str) -> bool:
        """删除生成记录

        Args:
            record_id: 记录ID

        Returns:
            bool: 是否删除成功
        """
        file_path = self._get_record_file_path(record_id)

        if not file_path.exists():
            return False

        file_path.unlink()
        return True

    async def list_records(
        self,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[GenerationRecord], int]:
        """获取生成记录列表

        Args:
            status: 状态筛选（可选）
            limit: 每页数量
            offset: 偏移量

        Returns:
            Tuple[List[GenerationRecord], int]: (记录列表, 总数)
        """
        # 读取所有记录文件
        records = []
        for file_path in self.storage_dir.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    record = GenerationRecord(**data)

                    # 状态筛选
                    if status and record.status != status:
                        continue

                    records.append(record)
            except Exception as e:
                print(f"读取记录文件失败: {file_path}, 错误: {e}")

        # 按创建时间倒序排序
        records.sort(key=lambda x: x.created_at, reverse=True)

        total = len(records)

        # 分页
        records = records[offset:offset + limit]

        return records, total


# 单例服务实例
_service_instance: Optional[GenerationRecordService] = None


def get_generation_record_service() -> GenerationRecordService:
    """获取生成记录服务单例

    Returns:
        GenerationRecordService: 服务实例
    """
    global _service_instance
    if _service_instance is None:
        _service_instance = GenerationRecordService()
    return _service_instance
