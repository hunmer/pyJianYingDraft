"""
测试数据库持久化功能

运行此脚本以验证数据库是否正确保存和加载任务
"""

import asyncio
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import get_database
from app.models.download_models import DownloadTask, TaskStatus, DownloadProgressInfo
from datetime import datetime


async def test_database():
    """测试数据库基本功能"""
    print("=" * 60)
    print("数据库持久化功能测试")
    print("=" * 60)

    # 1. 初始化数据库
    print("\n1. 初始化数据库...")
    db = await get_database()
    print(f"✓ 数据库已初始化: {db.db_path}")

    # 2. 创建测试任务
    print("\n2. 创建测试任务...")
    test_task = DownloadTask(
        task_id="test-task-001",
        status=TaskStatus.PENDING,
        batch_id="batch-001",
        rule_group_id="group-001",
        rule_group={
            "id": "group-001",
            "title": "测试规则组",
            "rules": [
                {"type": "test", "value": "测试规则"}
            ]
        },
        draft_config={
            "canvas_width": 1920,
            "canvas_height": 1080,
            "fps": 30
        },
        materials=[
            {"id": "mat-1", "name": "测试视频.mp4", "type": "video"},
            {"id": "mat-2", "name": "测试音频.mp3", "type": "audio"}
        ],
        test_data={"test_key": "test_value"},
        segment_styles={"style1": "value1"},
        use_raw_segments=False,
        raw_segments=None,
        raw_materials=None,
        gid_to_path_map={"gid-1": "/path/to/file1.mp4"},
        progress=DownloadProgressInfo(
            total_files=5,
            completed_files=2,
            progress_percent=40.0,
            total_size=1024000,
            downloaded_size=409600
        ),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    print(f"✓ 测试任务已创建: {test_task.task_id}")

    # 3. 保存任务到数据库
    print("\n3. 保存任务到数据库...")
    try:
        await db.save_task(test_task)
        print(f"✓ 任务已保存到数据库")
    except Exception as e:
        print(f"✗ 保存失败: {e}")
        import traceback
        traceback.print_exc()
        return

    # 4. 从数据库加载任务
    print("\n4. 从数据库加载任务...")
    loaded_task = await db.load_task(test_task.task_id)
    if loaded_task:
        print(f"✓ 任务加载成功: {loaded_task.task_id}")
        print(f"  - 状态: {loaded_task.status}")
        print(f"  - 批次ID: {loaded_task.batch_id}")
        print(f"  - 规则组ID: {loaded_task.rule_group_id}")

        # 检查 rule_group 是否正确加载
        if loaded_task.rule_group:
            print(f"  - 规则组标题: {loaded_task.rule_group.get('title')}")
            print(f"  - 规则组规则数: {len(loaded_task.rule_group.get('rules', []))}")
        else:
            print(f"  ⚠ 警告: rule_group 为空!")

        # 检查其他字段
        print(f"  - 素材数量: {len(loaded_task.materials) if loaded_task.materials else 0}")
        print(f"  - 进度: {loaded_task.progress.progress_percent if loaded_task.progress else 0}%")
    else:
        print(f"✗ 任务加载失败")
        return

    # 5. 更新任务状态
    print("\n5. 更新任务状态...")
    loaded_task.status = TaskStatus.DOWNLOADING
    loaded_task.updated_at = datetime.now()
    await db.save_task(loaded_task)
    print(f"✓ 任务状态已更新")

    # 6. 重新加载验证
    print("\n6. 验证更新...")
    updated_task = await db.load_task(test_task.task_id)
    if updated_task and updated_task.status == TaskStatus.DOWNLOADING:
        print(f"✓ 状态更新验证成功: {updated_task.status}")
    else:
        print(f"✗ 状态更新验证失败")

    # 7. 加载所有任务
    print("\n7. 加载所有任务...")
    all_tasks = await db.load_all_tasks()
    print(f"✓ 数据库中共有 {len(all_tasks)} 个任务")
    for task in all_tasks:
        print(f"  - {task.task_id}: {task.status}")

    # 8. 清理测试数据
    print("\n8. 清理测试数据...")
    deleted = await db.delete_task(test_task.task_id)
    if deleted:
        print(f"✓ 测试任务已删除")
    else:
        print(f"⚠ 测试任务删除失败")

    print("\n" + "=" * 60)
    print("✅ 数据库测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_database())
