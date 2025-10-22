"""
数据库模块

使用SQLAlchemy + SQLite实现任务持久化
"""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List

from sqlalchemy import create_engine, Column, String, DateTime, Text, Integer, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.download_models import TaskStatus, DownloadTask, DownloadProgressInfo


# SQLAlchemy Base
Base = declarative_base()


class TaskModel(Base):
    """任务数据库模型"""
    __tablename__ = "download_tasks"

    task_id = Column(String, primary_key=True, index=True)
    status = Column(String, nullable=False, index=True)
    batch_id = Column(String, nullable=True)

    # 草稿相关信息（JSON存储）
    rule_group_id = Column(String, nullable=True)
    draft_config = Column(Text, nullable=True)  # JSON
    materials = Column(Text, nullable=True)  # JSON
    test_data = Column(Text, nullable=True)  # JSON

    # 进度信息（JSON存储）
    progress_json = Column(Text, nullable=True)  # JSON

    # 结果信息
    draft_path = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    def to_download_task(self) -> DownloadTask:
        """转换为DownloadTask模型"""
        # 解析JSON字段
        draft_config = json.loads(self.draft_config) if self.draft_config else None
        materials = json.loads(self.materials) if self.materials else None
        test_data = json.loads(self.test_data) if self.test_data else None

        # 解析进度信息
        progress = None
        if self.progress_json:
            progress_dict = json.loads(self.progress_json)
            progress = DownloadProgressInfo(**progress_dict)

        return DownloadTask(
            task_id=self.task_id,
            status=TaskStatus(self.status),
            batch_id=self.batch_id,
            rule_group_id=self.rule_group_id,
            draft_config=draft_config,
            materials=materials,
            test_data=test_data,
            progress=progress,
            draft_path=self.draft_path,
            error_message=self.error_message,
            created_at=self.created_at,
            updated_at=self.updated_at,
            completed_at=self.completed_at
        )

    @staticmethod
    def from_download_task(task: DownloadTask) -> TaskModel:
        """从DownloadTask创建数据库模型"""
        # 序列化JSON字段
        draft_config_json = json.dumps(task.draft_config) if task.draft_config else None
        materials_json = json.dumps(task.materials) if task.materials else None
        test_data_json = json.dumps(task.test_data) if task.test_data else None

        # 序列化进度信息
        progress_json = None
        if task.progress:
            progress_json = json.dumps(task.progress.model_dump())

        return TaskModel(
            task_id=task.task_id,
            status=task.status.value,
            batch_id=task.batch_id,
            rule_group_id=task.rule_group_id,
            draft_config=draft_config_json,
            materials=materials_json,
            test_data=test_data_json,
            progress_json=progress_json,
            draft_path=task.draft_path,
            error_message=task.error_message,
            created_at=task.created_at,
            updated_at=task.updated_at,
            completed_at=task.completed_at
        )


class Database:
    """数据库管理器"""

    def __init__(self, db_path: Optional[str] = None, use_async: bool = True):
        """初始化数据库

        Args:
            db_path: 数据库文件路径（None则使用默认路径）
            use_async: 是否使用异步引擎
        """
        if db_path is None:
            # 默认路径：项目根目录/tasks.db
            project_root = Path(__file__).resolve().parent.parent
            db_path = str(project_root / "tasks.db")

        self.db_path = db_path
        self.use_async = use_async

        if use_async:
            # 异步引擎
            self.engine = create_async_engine(
                f"sqlite+aiosqlite:///{db_path}",
                echo=False
            )
            self.SessionLocal = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
        else:
            # 同步引擎
            self.engine = create_engine(
                f"sqlite:///{db_path}",
                echo=False
            )
            self.SessionLocal = sessionmaker(
                bind=self.engine,
                autocommit=False,
                autoflush=False
            )

    async def init_db(self) -> None:
        """初始化数据库表"""
        if self.use_async:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            Base.metadata.create_all(bind=self.engine)

    async def save_task(self, task: DownloadTask) -> None:
        """保存或更新任务

        Args:
            task: 下载任务
        """
        task_model = TaskModel.from_download_task(task)

        if self.use_async:
            async with self.SessionLocal() as session:
                # 检查任务是否存在
                existing = await session.get(TaskModel, task.task_id)
                if existing:
                    # 更新
                    for key, value in task_model.__dict__.items():
                        if not key.startswith('_'):
                            setattr(existing, key, value)
                else:
                    # 插入
                    session.add(task_model)

                await session.commit()
        else:
            with self.SessionLocal() as session:
                existing = session.get(TaskModel, task.task_id)
                if existing:
                    for key, value in task_model.__dict__.items():
                        if not key.startswith('_'):
                            setattr(existing, key, value)
                else:
                    session.add(task_model)

                session.commit()

    async def load_task(self, task_id: str) -> Optional[DownloadTask]:
        """加载任务

        Args:
            task_id: 任务ID

        Returns:
            DownloadTask: 任务对象，不存在返回None
        """
        if self.use_async:
            async with self.SessionLocal() as session:
                task_model = await session.get(TaskModel, task_id)
                return task_model.to_download_task() if task_model else None
        else:
            with self.SessionLocal() as session:
                task_model = session.get(TaskModel, task_id)
                return task_model.to_download_task() if task_model else None

    async def load_all_tasks(self) -> List[DownloadTask]:
        """加载所有任务

        Returns:
            List[DownloadTask]: 任务列表
        """
        if self.use_async:
            async with self.SessionLocal() as session:
                from sqlalchemy import select
                result = await session.execute(select(TaskModel))
                task_models = result.scalars().all()
                return [tm.to_download_task() for tm in task_models]
        else:
            with self.SessionLocal() as session:
                task_models = session.query(TaskModel).all()
                return [tm.to_download_task() for tm in task_models]

    async def delete_task(self, task_id: str) -> bool:
        """删除任务

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功删除
        """
        if self.use_async:
            async with self.SessionLocal() as session:
                task_model = await session.get(TaskModel, task_id)
                if task_model:
                    await session.delete(task_model)
                    await session.commit()
                    return True
                return False
        else:
            with self.SessionLocal() as session:
                task_model = session.get(TaskModel, task_id)
                if task_model:
                    session.delete(task_model)
                    session.commit()
                    return True
                return False

    async def cleanup_old_tasks(self, days: int = 7) -> int:
        """清理旧任务

        Args:
            days: 保留最近N天的任务

        Returns:
            int: 删除的任务数
        """
        from datetime import timedelta
        cutoff_date = datetime.now() - timedelta(days=days)

        if self.use_async:
            async with self.SessionLocal() as session:
                from sqlalchemy import select, delete
                # 查询要删除的任务
                stmt = select(TaskModel).where(
                    TaskModel.completed_at < cutoff_date,
                    TaskModel.status.in_([
                        TaskStatus.COMPLETED.value,
                        TaskStatus.FAILED.value,
                        TaskStatus.CANCELLED.value
                    ])
                )
                result = await session.execute(stmt)
                tasks_to_delete = result.scalars().all()
                count = len(tasks_to_delete)

                # 删除
                if count > 0:
                    delete_stmt = delete(TaskModel).where(
                        TaskModel.completed_at < cutoff_date,
                        TaskModel.status.in_([
                            TaskStatus.COMPLETED.value,
                            TaskStatus.FAILED.value,
                            TaskStatus.CANCELLED.value
                        ])
                    )
                    await session.execute(delete_stmt)
                    await session.commit()

                return count
        else:
            with self.SessionLocal() as session:
                tasks_to_delete = session.query(TaskModel).filter(
                    TaskModel.completed_at < cutoff_date,
                    TaskModel.status.in_([
                        TaskStatus.COMPLETED.value,
                        TaskStatus.FAILED.value,
                        TaskStatus.CANCELLED.value
                    ])
                ).all()
                count = len(tasks_to_delete)

                for task in tasks_to_delete:
                    session.delete(task)

                session.commit()
                return count


# 全局单例
_global_db: Optional[Database] = None


async def get_database(db_path: Optional[str] = None) -> Database:
    """获取全局数据库单例

    Args:
        db_path: 数据库路径（仅首次调用时生效）

    Returns:
        Database: 数据库实例
    """
    global _global_db

    if _global_db is None:
        _global_db = Database(db_path=db_path)
        await _global_db.init_db()

    return _global_db
