"""
执行历史本地存储功能简单测试（不依赖整个应用）
"""

import asyncio
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
import uuid
from threading import Lock


# 复制执行历史服务的核心代码进行独立测试
class ExecutionHistoryService:
    """工作流执行历史本地存储服务"""

    def __init__(self, storage_dir: str = "data/execution_history"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def _get_workflow_file(self, workflow_id: str) -> Path:
        return self.storage_dir / f"{workflow_id}.json"

    def _load_workflow_history(self, workflow_id: str) -> List[Dict[str, Any]]:
        file_path = self._get_workflow_file(workflow_id)
        if not file_path.exists():
            return []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("histories", [])
        except Exception as e:
            print(f"⚠️ 加载执行历史失败 ({workflow_id}): {e}")
            return []

    def _save_workflow_history(self, workflow_id: str, histories: List[Dict[str, Any]]):
        file_path = self._get_workflow_file(workflow_id)

        try:
            histories.sort(key=lambda h: h.get("create_time", 0), reverse=True)

            data = {
                "workflow_id": workflow_id,
                "total": len(histories),
                "histories": histories,
                "updated_at": int(datetime.now().timestamp() * 1000)
            }

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            print(f"⚠️ 保存执行历史失败 ({workflow_id}): {e}")
            raise

    async def create_execution_record(
        self,
        workflow_id: str,
        execute_id: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        bot_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        with self._lock:
            if not execute_id:
                execute_id = str(uuid.uuid4())

            create_time = int(datetime.now().timestamp() * 1000)

            record = {
                "execute_id": execute_id,
                "workflow_id": workflow_id,
                "create_time": create_time,
                "update_time": create_time,
                "execute_status": "running",
                "error_code": None,
                "error_message": None,
                "output": None,
                "input_parameters": parameters or {},
                "bot_id": bot_id,
                "conversation_id": conversation_id,
                "debug_url": None,
                "run_mode": 1,
                "connector_id": None,
                "connector_uid": None,
                "is_output_trimmed": False,
                "usage": None,
                "node_execute_status": None,
                "metadata": metadata or {}
            }

            histories = self._load_workflow_history(workflow_id)
            histories.append(record)
            self._save_workflow_history(workflow_id, histories)

            print(f"创建执行记录: {execute_id} (工作流: {workflow_id})")
            return record

    async def update_execution_record(
        self,
        workflow_id: str,
        execute_id: str,
        execute_status: Optional[str] = None,
        output: Optional[Dict[str, Any]] = None,
        error_code: Optional[int] = None,
        error_message: Optional[str] = None,
        debug_url: Optional[str] = None,
        usage: Optional[Dict[str, Any]] = None,
        node_execute_status: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            histories = self._load_workflow_history(workflow_id)

            record = None
            for i, h in enumerate(histories):
                if h.get("execute_id") == execute_id:
                    record = h
                    record["update_time"] = int(datetime.now().timestamp() * 1000)

                    if execute_status is not None:
                        record["execute_status"] = execute_status
                    if output is not None:
                        record["output"] = output
                    if error_code is not None:
                        record["error_code"] = error_code
                    if error_message is not None:
                        record["error_message"] = error_message
                    if debug_url is not None:
                        record["debug_url"] = debug_url
                    if usage is not None:
                        record["usage"] = usage
                    if node_execute_status is not None:
                        record["node_execute_status"] = node_execute_status
                    if metadata is not None:
                        record["metadata"].update(metadata)

                    histories[i] = record
                    break

            if record is None:
                print(f"⚠️ 执行记录不存在: {execute_id} (工作流: {workflow_id})")
                return None

            self._save_workflow_history(workflow_id, histories)
            print(f"更新执行记录: {execute_id} (状态: {execute_status})")
            return record

    async def get_execution_history(
        self,
        workflow_id: str,
        page_size: int = 20,
        page_index: int = 1
    ) -> Dict[str, Any]:
        histories = self._load_workflow_history(workflow_id)

        total = len(histories)
        start = (page_index - 1) * page_size
        end = start + page_size
        paged_histories = histories[start:end]
        has_more = end < total

        return {
            "histories": paged_histories,
            "total": total,
            "has_more": has_more
        }

    async def get_execution_detail(
        self,
        workflow_id: str,
        execute_id: str
    ) -> Optional[Dict[str, Any]]:
        histories = self._load_workflow_history(workflow_id)

        for history in histories:
            if history.get("execute_id") == execute_id:
                return history

        return None

    async def get_all_workflows(self) -> List[str]:
        workflow_ids = []
        for file_path in self.storage_dir.glob("*.json"):
            workflow_id = file_path.stem
            workflow_ids.append(workflow_id)

        return workflow_ids

    async def clear_workflow_history(self, workflow_id: str) -> bool:
        with self._lock:
            file_path = self._get_workflow_file(workflow_id)
            if file_path.exists():
                file_path.unlink()
                print(f"清空执行历史: {workflow_id}")
                return True
            return False


async def test_execution_history():
    """测试执行历史服务的基本功能"""
    print("开始测试执行历史本地存储功能...")

    service = ExecutionHistoryService()
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
        print(f"创建成功: {execute_id}")

        # 2. 获取执行历史列表
        print("\n2. 获取执行历史列表...")
        history = await service.get_execution_history(workflow_id=workflow_id)
        print(f"获取成功: 总共 {history['total']} 条记录")
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
            print(f"更新成功: 状态 -> {updated['execute_status']}")

        # 4. 获取单个执行记录详情
        print("\n4. 获取执行记录详情...")
        detail = await service.get_execution_detail(workflow_id=workflow_id, execute_id=execute_id)
        if detail:
            print(f"获取成功: 输出 -> {detail.get('output')}")
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
        print("创建了 5 条新记录")

        # 6. 测试分页
        print("\n6. 测试分页功能...")
        page1 = await service.get_execution_history(workflow_id=workflow_id, page_size=3, page_index=1)
        page2 = await service.get_execution_history(workflow_id=workflow_id, page_size=3, page_index=2)
        print(f"第1页: {len(page1['histories'])} 条记录")
        print(f"第2页: {len(page2['histories'])} 条记录")
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
        print(f"创建失败记录: {failed_id}")

        # 8. 获取所有工作流
        print("\n8. 获取所有工作流列表...")
        workflows = await service.get_all_workflows()
        print(f"找到 {len(workflows)} 个工作流: {workflows}")

        # 9. 检查文件存储
        print("\n9. 检查文件存储...")
        file_path = service._get_workflow_file(workflow_id)
        if file_path.exists():
            file_size = file_path.stat().st_size
            print(f"文件已保存: {file_path} ({file_size} bytes)")
            # 显示文件内容的前几行
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                print(f"   文件内容预览: {len(lines)} 行")
                if lines:
                    print(f"   第一行: {lines[0].strip()}")
        else:
            print("文件未找到")

        print("\n所有测试通过！")

    except Exception as e:
        print(f"测试失败: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # 清理测试数据
        print("\n清理测试数据...")
        try:
            await service.clear_workflow_history(workflow_id)
            print("清理完成")
        except Exception as e:
            print(f"清理失败: {e}")


if __name__ == "__main__":
    # 确保数据目录存在
    os.makedirs("data/execution_history", exist_ok=True)

    # 运行测试
    asyncio.run(test_execution_history())