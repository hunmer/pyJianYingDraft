#!/usr/bin/env python3
"""
Aria2 客户端重试功能使用示例

展示如何使用新的自动重试和失败恢复功能
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.aria2_client import Aria2Client


async def example_single_download():
    """示例1: 单文件下载with自动重试"""
    print("=" * 70)
    print("示例1: 单文件下载 (自动重试)")
    print("=" * 70)

    # 创建客户端,启用自动重试
    client = Aria2Client(
        rpc_url="http://localhost:6800/jsonrpc",
        max_retries=3,           # 最多重试3次
        retry_delay=1.0,         # 基础延迟1秒
        auto_restart_failed=True, # 自动重启失败的任务
        verbose=True             # 显示详细日志
    )

    try:
        # 添加下载任务
        url = "http://httpbin.org/image/png"
        save_path = "/tmp/test_image.png"

        gid = await client.add_download(url, save_path)
        print(f"\n✓ 下载任务已添加")
        print(f"  GID: {gid}")
        print(f"  URL: {url}")
        print(f"  保存路径: {save_path}")

        # 监控下载进度
        print("\n开始监控下载进度...")
        while True:
            await asyncio.sleep(1)

            progress = client.get_progress(gid)
            if not progress:
                print("⚠️  无法获取进度信息")
                break

            # 状态图标
            status_icon = {
                "active": "🔄",
                "complete": "✅",
                "error": "❌",
                "waiting": "⏳",
                "paused": "⏸️"
            }.get(progress.status, "❓")

            print(f"{status_icon} 状态: {progress.status:10s} | "
                  f"进度: {progress.progress_percent:6.2f}% | "
                  f"速度: {progress.download_speed / 1024:.2f} KB/s")

            # 如果出错,显示重试信息
            if progress.status == "error":
                retry_info = client.get_retry_info(gid)
                print(f"   ⚠️  下载失败: {progress.error_message}")
                print(f"   🔁 重试次数: {retry_info['retry_count']}/{retry_info['max_retries']}")

                if not retry_info['can_retry']:
                    print(f"   ❌ 已达最大重试次数,放弃下载")
                    break

            # 下载完成
            if progress.status == "complete":
                print(f"\n{'=' * 70}")
                print("✅ 下载完成!")
                print(f"文件路径: {progress.file_path}")
                print(f"文件大小: {progress.total_length / 1024:.2f} KB")
                print(f"{'=' * 70}")
                break

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        print("\n请确保:")
        print("  1. aria2c 服务正在运行")
        print("  2. 运行命令: aria2c --enable-rpc --rpc-listen-port=6800")


async def example_batch_download():
    """示例2: 批量下载with失败重试"""
    print("\n" + "=" * 70)
    print("示例2: 批量下载 (自动处理失败)")
    print("=" * 70)

    client = Aria2Client(
        max_retries=5,            # 批量下载使用更高的重试次数
        retry_delay=2.0,
        auto_restart_failed=True,
        verbose=True
    )

    # 准备批量下载列表
    urls_with_paths = [
        ("http://httpbin.org/image/png", "/tmp/batch_test1.png"),
        ("http://httpbin.org/image/jpeg", "/tmp/batch_test2.jpg"),
        ("http://httpbin.org/image/webp", "/tmp/batch_test3.webp"),
    ]

    try:
        # 添加批量下载
        batch_id = await client.add_batch_downloads(urls_with_paths)
        print(f"\n✓ 批量下载已启动")
        print(f"  批次ID: {batch_id}")
        print(f"  文件数量: {len(urls_with_paths)}")

        # 监控批次进度
        print("\n开始监控批量下载...")
        last_completed = 0

        while True:
            await asyncio.sleep(2)

            batch_progress = client.get_batch_progress(batch_id)
            if not batch_progress:
                print("⚠️  无法获取批次进度")
                break

            # 显示总体进度
            print(f"\n--- 批次进度 ---")
            print(f"总进度: {batch_progress.progress_percent:.1f}%")
            print(f"完成/失败/活跃: {batch_progress.completed_count}/"
                  f"{batch_progress.failed_count}/{batch_progress.active_count}")
            print(f"下载速度: {batch_progress.total_speed / 1024:.2f} KB/s")

            # 如果有新完成的文件,显示详情
            if batch_progress.completed_count > last_completed:
                print("\n✅ 新完成的文件:")
                for dl in batch_progress.downloads:
                    if dl.status == "complete":
                        print(f"  • {dl.file_path}")
                last_completed = batch_progress.completed_count

            # 如果有失败的,显示重试信息
            if batch_progress.failed_count > 0:
                print("\n⚠️  失败的任务:")
                for dl in batch_progress.downloads:
                    if dl.status == "error":
                        retry_info = client.get_retry_info(dl.gid)
                        print(f"  • GID: {dl.gid[:8]}... | "
                              f"重试: {retry_info['retry_count']}/{retry_info['max_retries']}")

            # 检查是否全部完成
            if batch_progress.is_completed:
                print(f"\n{'=' * 70}")
                print("✅ 批量下载完成!")
                print(f"成功: {batch_progress.completed_count} 个文件")
                print(f"失败: {batch_progress.failed_count} 个文件")
                print(f"总下载量: {batch_progress.downloaded_size / 1024 / 1024:.2f} MB")
                print(f"{'=' * 70}")
                break

    except Exception as e:
        print(f"\n❌ 错误: {e}")


async def example_manual_retry():
    """示例3: 手动控制重试"""
    print("\n" + "=" * 70)
    print("示例3: 手动控制重试")
    print("=" * 70)

    # 禁用自动重启
    client = Aria2Client(
        max_retries=3,
        auto_restart_failed=False,  # 禁用自动重启
        verbose=True
    )

    try:
        # 添加一个可能失败的下载
        url = "http://httpbin.org/delay/10"  # 延迟响应的URL
        gid = await client.add_download(url, "/tmp/test_delay.txt")

        print(f"\n✓ 下载任务已添加: {gid}")
        print("监控任务状态...")

        for i in range(15):
            await asyncio.sleep(1)

            # 获取进度 (不自动重启)
            progress = client.get_progress(gid, auto_restart=False)

            if progress:
                print(f"[{i+1}] 状态: {progress.status}")

                # 手动判断是否需要重启
                if progress.status == "error":
                    retry_info = client.get_retry_info(gid)
                    print(f"\n⚠️  任务失败!")
                    print(f"错误: {progress.error_message}")
                    print(f"当前重试次数: {retry_info['retry_count']}")

                    if retry_info['can_retry']:
                        print("手动重启任务...")
                        new_gid = await client._restart_failed_download(gid)
                        if new_gid:
                            print(f"✓ 任务已重启,新 GID: {new_gid}")
                            gid = new_gid
                        else:
                            print("❌ 重启失败")
                            break
                    else:
                        print("❌ 已达最大重试次数")
                        break

                elif progress.status == "complete":
                    print("\n✅ 下载完成!")
                    break

    except Exception as e:
        print(f"\n❌ 错误: {e}")


async def example_bulk_restart():
    """示例4: 批量重启所有失败任务"""
    print("\n" + "=" * 70)
    print("示例4: 批量重启失败任务")
    print("=" * 70)

    client = Aria2Client(verbose=True)

    try:
        # 获取所有下载任务
        all_downloads = client.get_all_downloads()
        print(f"\n当前有 {len(all_downloads)} 个下载任务")

        failed_count = sum(1 for d in all_downloads if d.status == "error")
        if failed_count > 0:
            print(f"发现 {failed_count} 个失败任务")
            print("\n开始批量重启...")

            restarted = await client.restart_all_failed_downloads()
            print(f"\n✓ 已重启 {restarted} 个任务")
        else:
            print("没有失败的任务")

    except Exception as e:
        print(f"\n❌ 错误: {e}")


async def main():
    """运行所有示例"""
    print("Aria2 客户端重试功能示例")
    print("=" * 70)
    print("\n注意: 运行前请确保 aria2c 服务已启动:")
    print("  aria2c --enable-rpc --rpc-listen-port=6800")
    print()

    # 示例1: 单文件下载
    await example_single_download()

    # 示例2: 批量下载
    await example_batch_download()

    # 示例3: 手动控制
    # await example_manual_retry()

    # 示例4: 批量重启
    # await example_bulk_restart()

    print("\n" + "=" * 70)
    print("所有示例完成!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
