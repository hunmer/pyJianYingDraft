"""
Coze插件数据处理服务
"""

import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from collections import defaultdict

from app.models.coze_models import (
    CozePluginData,
    CozeSendDataRequest,
    CozeSendDataResponse,
    CozeSubscribeRequest,
    CozeSubscribeResponse,
    CozeUnsubscribeRequest,
    CozeUnsubscribeResponse,
    CozeSubscription,
    CozeDataCache,
    CozeDataType
)


class CozeService:
    """Coze数据服务 - 内存存储版本"""

    def __init__(self):
        # 订阅管理：client_id -> list[CozeSubscription]
        self._subscriptions: Dict[str, List[CozeSubscription]] = defaultdict(list)

        # Socket映射：socket_id -> set[client_id]
        self._socket_client_mapping: Dict[str, Set[str]] = defaultdict(set)

        # 数据缓存：client_id -> list[CozeDataCache]
        self._data_cache: Dict[str, List[CozeDataCache]] = defaultdict(list)

        # 统计信息
        self._stats = {
            "total_subscriptions": 0,
            "total_data_received": 0,
            "total_data_forwarded": 0,
            "active_connections": 0
        }

        # 清理任务（定期清理过期数据）
        self._cleanup_task: Optional[asyncio.Task] = None
        self._start_cleanup_task()

    def _start_cleanup_task(self):
        """启动定期清理任务"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def _periodic_cleanup(self):
        """定期清理过期数据（每5分钟执行一次）"""
        while True:
            try:
                await asyncio.sleep(300)  # 5分钟
                await self._cleanup_expired_data()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Coze服务清理任务出错: {e}")

    async def _cleanup_expired_data(self):
        """清理过期的数据和缓存"""
        current_time = datetime.now()
        expired_threshold = current_time - timedelta(hours=1)  # 1小时前的数据

        # 清理过期的数据缓存
        total_removed = 0
        for client_id in list(self._data_cache.keys()):
            expired_count = 0
            remaining_cache = []

            for cache_item in self._data_cache[client_id]:
                if cache_item.received_at < expired_threshold:
                    expired_count += 1
                else:
                    remaining_cache.append(cache_item)

            self._data_cache[client_id] = remaining_cache
            total_removed += expired_count

            # 如果缓存为空，删除该键
            if not self._data_cache[client_id]:
                del self._data_cache[client_id]

        if total_removed > 0:
            print(f"Coze服务清理: 移除了 {total_removed} 条过期数据缓存")

    async def receive_data(self, request: CozeSendDataRequest) -> CozeSendDataResponse:
        """
        接收Coze插件数据

        Args:
            request: Coze发送数据请求

        Returns:
            CozeSendDataResponse: 处理结果
        """
        try:
            # 创建插件数据对象
            plugin_data = CozePluginData(
                type=request.data.get("type", CozeDataType.TEXT),
                data=request.data.get("data", {}),
                client_id=request.client_id,
                timestamp=datetime.now()
            )

            # 验证数据类型
            if plugin_data.type not in CozeDataType:
                return CozeSendDataResponse(
                    success=False,
                    message=f"不支持的数据类型: {plugin_data.type}",
                    client_id=request.client_id
                )

            # 创建数据缓存
            cache_id = str(uuid.uuid4())
            data_cache = CozeDataCache(
                id=cache_id,
                client_id=request.client_id,
                data=plugin_data
            )

            # 存储到缓存
            self._data_cache[request.client_id].append(data_cache)

            # 更新统计
            self._stats["total_data_received"] += 1

            print(f"Coze数据接收: client_id={request.client_id}, type={plugin_data.type}, cache_id={cache_id}")

            return CozeSendDataResponse(
                success=True,
                message="数据接收成功",
                client_id=request.client_id
            )

        except Exception as e:
            print(f"Coze数据接收失败: {e}")
            return CozeSendDataResponse(
                success=False,
                message=f"数据接收失败: {str(e)}",
                client_id=request.client_id
            )

    async def subscribe(self, request: CozeSubscribeRequest, socket_id: str) -> CozeSubscribeResponse:
        """
        订阅Coze数据推送

        Args:
            request: 订阅请求
            socket_id: Socket.IO连接ID

        Returns:
            CozeSubscribeResponse: 订阅结果
        """
        try:
            # 检查是否已经订阅过
            existing_subscription = next(
                (sub for sub in self._subscriptions[request.client_id]
                 if sub.socket_id == socket_id and sub.is_active),
                None
            )

            if existing_subscription:
                return CozeSubscribeResponse(
                    success=True,
                    message="已经订阅过了",
                    client_id=request.client_id
                )

            # 创建新订阅
            subscription = CozeSubscription(
                client_id=request.client_id,
                socket_id=socket_id,
                workflow_id=request.workflow_id
            )

            # 添加到订阅列表
            self._subscriptions[request.client_id].append(subscription)
            self._socket_client_mapping[socket_id].add(request.client_id)

            # 更新统计
            self._stats["total_subscriptions"] += 1

            print(f"Coze订阅成功: client_id={request.client_id}, socket_id={socket_id}, workflow_id={request.workflow_id}")

            return CozeSubscribeResponse(
                success=True,
                message="订阅成功",
                client_id=request.client_id
            )

        except Exception as e:
            print(f"Coze订阅失败: {e}")
            return CozeSubscribeResponse(
                success=False,
                message=f"订阅失败: {str(e)}",
                client_id=request.client_id
            )

    async def unsubscribe(self, request: CozeUnsubscribeRequest, socket_id: str) -> CozeUnsubscribeResponse:
        """
        取消订阅Coze数据推送

        Args:
            request: 取消订阅请求
            socket_id: Socket.IO连接ID

        Returns:
            CozeUnsubscribeResponse: 取消订阅结果
        """
        try:
            removed_count = 0

            # 查找并移除订阅
            if request.client_id in self._subscriptions:
                remaining_subscriptions = []
                for subscription in self._subscriptions[request.client_id]:
                    if subscription.socket_id == socket_id:
                        subscription.is_active = False
                        removed_count += 1
                    else:
                        remaining_subscriptions.append(subscription)

                self._subscriptions[request.client_id] = remaining_subscriptions

                # 如果没有活跃订阅了，删除键
                if not remaining_subscriptions:
                    del self._subscriptions[request.client_id]

            # 更新Socket映射
            if socket_id in self._socket_client_mapping:
                self._socket_client_mapping[socket_id].discard(request.client_id)
                if not self._socket_client_mapping[socket_id]:
                    del self._socket_client_mapping[socket_id]

            print(f"Coze取消订阅: client_id={request.client_id}, socket_id={socket_id}, removed_count={removed_count}")

            return CozeUnsubscribeResponse(
                success=True,
                message=f"已取消 {removed_count} 个订阅",
                client_id=request.client_id
            )

        except Exception as e:
            print(f"Coze取消订阅失败: {e}")
            return CozeUnsubscribeResponse(
                success=False,
                message=f"取消订阅失败: {str(e)}",
                client_id=request.client_id
            )

    def get_pending_data(self, client_id: str) -> List[CozeDataCache]:
        """
        获取指定客户端的待发送数据

        Args:
            client_id: 客户端ID

        Returns:
            List[CozeDataCache]: 待发送数据列表
        """
        if client_id not in self._data_cache:
            return []

        # 获取未转发的数据
        pending_data = [
            cache_item for cache_item in self._data_cache[client_id]
            if not cache_item.is_forwarded
        ]

        return pending_data

    def mark_data_forwarded(self, cache_id: str, client_id: str):
        """
        标记数据已转发

        Args:
            cache_id: 缓存ID
            client_id: 客户端ID
        """
        if client_id in self._data_cache:
            for cache_item in self._data_cache[client_id]:
                if cache_item.id == cache_id:
                    cache_item.is_forwarded = True
                    cache_item.forwarded_at = datetime.now()
                    self._stats["total_data_forwarded"] += 1
                    break

    def get_active_subscriptions(self, client_id: str) -> List[CozeSubscription]:
        """
        获取客户端的活跃订阅

        Args:
            client_id: 客户端ID

        Returns:
            List[CozeSubscription]: 活跃订阅列表
        """
        if client_id not in self._subscriptions:
            return []

        return [
            subscription for subscription in self._subscriptions[client_id]
            if subscription.is_active
        ]

    def get_socket_client_ids(self, socket_id: str) -> Set[str]:
        """
        获取Socket连接对应的客户端ID列表

        Args:
            socket_id: Socket.IO连接ID

        Returns:
            Set[str]: 客户端ID集合
        """
        return self._socket_client_mapping.get(socket_id, set())

    def remove_socket_subscriptions(self, socket_id: str):
        """
        移除Socket连接的所有订阅（连接断开时调用）

        Args:
            socket_id: Socket.IO连接ID
        """
        client_ids = self._socket_client_mapping.get(socket_id, set())

        for client_id in client_ids:
            if client_id in self._subscriptions:
                remaining_subscriptions = []
                for subscription in self._subscriptions[client_id]:
                    if subscription.socket_id != socket_id:
                        remaining_subscriptions.append(subscription)

                self._subscriptions[client_id] = remaining_subscriptions
                if not remaining_subscriptions:
                    del self._subscriptions[client_id]

        # 删除Socket映射
        if socket_id in self._socket_client_mapping:
            del self._socket_client_mapping[socket_id]

        print(f"Coze清理Socket订阅: socket_id={socket_id}, affected_clients={len(client_ids)}")

    def get_stats(self) -> Dict[str, int]:
        """获取服务统计信息"""
        self._stats["active_connections"] = len(self._socket_client_mapping)
        return self._stats.copy()

    async def shutdown(self):
        """关闭服务"""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass


# 全局Coze服务实例
_coze_service: Optional[CozeService] = None


def get_coze_service() -> CozeService:
    """获取Coze服务单例"""
    global _coze_service
    if _coze_service is None:
        _coze_service = CozeService()
    return _coze_service


async def shutdown_coze_service():
    """关闭Coze服务"""
    global _coze_service
    if _coze_service is not None:
        await _coze_service.shutdown()
        _coze_service = None