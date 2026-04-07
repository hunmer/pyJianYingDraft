"""
执行历史本地存储功能测试
"""

import asyncio
import os
from app.services.execution_history_service import get_execution_history_service


async def test_execution_history():
    """测试执行历史服务的基本功能"""
    print("🧪 开始测试执行历史本地存储功能...")

    service = get_execution_history_service()
    workflow_id = "test_workflow_123"

    try:
        # 1. 创建执行记录
        print("\n1. 创建执行记录...")
        record = await service.create_execution_record(
            workflow_id=workflow_id,
            parameters={"input_text": "测试输入", "count": 42},
            bot_id="test_bot",
            conversation_id="conv_123"
        )
        execute_id = record["execute_id"]
        print(f"✅ 创建成功: {execute_id}")

        # 2. 获取执行历史列表
        print("\n2. 获取执行历史列表...")
        history = await service.get_execution_history(workflow_id=workflow_id)
        print(f"✅ 获取成功: 总共 {history['total']} 条记录")
        for h in history["histories"]:
            print(f"   - 执行ID: {h['execute_id']}, 状态: {h['execute_status']}")

        # 3. 更新执行记录（成功）
        print("\n3. 更新执行记录（成功）...")
        updated = await service.update_execution_record(
            workflow_id=workflow_id,
            execute_id=execute_id,
            execute_status="success",
            output={"result": "测试结果", "score": 95},
            usage={"tokens": 100, "cost": 0.01}
        )
        if updated:
            print(f"✅ 更新成功: 状态 -> {updated['execute_status']}")

        # 4. 获取单个执行记录详情
        print("\n4. 获取执行记录详情...")
        detail = await service.get_execution_detail(workflow_id=workflow_id, execute_id=execute_id)
        if detail:
            print(f"✅ 获取成功: 输出 -> {detail.get('output')}")
            print(f"   创建时间: {detail.get('create_time')}")
            print(f"   更新时间: {detail.get('update_time')}")

        # 5. 创建更多测试记录
        print("\n5. 创建更多测试记录...")
        for i in range(5):
            await service.create_execution_record(
                workflow_id=workflow_id,
                parameters={"test_index": i},
                bot_id="test_bot",
                conversation_id=f"conv_{i}"
            )
        print("✅ 创建了 5 条新记录")

        # 6. 测试分页
        print("\n6. 测试分页功能...")
        page1 = await service.get_execution_history(workflow_id=workflow_id, page_size=3, page_index=1)
        page2 = await service.get_execution_history(workflow_id=workflow_id, page_size=3, page_index=2)
        print(f"✅ 第1页: {len(page1['histories'])} 条记录")
        print(f"✅ 第2页: {len(page2['histories'])} 条记录")
        print(f"   总数: {page1['total']}, 是否有更多: {page1['has_more']}")

        # 7. 创建失败记录
        print("\n7. 测试失败记录...")
        failed_record = await service.create_execution_record(
            workflow_id=workflow_id,
            parameters={"should_fail": True}
        )
        failed_id = failed_record["execute_id"]
        await service.update_execution_record(
            workflow_id=workflow_id,
            execute_id=failed_id,
            execute_status="failed",
            error_message="测试错误消息",
            error_code=500
        )
        print(f"✅ 创建失败记录: {failed_id}")

        # 8. 获取所有工作流
        print("\n8. 获取所有工作流列表...")
        workflows = await service.get_all_workflows()
        print(f"✅ 找到 {len(workflows)} 个工作流: {workflows}")

        # 9. 检查文件存储
        print("\n9. 检查文件存储...")
        file_path = service._get_workflow_file(workflow_id)
        if file_path.exists():
            file_size = file_path.stat().st_size
            print(f"✅ 文件已保存: {file_path} ({file_size} bytes)")
        else:
            print("❌ 文件未找到")

        print("\n🎉 所有测试通过！")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # 清理测试数据
        print("\n🧹 清理测试数据...")
        try:
            await service.clear_workflow_history(workflow_id)
            print("✅ 清理完成")
        except Exception as e:
            print(f"⚠️ 清理失败: {e}")


if __name__ == "__main__":
    # 确保数据目录存在
    os.makedirs("data/execution_history", exist_ok=True)

    # 运行测试
    asyncio.run(test_execution_history())