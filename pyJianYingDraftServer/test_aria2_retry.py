#!/usr/bin/env python3
"""
测试Aria2客户端的重试功能

该脚本演示:
1. 连接失败时的自动重试
2. 下载失败任务的自动重启
3. 批量下载中失败任务的处理
"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from app.services.aria2_client import Aria2Client


async def test_retry_on_connection_error():
    """测试连接错误时的重试机制"""
    print("=" * 60)
    print("测试1: 连接错误时的自动重试")
    print("=" * 60)

    # 使用错误的端口测试重试
    client = Aria2Client(
        rpc_url="http://localhost:9999/jsonrpc",  # 错误的端口
        verbose=True,
        max_retries=3,
        retry_delay=0.5  # 快速重试用于测试
    )

    try:
        await client.add_download("http://example.com/test.txt")
        print("❌ 测试失败: 应该抛出异常")
    except Exception as e:
        print(f"✅ 测试通过: 正确抛出异常 - {type(e).__name__}")
        print(f"   错误信息: {e}")


async def test_auto_restart_failed():
    """测试失败任务的自动重启"""
    print("\n" + "=" * 60)
    print("测试2: 失败任务的自动重启")
    print("=" * 60)
    print("注意: 此测试需要 aria2c 服务运行在 localhost:6800")

    client = Aria2Client(
        rpc_url="http://localhost:6800/jsonrpc",
        verbose=True,
        max_retries=3,
        retry_delay=1.0,
        auto_restart_failed=True
    )

    # 添加一个会失败的下载 (无效URL)
    try:
        gid = await client.add_download(
            "http://invalid-domain-12345.com/test.txt",
            save_path="/tmp/test.txt"
        )
        print(f"\n✓ 已添加下载任务: GID={gid}")

        # 等待任务失败
        print("\n等待任务失败...")
        await asyncio.sleep(5)

        # 获取进度 (会触发自动重启)
        progress = client.get_progress(gid)
        if progress:
            print(f"\n当前状态: {progress.status}")
            print(f"错误码: {progress.error_code}")
            print(f"错误信息: {progress.error_message}")

        # 获取重试信息
        retry_info = client.get_retry_info(gid)
        print(f"\n重试信息: {retry_info}")

        # 等待一段时间看是否自动重启
        print("\n等待自动重启...")
        await asyncio.sleep(3)

        # 手动触发重启所有失败任务
        restarted = await client.restart_all_failed_downloads()
        print(f"\n手动重启结果: {restarted} 个任务")

    except Exception as e:
        print(f"\n⚠️  测试需要 aria2c 服务: {e}")


async def test_batch_download_with_retry():
    """测试批量下载中的重试逻辑"""
    print("\n" + "=" * 60)
    print("测试3: 批量下载中的失败处理")
    print("=" * 60)
    print("注意: 此测试需要 aria2c 服务运行在 localhost:6800")

    client = Aria2Client(
        rpc_url="http://localhost:6800/jsonrpc",
        verbose=True,
        max_retries=2,
        retry_delay=1.0,
        auto_restart_failed=True
    )

    urls_with_paths = [
        ("http://httpbin.org/image/png", "/tmp/test1.png"),  # 有效URL
        ("http://invalid-domain-12345.com/test.txt", "/tmp/test2.txt"),  # 无效URL
        ("http://httpbin.org/image/jpeg", "/tmp/test3.jpg"),  # 有效URL
    ]

    try:
        batch_id = await client.add_batch_downloads(urls_with_paths)
        print(f"\n✓ 批量下载已添加: batch_id={batch_id}")

        # 监控批次进度
        for i in range(10):
            await asyncio.sleep(2)
            batch_progress = client.get_batch_progress(batch_id)

            if batch_progress:
                print(f"\n--- 进度更新 ({i+1}/10) ---")
                print(f"总文件数: {len(batch_progress.downloads)}")
                print(f"已完成: {batch_progress.completed_count}")
                print(f"失败: {batch_progress.failed_count}")
                print(f"活跃: {batch_progress.active_count}")
                print(f"总进度: {batch_progress.progress_percent:.1f}%")

                # 显示每个任务的状态
                for dl in batch_progress.downloads:
                    status_icon = {
                        "active": "🔄",
                        "complete": "✅",
                        "error": "❌",
                        "waiting": "⏳"
                    }.get(dl.status, "❓")

                    print(f"  {status_icon} GID: {dl.gid[:8]}... | "
                          f"状态: {dl.status:8s} | "
                          f"进度: {dl.progress_percent:5.1f}%")

                    # 显示重试信息
                    retry_info = client.get_retry_info(dl.gid)
                    if retry_info['retry_count'] > 0:
                        print(f"      🔁 重试次数: {retry_info['retry_count']}/{retry_info['max_retries']}")

                if batch_progress.is_completed:
                    print("\n✅ 批量下载已完成!")
                    break

        # 最终统计
        batch_progress = client.get_batch_progress(batch_id)
        if batch_progress:
            print(f"\n{'=' * 60}")
            print("最终统计")
            print(f"{'=' * 60}")
            print(f"成功: {batch_progress.completed_count}")
            print(f"失败: {batch_progress.failed_count}")
            print(f"总大小: {batch_progress.total_size / 1024 / 1024:.2f} MB")
            print(f"已下载: {batch_progress.downloaded_size / 1024 / 1024:.2f} MB")

    except Exception as e:
        print(f"\n⚠️  测试需要 aria2c 服务: {e}")


async def main():
    """运行所有测试"""
    print("Aria2 客户端重试功能测试")
    print("=" * 60)

    # 测试1: 连接错误重试
    await test_retry_on_connection_error()

    # 测试2: 失败任务自动重启
    await test_auto_restart_failed()

    # 测试3: 批量下载中的重试
    await test_batch_download_with_retry()

    print("\n" + "=" * 60)
    print("所有测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
