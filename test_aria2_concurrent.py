"""
测试 Aria2Manager 并发启动场景
验证只会创建一个 aria2c 进程
"""

import sys
import io
import threading
import time
from pathlib import Path

# 设置标准输出/错误流为UTF-8编码(解决Windows GBK编码问题)
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 添加服务器目录到 Python 路径
server_dir = Path(__file__).resolve().parent / "pyJianYingDraftServer"
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from app.services.aria2_manager import get_aria2_manager


def start_aria2_worker(worker_id: int, results: list):
    """模拟并发启动 Aria2 的工作线程"""
    print(f"[Worker {worker_id}] 开始启动 Aria2...")

    try:
        manager = get_aria2_manager()
        success = manager.start()

        result = {
            'worker_id': worker_id,
            'success': success,
            'pid': manager.process.pid if manager.process else None
        }

        results.append(result)
        print(f"[Worker {worker_id}] 启动{'成功' if success else '失败'}, PID: {result['pid']}")

    except Exception as e:
        print(f"[Worker {worker_id}] 异常: {e}")
        results.append({
            'worker_id': worker_id,
            'success': False,
            'error': str(e)
        })


def test_concurrent_start():
    """测试并发启动场景"""
    print("=" * 60)
    print("测试场景: 模拟 5 个线程同时启动 Aria2")
    print("=" * 60)

    results = []
    threads = []

    # 创建 5 个并发线程
    for i in range(5):
        thread = threading.Thread(
            target=start_aria2_worker,
            args=(i + 1, results)
        )
        threads.append(thread)

    # 同时启动所有线程
    print("\n🚀 同时启动所有线程...\n")
    start_time = time.time()

    for thread in threads:
        thread.start()

    # 等待所有线程完成
    for thread in threads:
        thread.join()

    elapsed = time.time() - start_time

    # 分析结果
    print("\n" + "=" * 60)
    print("测试结果:")
    print("=" * 60)

    success_count = sum(1 for r in results if r.get('success'))
    print(f"✓ 总共启动请求: {len(results)}")
    print(f"✓ 成功启动: {success_count}")
    print(f"✓ 耗时: {elapsed:.2f} 秒")

    # 检查所有成功的结果是否使用同一个 PID
    pids = [r.get('pid') for r in results if r.get('success') and r.get('pid')]
    unique_pids = set(pids)

    print(f"\n📊 进程 PID 分析:")
    print(f"   - 唯一 PID 数量: {len(unique_pids)}")
    print(f"   - PIDs: {unique_pids}")

    if len(unique_pids) == 1:
        print("\n✅ 测试通过: 所有线程共享同一个 Aria2 进程")
    else:
        print("\n❌ 测试失败: 创建了多个 Aria2 进程!")

    # 详细结果
    print(f"\n详细结果:")
    for r in results:
        print(f"  Worker {r['worker_id']}: "
              f"{'成功' if r.get('success') else '失败'}, "
              f"PID={r.get('pid', 'N/A')}")

    # 清理: 停止 Aria2
    print("\n🛑 清理资源...")
    try:
        manager = get_aria2_manager()
        manager.stop()
        print("✓ Aria2 已停止")
    except Exception as e:
        print(f"✗ 停止失败: {e}")

    print("=" * 60)


if __name__ == "__main__":
    test_concurrent_start()
