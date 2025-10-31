"""
工作流执行历史本地存储服务
提供执行历史的本地 JSON 文件存储和读取功能
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path
import asyncio
from threading import Lock


class ExecutionHistoryService:
    """工作流执行历史本地存储服务"""

    def __init__(self, storage_dir: str = "data/execution_history"):
        """
        初始化服务

        Args:
            storage_dir: 存储目录路径
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def _safe_serialize(self, obj):
        """安全序列化对象，处理不可序列化的类型"""
        if obj is None:
            return None
        elif isinstance(obj, (str, int, float, bool)):
            return obj
        elif isinstance(obj, (list, tuple)):
            return [self._safe_serialize(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: self._safe_serialize(value) for key, value in obj.items()}
        elif hasattr(obj, '__dict__'):
            # 对于有 __dict__ 的对象，尝试序列化其属性
            try:
                return {key: self._safe_serialize(value) for key, value in obj.__dict__.items() if not key.startswith('_')}
            except:
                return str(obj)
        else:
            # 其他类型转换为字符串
            return str(obj)

    def _get_workflow_file(self, workflow_id: str) -> Path:
        """
        获取工作流执行历史文件路径

        Args:
            workflow_id: 工作流 ID

        Returns:
            文件路径
        """
        # 使用工作流 ID 创建独立的 JSON 文件
        return self.storage_dir / f"{workflow_id}.json"

    def _load_workflow_history(self, workflow_id: str) -> List[Dict[str, Any]]:
        """
        加载工作流的执行历史

        Args:
            workflow_id: 工作流 ID

        Returns:
            执行历史列表
        """
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
        """
        保存工作流的执行历史

        Args:
            workflow_id: 工作流 ID
            histories: 执行历史列表
        """
        file_path = self._get_workflow_file(workflow_id)

        try:
            # 按创建时间倒序排序
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
        """
        创建执行记录（工作流开始时调用）

        Args:
            workflow_id: 工作流 ID
            execute_id: 执行 ID（可选，不传则自动生成）
            parameters: 输入参数
            bot_id: Bot ID
            conversation_id: 会话 ID
            metadata: 额外元数据

        Returns:
            执行记录
        """
        with self._lock:
            # 生成执行 ID
            if not execute_id:
                execute_id = str(uuid.uuid4())

            # 创建时间戳（毫秒）
            create_time = int(datetime.now().timestamp() * 1000)

            # 构建执行记录（使用安全序列化）
            record = {
                "execute_id": execute_id,
                "workflow_id": workflow_id,
                "create_time": create_time,
                "update_time": create_time,
                "execute_status": "running",
                "error_code": None,
                "error_message": None,
                "output": None,
                "input_parameters": self._safe_serialize(parameters or {}),
                "bot_id": bot_id,
                "conversation_id": conversation_id,
                "debug_url": None,
                "run_mode": 1,  # 默认异步模式
                "connector_id": None,
                "connector_uid": None,
                "is_output_trimmed": False,
                "usage": None,
                "node_execute_status": None,
                "metadata": self._safe_serialize(metadata or {})
            }

            # 加载现有历史
            histories = self._load_workflow_history(workflow_id)

            # 添加新记录
            histories.append(record)

            # 保存
            self._save_workflow_history(workflow_id, histories)

            print(f"✅ 创建执行记录: {execute_id} (工作流: {workflow_id})")
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
        """
        更新执行记录（工作流执行完成时调用）

        Args:
            workflow_id: 工作流 ID
            execute_id: 执行 ID
            execute_status: 执行状态 (success/failed/interrupted/running)
            output: 输出数据
            error_code: 错误代码
            error_message: 错误消息
            debug_url: 调试 URL
            usage: 使用统计
            node_execute_status: 节点执行状态
            metadata: 额外元数据

        Returns:
            更新后的执行记录，如果记录不存在返回 None
        """
        with self._lock:
            # 加载现有历史
            histories = self._load_workflow_history(workflow_id)

            # 查找并更新记录
            record = None
            for i, h in enumerate(histories):
                if h.get("execute_id") == execute_id:
                    record = h

                    # 更新时间戳
                    record["update_time"] = int(datetime.now().timestamp() * 1000)

                    # 更新字段（使用安全序列化）
                    if execute_status is not None:
                        record["execute_status"] = execute_status
                    if output is not None:
                        record["output"] = self._safe_serialize(output)
                    if error_code is not None:
                        record["error_code"] = error_code
                    if error_message is not None:
                        record["error_message"] = error_message
                    if debug_url is not None:
                        record["debug_url"] = debug_url
                    if usage is not None:
                        record["usage"] = self._safe_serialize(usage)
                    if node_execute_status is not None:
                        record["node_execute_status"] = self._safe_serialize(node_execute_status)
                    if metadata is not None:
                        record["metadata"].update(self._safe_serialize(metadata))

                    histories[i] = record
                    break

            if record is None:
                print(f"⚠️ 执行记录不存在: {execute_id} (工作流: {workflow_id})")
                return None

            # 保存
            self._save_workflow_history(workflow_id, histories)

            print(f"✅ 更新执行记录: {execute_id} (状态: {execute_status})")
            return record

    async def get_execution_history(
        self,
        workflow_id: str,
        page_size: int = 20,
        page_index: int = 1
    ) -> Dict[str, Any]:
        """
        获取工作流执行历史列表

        Args:
            workflow_id: 工作流 ID
            page_size: 每页数量
            page_index: 页码（从 1 开始）

        Returns:
            执行历史列表
        """
        histories = self._load_workflow_history(workflow_id)

        # 计算分页
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
        """
        获取单个执行记录的详细信息

        Args:
            workflow_id: 工作流 ID
            execute_id: 执行 ID

        Returns:
            执行记录详情，如果不存在返回 None
        """
        histories = self._load_workflow_history(workflow_id)

        # 查找记录
        for history in histories:
            if history.get("execute_id") == execute_id:
                return history

        return None

    async def delete_execution_record(
        self,
        workflow_id: str,
        execute_id: str
    ) -> bool:
        """
        删除执行记录

        Args:
            workflow_id: 工作流 ID
            execute_id: 执行 ID

        Returns:
            是否成功删除
        """
        with self._lock:
            histories = self._load_workflow_history(workflow_id)

            # 查找并删除记录
            new_histories = [h for h in histories if h.get("execute_id") != execute_id]

            if len(new_histories) == len(histories):
                return False

            # 保存
            self._save_workflow_history(workflow_id, new_histories)

            print(f"✅ 删除执行记录: {execute_id} (工作流: {workflow_id})")
            return True

    async def clear_workflow_history(self, workflow_id: str) -> bool:
        """
        清空工作流的所有执行历史

        Args:
            workflow_id: 工作流 ID

        Returns:
            是否成功
        """
        with self._lock:
            file_path = self._get_workflow_file(workflow_id)
            if file_path.exists():
                file_path.unlink()
                print(f"✅ 清空执行历史: {workflow_id}")
                return True
            return False

    async def get_all_workflows(self) -> List[str]:
        """
        获取所有有执行历史的工作流 ID

        Returns:
            工作流 ID 列表
        """
        workflow_ids = []
        for file_path in self.storage_dir.glob("*.json"):
            workflow_id = file_path.stem
            workflow_ids.append(workflow_id)

        return workflow_ids


# 全局服务实例
_execution_history_service: Optional[ExecutionHistoryService] = None


def get_execution_history_service() -> ExecutionHistoryService:
    """获取执行历史服务单例"""
    global _execution_history_service
    if _execution_history_service is None:
        _execution_history_service = ExecutionHistoryService()
    return _execution_history_service
