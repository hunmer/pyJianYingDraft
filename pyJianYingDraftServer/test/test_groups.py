"""
测试 get_aria2_groups 功能

验证从数据库加载的任务是否能正确显示在下载组中
"""

import asyncio
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.task_queue import get_task_queue
from app.models.download_models import DownloadTask, TaskStatus, TaskSubmitRequest
from datetime import datetime


async def test_groups():
    """测试下载组功能"""
    print("=" * 60)
    print("测试 get_aria2_groups 功能")
    print("=" * 60)

    # 1. 获取任务队列
    print("\n1. 获取任务队列...")
    queue = get_task_queue()
    print(f"✓ 任务队列已获取")

    # 2. 启动任务队列（初始化 Aria2 客户端）
    print("\n2. 启动任务队列...")
    if queue.start():
        print(f"✓ 任务队列已启动")
    else:
        print(f"⚠ 任务队列启动失败")

    # 3. 从数据库加载任务
    print("\n3. 从数据库加载任务...")
    await queue.load_tasks_from_db()
    print(f"✓ 已加载 {len(queue.tasks)} 个任务")

    # 4. 显示任务列表
    print("\n4. 当前任务列表:")
    if queue.tasks:
        for task_id, task in queue.tasks.items():
            print(f"  - 任务ID: {task_id}")
            print(f"    状态: {task.status}")
            print(f"    批次ID: {task.batch_id or '(未设置)'}")
            print(f"    规则组: {task.rule_group.get('title') if task.rule_group else '(无)'}")
            print(f"    创建时间: {task.created_at}")
            print()
    else:
        print("  (无任务)")

    # 5. 模拟 get_aria2_groups 逻辑
    print("\n5. 模拟 get_aria2_groups 逻辑:")
    groups = []
    seen_group_ids = set()

    for task in queue.tasks.values():
        # 使用 batch_id 如果存在，否则使用 task_id 作为组ID
        group_id = task.batch_id if task.batch_id else task.task_id

        if group_id not in seen_group_ids:
            seen_group_ids.add(group_id)

            # 使用任务中保存的进度信息或默认值
            progress = task.progress
            group_info = {
                'groupId': group_id,
                'groupName': task.rule_group.get('title', '未命名') if task.rule_group else '未命名',
                'totalDownloads': progress.total_files if progress else 0,
                'completedDownloads': progress.completed_files if progress else 0,
                'failedDownloads': progress.failed_files if progress else 0,
                'activeDownloads': progress.active_files if progress else 0,
                'totalSize': progress.total_size if progress else 0,
                'downloadedSize': progress.downloaded_size if progress else 0,
                'progressPercent': progress.progress_percent if progress else 0,
                'downloadSpeed': progress.download_speed if progress else 0,
                'etaSeconds': progress.eta_seconds if progress else None,
                'createdAt': task.created_at.isoformat() if task.created_at else None,
                'updatedAt': task.updated_at.isoformat() if task.updated_at else None,
                'status': task.status.value
            }
            groups.append(group_info)

    print(f"✓ 找到 {len(groups)} 个下载组")
    for i, group in enumerate(groups, 1):
        print(f"\n  组 {i}:")
        print(f"    组ID: {group['groupId']}")
        print(f"    组名: {group['groupName']}")
        print(f"    状态: {group['status']}")
        print(f"    进度: {group['progressPercent']}%")
        print(f"    创建时间: {group['createdAt']}")

    print("\n" + "=" * 60)
    if groups:
        print("✅ 测试成功！下载组可以正常显示")
    else:
        print("⚠ 警告：没有找到下载组")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_groups())
