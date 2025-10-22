"""
Aria2 Manager 启动测试脚本

测试改进后的启动流程：
1. 命令行输出
2. RPC连接验证
3. 启动重试机制
"""

import sys
from pathlib import Path

# 直接导入模块，避免其他依赖问题
sys.path.insert(0, str(Path(__file__).resolve().parent / "app" / "services"))

from aria2_manager import Aria2ProcessManager


def test_basic_startup():
    """测试基本启动流程"""
    print("=" * 60)
    print("测试1: 基本启动流程")
    print("=" * 60)

    manager = Aria2ProcessManager(verbose=True)

    print("\n启动Aria2进程...")
    success = manager.start()

    if success:
        print("\n✓ 启动成功！")
        print(f"  - RPC URL: {manager.get_rpc_url()}")
        print(f"  - RPC Secret: {manager.get_rpc_secret()[:10]}...")
        print(f"  - 进程PID: {manager.process.pid}")
    else:
        print("\n✗ 启动失败")
        return False

    print("\n停止Aria2进程...")
    manager.stop()
    print("✓ 测试完成")
    return True


def test_debug_output():
    """测试调试输出模式"""
    print("\n" + "=" * 60)
    print("测试2: 调试输出模式")
    print("=" * 60)

    manager = Aria2ProcessManager(verbose=True)

    print("\n启动Aria2进程 (调试输出模式)...")
    success = manager.start(enable_debug_output=True)

    if success:
        print("\n✓ 启动成功（调试输出已启用）")
    else:
        print("\n✗ 启动失败")
        return False

    print("\n等待5秒以观察输出...")
    import time
    time.sleep(5)

    print("\n停止Aria2进程...")
    manager.stop()
    print("✓ 测试完成")
    return True


def test_restart():
    """测试重启功能"""
    print("\n" + "=" * 60)
    print("测试3: 重启功能")
    print("=" * 60)

    manager = Aria2ProcessManager(verbose=True)

    print("\n首次启动...")
    manager.start()

    print("\n重启Aria2进程...")
    success = manager.restart()

    if success:
        print("\n✓ 重启成功")
    else:
        print("\n✗ 重启失败")
        return False

    print("\n停止Aria2进程...")
    manager.stop()
    print("✓ 测试完成")
    return True


def test_duplicate_start():
    """测试重复启动"""
    print("\n" + "=" * 60)
    print("测试4: 重复启动检测")
    print("=" * 60)

    manager = Aria2ProcessManager(verbose=True)

    print("\n首次启动...")
    manager.start()

    print("\n再次启动（应检测到已运行）...")
    success = manager.start()

    if success:
        print("\n✓ 正确处理重复启动")
    else:
        print("\n✗ 重复启动处理失败")
        return False

    print("\n停止Aria2进程...")
    manager.stop()
    print("✓ 测试完成")
    return True


def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("Aria2 Manager 启动流程测试")
    print("=" * 60)

    tests = [
        ("基本启动流程", test_basic_startup),
        ("调试输出模式", test_debug_output),
        ("重启功能", test_restart),
        ("重复启动检测", test_duplicate_start),
    ]

    results = []

    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n✗ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))

    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)

    for test_name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status} - {test_name}")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    print(f"\n总计: {passed}/{total} 个测试通过")

    if passed == total:
        print("\n🎉 所有测试通过！")
        return 0
    else:
        print(f"\n⚠ {total - passed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
