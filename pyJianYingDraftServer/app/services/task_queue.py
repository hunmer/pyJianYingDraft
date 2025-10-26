"""
任务队列管理器

管理草稿生成任务的完整生命周期，包括下载、进度追踪、持久化等
"""

from __future__ import annotations

import uuid
import asyncio
import urllib.parse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

from app.models.download_models import (
    TaskStatus,
    DownloadTask,
    DownloadProgressInfo,
    TaskSubmitRequest
)
from app.services.aria2_client import Aria2Client, get_aria2_client, reset_aria2_client
from app.services.aria2_manager import Aria2ProcessManager, get_aria2_manager


class TaskQueue:
    """任务队列管理器

    负责任务的CRUD、状态管理、进度追踪和生命周期控制
    """

    def __init__(
        self,
        aria2_manager: Optional[Aria2ProcessManager] = None,
        aria2_client: Optional[Aria2Client] = None,
        max_active_tasks: int = 10,
        progress_update_interval: float = 1.0,
        verbose: bool = True
    ):
        """初始化任务队列管理器

        Args:
            aria2_manager: Aria2进程管理器（None则使用全局单例）
            aria2_client: Aria2客户端（None则使用全局单例）
            max_active_tasks: 最大并发任务数，默认10
            progress_update_interval: 进度更新间隔（秒），默认1秒
            verbose: 是否显示详细日志，默认True
        """
        self.verbose = verbose
        self.max_active_tasks = max_active_tasks
        self.progress_update_interval = progress_update_interval

        # Aria2管理器和客户端
        self.aria2_manager = aria2_manager or get_aria2_manager()
        self.aria2_client = aria2_client

        # 任务存储（内存）
        self.tasks: Dict[str, DownloadTask] = {}

        # 后台任务
        self.progress_monitor_task: Optional[asyncio.Task] = None
        self.is_monitoring = False

        # 订阅者管理（用于WebSocket推送）
        self.subscribers: Dict[str, List[str]] = defaultdict(list)  # task_id -> [sid, sid, ...]

        # Socket.IO实例（由main.py注入）
        self.sio = None

    def _log(self, message: str) -> None:
        """输出日志"""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[TaskQueue {timestamp}] {message}")

    def start(self) -> bool:
        """启动任务队列,初始化Aria2客户端

        Returns:
            bool: 是否成功启动
        """
        success = self._ensure_aria2_running()

        # 恢复GID到路径的映射（从内存中的任务）
        if success and self.aria2_client:
            self._restore_gid_path_mappings()

        return success

    def _ensure_aria2_running(self) -> bool:
        """确保Aria2进程运行中

        Returns:
            bool: Aria2是否成功运行
        """
        if not self.aria2_manager.is_running():
            self._log("Aria2进程未运行，正在启动...")
            if not self.aria2_manager.start():
                self._log("✗ Aria2进程启动失败")
                return False

        # 初始化客户端（如果还未初始化）
        if self.aria2_client is None:
            # 获取RPC secret
            # 注意: aria2.conf中如果没有设置rpc-secret,这里应该传入None
            # 如果aria2_manager返回空字符串,则转换为None
            rpc_secret = self.aria2_manager.get_rpc_secret()
            if rpc_secret == "":
                rpc_secret = None

            self.aria2_client = get_aria2_client(
                rpc_url=self.aria2_manager.get_rpc_url(),
                rpc_secret=rpc_secret
            )

        return True

    def _restore_gid_path_mappings(self) -> None:
        """从内存中的任务恢复GID到路径的映射到Aria2客户端

        在服务器重启后，从数据库加载的任务中恢复GID→文件路径的映射
        """
        if not self.aria2_client:
            return

        restored_count = 0
        for task in self.tasks.values():
            if task.gid_to_path_map:
                # 将任务中的映射恢复到Aria2客户端
                for gid, path in task.gid_to_path_map.items():
                    self.aria2_client.gid_to_path[gid] = path
                    restored_count += 1

        if restored_count > 0:
            self._log(f"✓ 已恢复 {restored_count} 个GID→路径映射")

    def reinitialize_aria2_client(self) -> bool:
        """重新初始化Aria2客户端

        用于Aria2配置更改或重启后重新创建客户端实例

        Returns:
            bool: 是否成功重新初始化
        """
        try:
            # 1. 重置全局单例
            reset_aria2_client()
            self.aria2_client = None
            self._log("已重置Aria2客户端单例")

            # 2. 确保Aria2进程运行
            if not self._ensure_aria2_running():
                self._log("✗ Aria2进程未能启动,无法初始化客户端")
                return False

            # 3. 恢复GID到路径的映射
            self._restore_gid_path_mappings()

            self._log("✓ Aria2客户端已重新初始化")
            return True

        except Exception as e:
            self._log(f"✗ 重新初始化Aria2客户端失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    async def create_task(self, request: TaskSubmitRequest) -> str:
        """创建新任务

        Args:
            request: 任务提交请求

        Returns:
            str: 任务ID
        """
        # 生成任务ID
        task_id = str(uuid.uuid4())

        # 创建任务对象
        task = DownloadTask(
            task_id=task_id,
            status=TaskStatus.PENDING,
            rule_group_id=request.ruleGroup.get("id"),
            rule_group=request.ruleGroup,  # 保存完整的规则组对象
            draft_config=request.draft_config,
            materials=request.materials,
            test_data=request.testData,
            segment_styles=request.segment_styles,
            use_raw_segments=request.use_raw_segments,
            raw_segments=request.raw_segments,
            raw_materials=request.raw_materials,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        # 保存任务
        self.tasks[task_id] = task
        self._log(f"✓ 创建任务: {task_id}")

        # 立即启动下载
        asyncio.create_task(self._process_task(task_id))

        return task_id

    async def _process_task(self, task_id: str) -> None:
        """处理任务的完整流程

        Args:
            task_id: 任务ID
        """
        task = self.tasks.get(task_id)
        if not task:
            self._log(f"✗ 任务不存在: {task_id}")
            return

        try:
            # 1. 提取需要下载的URL
            urls_with_paths = self._extract_download_urls(task)

            if not urls_with_paths:
                # 没有远程素材，直接生成草稿
                self._log(f"任务 {task_id} 无需下载，直接生成草稿")
                await self._generate_draft(task_id)
                return

            # 2. 确保Aria2运行
            if not self._ensure_aria2_running():
                self._update_task_status(task_id, TaskStatus.FAILED, error_message="Aria2启动失败")
                return

            # 3. 提交下载任务
            self._log(f"任务 {task_id} 开始下载 {len(urls_with_paths)} 个文件...")
            batch_id = await self.aria2_client.add_batch_downloads(
                urls_with_paths=urls_with_paths,
                batch_id=task_id  # 使用task_id作为batch_id
            )

            # 保存GID到路径的映射到任务中
            task.gid_to_path_map = self.aria2_client.get_all_file_paths()

            # 更新任务状态
            task.batch_id = batch_id
            task.status = TaskStatus.DOWNLOADING
            task.updated_at = datetime.now()
            self._log(f"✓ 任务 {task_id} 下载已提交 (batch_id: {batch_id})")

            # 4. 等待下载完成
            await self._wait_for_download_completion(task_id)

            # 4.5. 将HTTP URL替换为本地文件路径
            self._apply_downloaded_paths(task)

            # 5. 生成草稿
            await self._generate_draft(task_id)

        except Exception as e:
            self._log(f"✗ 任务 {task_id} 处理失败: {e}")
            self._update_task_status(task_id, TaskStatus.FAILED, error_message=str(e))

    def _extract_download_urls(self, task: DownloadTask) -> List[Tuple[str, str]]:
        """从任务中提取所有需要下载的URL

        Args:
            task: 下载任务

        Returns:
            List[Tuple[str, str]]: [(url, save_path), ...]
        """
        urls_with_paths = []
        materials = task.materials or []

        # 下载目录
        download_dir = self.aria2_manager.download_dir / task.task_id
        download_dir.mkdir(parents=True, exist_ok=True)

        # 建立URL→本地路径的映射，用于后续更新materials
        url_to_local_path: Dict[str, str] = {}

        # 处理素材列表（新格式：List[Dict]）
        if isinstance(materials, list):
            for material in materials:
                if not isinstance(material, dict):
                    continue

                path = material.get("path")
                if not path or not isinstance(path, str) or not path.startswith("http"):
                    continue

                # 解析文件名
                parsed_url = urllib.parse.urlparse(path)
                filename = Path(parsed_url.path).name

                # 如果无法从URL获取有效文件名，生成一个
                if not filename or '.' not in filename:
                    ext = self._guess_extension(path)
                    filename = f"{uuid.uuid4().hex}{ext}"

                # 保存路径
                save_path = str(download_dir / filename)
                urls_with_paths.append((path, save_path))
                url_to_local_path[path] = save_path  # 记录映射关系
        else:
            # 兼容旧格式（字典格式：{"videos": [...], "audios": [...]}）
            material_types = ["videos", "audios", "images"]

            for material_type in material_types:
                if material_type not in materials:
                    continue

                for material in materials[material_type]:
                    path = material.get("path")
                    if not path or not isinstance(path, str) or not path.startswith("http"):
                        continue

                    # 解析文件名
                    parsed_url = urllib.parse.urlparse(path)
                    filename = Path(parsed_url.path).name

                    # 如果无法从URL获取有效文件名，生成一个
                    if not filename or '.' not in filename:
                        ext = self._guess_extension(path)
                        filename = f"{uuid.uuid4().hex}{ext}"

                    # 保存路径
                    save_path = str(download_dir / filename)
                    urls_with_paths.append((path, save_path))
                    url_to_local_path[path] = save_path  # 记录映射关系

        # 处理testData.items中的HTTP URL
        test_data = task.test_data or {}
        items = test_data.get("items", [])

        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue

                # 提取 item.data.path
                data = item.get("data", {})
                if not isinstance(data, dict):
                    continue

                path = data.get("path")
                if not path or not isinstance(path, str) or not path.startswith("http"):
                    continue

                # 解析文件名
                parsed_url = urllib.parse.urlparse(path)
                filename = Path(parsed_url.path).name

                # 如果无法从URL获取有效文件名，生成一个
                if not filename or '.' not in filename:
                    # 优先使用 data.ext 字段，如果没有则从URL猜测
                    ext = data.get("ext")
                    if not ext:
                        ext = self._guess_extension(path)
                    # 确保扩展名以点开头
                    if ext and not ext.startswith('.'):
                        ext = f'.{ext}'
                    filename = f"{uuid.uuid4().hex}{ext}"

                # 保存路径
                save_path = str(download_dir / filename)
                urls_with_paths.append((path, save_path))
                url_to_local_path[path] = save_path  # 记录映射关系

                self._log(f"从testData.items提取URL: {path[:60]}...")

        # 保存映射关系到任务中，用于后续的_apply_downloaded_paths
        if not hasattr(task, '_url_to_local_path_map'):
            task._url_to_local_path_map = {}
        task._url_to_local_path_map.update(url_to_local_path)

        return urls_with_paths

    def _apply_downloaded_paths(self, task: DownloadTask) -> None:
        """将下载的本地文件路径应用到task中的所有素材引用

        替换HTTP URL为下载后的本地文件路径,以便RuleTestService可以访问文件
        包括:
        1. task.materials (普通模式)
        2. task.test_data.items[].data.path (testData中的路径)
        3. task.raw_materials (raw模式)
        4. task.raw_segments 中的material和extra_materials (raw模式)

        Args:
            task: 下载任务
        """
        url_to_local_map = getattr(task, '_url_to_local_path_map', {})
        if not url_to_local_map:
            return

        replaced_count = 0

        # 1. 处理 task.materials (普通模式)
        materials = task.materials or []

        if isinstance(materials, list):
            # 新格式处理
            for material in materials:
                if isinstance(material, dict):
                    path = material.get("path")
                    if path in url_to_local_map:
                        # 替换为本地路径
                        material["path"] = url_to_local_map[path]
                        self._log(f"[materials] 路径已更新: {path[:50]}... -> {material['path']}")
                        replaced_count += 1
        else:
            # 旧格式兼容
            material_types = ["videos", "audios", "images"]
            for material_type in material_types:
                if material_type in materials:
                    for material in materials[material_type]:
                        if isinstance(material, dict):
                            path = material.get("path")
                            if path in url_to_local_map:
                                material["path"] = url_to_local_map[path]
                                self._log(f"[materials.{material_type}] 路径已更新: {path[:50]}... -> {material['path']}")
                                replaced_count += 1

        # 2. 处理 task.test_data.items[].data.path (testData中的路径)
        test_data = task.test_data or {}
        items = test_data.get("items", [])

        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue

                data = item.get("data", {})
                if not isinstance(data, dict):
                    continue

                path = data.get("path")
                if path in url_to_local_map:
                    data["path"] = url_to_local_map[path]
                    self._log(f"[testData.items.data] 路径已更新: {path[:50]}... -> {data['path']}")
                    replaced_count += 1

        # 3. 处理 task.raw_materials (raw模式)
        raw_materials = getattr(task, 'raw_materials', None) or []
        for raw_material in raw_materials:
            if not isinstance(raw_material, dict):
                continue

            # raw_material.data 中可能包含 path
            data = raw_material.get('data', {})
            if isinstance(data, dict):
                path = data.get('path')
                if path in url_to_local_map:
                    data['path'] = url_to_local_map[path]
                    self._log(f"[raw_materials] 路径已更新: {path[:50]}... -> {data['path']}")
                    replaced_count += 1

                # 同时更新 media_path 和 material_url 字段(如果存在)
                if 'media_path' in data and data['media_path'] in url_to_local_map:
                    data['media_path'] = url_to_local_map[data['media_path']]
                if 'material_url' in data and data['material_url'] in url_to_local_map:
                    data['material_url'] = url_to_local_map[data['material_url']]

        # 4. 处理 task.raw_segments (raw模式)
        raw_segments = getattr(task, 'raw_segments', None) or []
        for raw_segment in raw_segments:
            if not isinstance(raw_segment, dict):
                continue

            # 4.1 处理 segment.material.path
            material = raw_segment.get('material')
            if isinstance(material, dict):
                path = material.get('path')
                if path in url_to_local_map:
                    material['path'] = url_to_local_map[path]
                    self._log(f"[raw_segments.material] 路径已更新: {path[:50]}... -> {material['path']}")
                    replaced_count += 1

                # 同时更新其他路径字段
                if 'media_path' in material and material['media_path'] in url_to_local_map:
                    material['media_path'] = url_to_local_map[material['media_path']]
                if 'material_url' in material and material['material_url'] in url_to_local_map:
                    material['material_url'] = url_to_local_map[material['material_url']]

            # 4.2 处理 segment.extra_materials[category][].path
            extra_materials = raw_segment.get('extra_materials')
            if isinstance(extra_materials, dict):
                for category, items in extra_materials.items():
                    if not isinstance(items, list):
                        continue
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        path = item.get('path')
                        if path in url_to_local_map:
                            item['path'] = url_to_local_map[path]
                            self._log(f"[raw_segments.extra_materials.{category}] 路径已更新: {path[:50]}... -> {item['path']}")
                            replaced_count += 1

                        # 同时更新其他路径字段
                        if 'media_path' in item and item['media_path'] in url_to_local_map:
                            item['media_path'] = url_to_local_map[item['media_path']]
                        if 'material_url' in item and item['material_url'] in url_to_local_map:
                            item['material_url'] = url_to_local_map[item['material_url']]

        if replaced_count > 0:
            self._log(f"✓ 共替换了 {replaced_count} 个HTTP URL为本地路径")


    def _guess_extension(self, url: str) -> str:
        """从URL猜测文件扩展名"""
        url_lower = url.lower()

        # 视频扩展名
        video_exts = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm']
        for ext in video_exts:
            if ext in url_lower:
                return ext

        # 音频扩展名
        audio_exts = ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg']
        for ext in audio_exts:
            if ext in url_lower:
                return ext

        # 图片扩展名
        image_exts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        for ext in image_exts:
            if ext in url_lower:
                return ext

        return '.jpg'  # 默认扩展名

    async def _wait_for_download_completion(self, task_id: str) -> None:
        """等待下载完成

        Args:
            task_id: 任务ID
        """
        task = self.tasks.get(task_id)
        if not task or not task.batch_id:
            return

        self._log(f"等待任务 {task_id} 下载完成...")

        while True:
            # 获取批次进度
            batch_progress = self.aria2_client.get_batch_progress(task.batch_id)

            if batch_progress is None:
                self._log(f"✗ 无法获取任务 {task_id} 的下载进度")
                break

            # 更新任务进度
            task.progress = DownloadProgressInfo(
                total_files=len(batch_progress.downloads),
                completed_files=batch_progress.completed_count,
                failed_files=batch_progress.failed_count,
                active_files=batch_progress.active_count,
                total_size=batch_progress.total_size,
                downloaded_size=batch_progress.downloaded_size,
                progress_percent=batch_progress.progress_percent,
                download_speed=batch_progress.total_speed,
                eta_seconds=batch_progress.eta_seconds
            )
            task.updated_at = datetime.now()

            # 调试日志
            self._log(f"下载进度: {batch_progress.completed_count}/{len(batch_progress.downloads)} 完成, "
                     f"{batch_progress.failed_count} 失败, {batch_progress.active_count} 进行中, "
                     f"is_completed={batch_progress.is_completed}")

            # 检查是否完成
            if batch_progress.is_completed:
                if batch_progress.failed_count > 0:
                    self._log(f"⚠ 任务 {task_id} 下载完成，但有 {batch_progress.failed_count} 个文件失败")
                else:
                    self._log(f"✓ 任务 {task_id} 下载完成")
                break

            # 等待后再检查
            await asyncio.sleep(self.progress_update_interval)

    async def _generate_draft(self, task_id: str) -> None:
        """生成草稿文件

        Args:
            task_id: 任务ID
        """
        task = self.tasks.get(task_id)
        if not task:
            return

        try:
            self._log(f"任务 {task_id} 开始生成草稿...")
            task.status = TaskStatus.PROCESSING
            task.updated_at = datetime.now()

            # 调用RuleTestService生成草稿
            from app.services.rule_test_service import RuleTestService
            from app.models.rule_models import RuleGroupTestRequest

            # 清理raw_segments数据,确保extra_materials中的字段不为None
            cleaned_raw_segments = None
            if task.raw_segments:
                cleaned_raw_segments = []
                for seg in task.raw_segments:
                    cleaned_seg = seg.copy() if isinstance(seg, dict) else seg
                    # 处理extra_materials字段
                    if isinstance(cleaned_seg, dict) and 'extra_materials' in cleaned_seg:
                        extra_materials = cleaned_seg['extra_materials']
                        if extra_materials is not None and isinstance(extra_materials, dict):
                            # 将None值的嵌套字段转换为空列表
                            for key in extra_materials:
                                if extra_materials[key] is None:
                                    extra_materials[key] = []
                    cleaned_raw_segments.append(cleaned_seg)

            # 构建请求对象
            request = RuleGroupTestRequest(
                ruleGroup=task.rule_group or {},  # 使用完整的规则组对象
                materials=task.materials or [],  # 直接使用materials（已是列表格式）
                testData=task.test_data or {},
                draft_config=task.draft_config or {},
                segment_styles=task.segment_styles,
                use_raw_segments=task.use_raw_segments,
                raw_segments=cleaned_raw_segments,
                raw_materials=task.raw_materials
            )

            # 同步调用草稿生成（在线程池中执行以避免阻塞）
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, RuleTestService.run_test, request)

            # 更新任务状态为完成
            task.status = TaskStatus.COMPLETED
            task.draft_path = response.draft_path
            task.completed_at = datetime.now()
            task.updated_at = datetime.now()

            self._log(f"✓ 任务 {task_id} 已完成，草稿路径: {response.draft_path}")

        except Exception as e:
            self._log(f"✗ 任务 {task_id} 草稿生成失败: {e}")
            import traceback
            traceback.print_exc()
            task.status = TaskStatus.FAILED
            task.error_message = f"草稿生成失败: {str(e)}"
            task.updated_at = datetime.now()

    def _update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        error_message: Optional[str] = None
    ) -> None:
        """更新任务状态

        Args:
            task_id: 任务ID
            status: 新状态
            error_message: 错误信息（可选）
        """
        task = self.tasks.get(task_id)
        if not task:
            return

        task.status = status
        task.updated_at = datetime.now()

        if error_message:
            task.error_message = error_message

        if status == TaskStatus.COMPLETED:
            task.completed_at = datetime.now()

        # 推送状态变更通知
        asyncio.create_task(self._push_status_change(task))

    async def _push_status_change(self, task: DownloadTask) -> None:
        """推送任务状态变更通知

        Args:
            task: 下载任务
        """
        if not self.sio:
            return

        subscribers = self.subscribers.get(task.task_id, [])
        if not subscribers:
            return

        # 构建状态变更消息
        status_data = {
            'task_id': task.task_id,
            'status': task.status.value,
            'draft_path': task.draft_path,
            'error_message': task.error_message,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None
        }

        # 根据状态发送不同的事件
        event_name = 'task_status_changed'
        if task.status == TaskStatus.COMPLETED:
            event_name = 'task_completed'
        elif task.status == TaskStatus.FAILED:
            event_name = 'task_failed'
        elif task.status == TaskStatus.CANCELLED:
            event_name = 'task_cancelled'

        # 推送给所有订阅者
        for sid in subscribers:
            try:
                await self.sio.emit(event_name, status_data, room=sid)
            except Exception as e:
                self._log(f"推送状态变更失败 (sid: {sid}): {e}")

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        """获取任务信息

        Args:
            task_id: 任务ID

        Returns:
            DownloadTask: 任务信息，不存在返回None
        """
        return self.tasks.get(task_id)

    def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[DownloadTask], int]:
        """列出任务

        Args:
            status: 状态筛选（None表示所有状态）
            limit: 每页数量
            offset: 偏移量

        Returns:
            Tuple[List[DownloadTask], int]: (任务列表, 总数)
        """
        # 筛选
        if status:
            filtered_tasks = [t for t in self.tasks.values() if t.status == status]
        else:
            filtered_tasks = list(self.tasks.values())

        # 排序（按创建时间倒序）
        sorted_tasks = sorted(filtered_tasks, key=lambda t: t.created_at, reverse=True)

        # 分页
        total = len(sorted_tasks)
        paginated_tasks = sorted_tasks[offset:offset + limit]

        return paginated_tasks, total

    async def cancel_task(self, task_id: str) -> bool:
        """取消任务

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功取消
        """
        task = self.tasks.get(task_id)
        if not task:
            self._log(f"✗ 任务不存在: {task_id}")
            return False

        # 只能取消PENDING或DOWNLOADING状态的任务
        if task.status not in (TaskStatus.PENDING, TaskStatus.DOWNLOADING):
            self._log(f"✗ 任务 {task_id} 状态为 {task.status}，无法取消")
            return False

        try:
            # 取消Aria2下载
            if task.batch_id and self.aria2_client:
                await self.aria2_client.cancel_batch(task.batch_id)

            # 更新任务状态
            task.status = TaskStatus.CANCELLED
            task.updated_at = datetime.now()
            task.completed_at = datetime.now()

            self._log(f"✓ 任务 {task_id} 已取消")
            return True

        except Exception as e:
            self._log(f"✗ 取消任务 {task_id} 失败: {e}")
            return False

    async def start_progress_monitor(self) -> None:
        """启动进度监控后台任务"""
        if self.is_monitoring:
            self._log("进度监控任务已在运行")
            return

        self.is_monitoring = True
        self.progress_monitor_task = asyncio.create_task(self._progress_monitor_loop())
        self._log("✓ 进度监控任务已启动")

    async def stop_progress_monitor(self) -> None:
        """停止进度监控后台任务"""
        if not self.is_monitoring:
            return

        self.is_monitoring = False

        if self.progress_monitor_task:
            self.progress_monitor_task.cancel()
            try:
                await self.progress_monitor_task
            except asyncio.CancelledError:
                pass
            self.progress_monitor_task = None

        self._log("✓ 进度监控任务已停止")

    async def _progress_monitor_loop(self) -> None:
        """进度监控循环（后台任务）"""
        self._log("进度监控循环已启动")

        while self.is_monitoring:
            try:
                # 获取所有DOWNLOADING状态的任务
                downloading_tasks = [
                    t for t in self.tasks.values()
                    if t.status == TaskStatus.DOWNLOADING and t.batch_id
                ]

                # 更新进度
                for task in downloading_tasks:
                    if not self.aria2_client:
                        continue

                    batch_progress = self.aria2_client.get_batch_progress(task.batch_id)
                    if batch_progress:
                        task.progress = DownloadProgressInfo(
                            total_files=len(batch_progress.downloads),
                            completed_files=batch_progress.completed_count,
                            failed_files=batch_progress.failed_count,
                            active_files=batch_progress.active_count,
                            total_size=batch_progress.total_size,
                            downloaded_size=batch_progress.downloaded_size,
                            progress_percent=batch_progress.progress_percent,
                            download_speed=batch_progress.total_speed,
                            eta_seconds=batch_progress.eta_seconds
                        )
                        task.updated_at = datetime.now()

                        # WebSocket推送进度更新
                        await self._push_progress_update(task)

                # 等待下一次检查
                await asyncio.sleep(self.progress_update_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._log(f"进度监控出错: {e}")
                await asyncio.sleep(self.progress_update_interval)

        self._log("进度监控循环已停止")

    async def _push_progress_update(self, task: DownloadTask) -> None:
        """通过WebSocket推送进度更新

        Args:
            task: 下载任务
        """
        if not self.sio:
            return

        # 获取订阅该任务的所有客户端
        subscribers = self.subscribers.get(task.task_id, [])
        if not subscribers:
            return

        # 构建进度消息
        progress_data = {
            'task_id': task.task_id,
            'status': task.status.value,
            'progress': task.progress.model_dump() if task.progress else None,
            'updated_at': task.updated_at.isoformat() if task.updated_at else None
        }

        # 推送给所有订阅者
        for sid in subscribers:
            try:
                await self.sio.emit('task_progress', progress_data, room=sid)
            except Exception as e:
                self._log(f"推送进度失败 (sid: {sid}): {e}")

    def subscribe(self, task_id: str, subscriber_id: str) -> bool:
        """订阅任务进度更新

        Args:
            task_id: 任务ID
            subscriber_id: 订阅者ID（通常是WebSocket session ID）

        Returns:
            bool: 是否成功订阅
        """
        if task_id not in self.tasks:
            return False

        if subscriber_id not in self.subscribers[task_id]:
            self.subscribers[task_id].append(subscriber_id)
            self._log(f"✓ {subscriber_id} 订阅了任务 {task_id}")

        return True

    def unsubscribe(self, task_id: str, subscriber_id: str) -> bool:
        """取消订阅任务进度更新

        Args:
            task_id: 任务ID
            subscriber_id: 订阅者ID

        Returns:
            bool: 是否成功取消订阅
        """
        if task_id in self.subscribers and subscriber_id in self.subscribers[task_id]:
            self.subscribers[task_id].remove(subscriber_id)
            self._log(f"✓ {subscriber_id} 取消订阅任务 {task_id}")
            return True

        return False

    def get_subscribers(self, task_id: str) -> List[str]:
        """获取任务的订阅者列表

        Args:
            task_id: 任务ID

        Returns:
            List[str]: 订阅者ID列表
        """
        return self.subscribers.get(task_id, [])


# 全局单例
_global_queue: Optional[TaskQueue] = None


def get_task_queue(**kwargs) -> TaskQueue:
    """获取全局任务队列单例

    Args:
        **kwargs: 初始化参数（仅首次调用时生效）

    Returns:
        TaskQueue: 全局任务队列实例
    """
    global _global_queue

    if _global_queue is None:
        _global_queue = TaskQueue(**kwargs)

    return _global_queue
