"""
远程素材异步下载模块

支持高并发下载、代理设置、自动重试等功能
"""

import os
import asyncio
import uuid
import urllib.parse
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path

try:
    import aiohttp
    from aiohttp_retry import RetryClient, ExponentialRetry
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    print("警告: aiohttp 或 aiohttp-retry 未安装,将使用同步下载模式")
    print("安装命令: pip install aiohttp aiohttp-retry")


class RemoteMaterialDownloader:
    """远程素材下载器

    使用异步高并发方式下载远程素材,支持代理、重试、进度追踪等功能
    """

    # 剪映草稿路径占位符
    DRAFT_PATH_PLACEHOLDER = "##_draftpath_placeholder_0E685133-18CE-45ED-8CB8-2904A212EC80_##"

    def __init__(
        self,
        max_concurrent: int = 50,
        retry_attempts: int = 3,
        timeout: int = 30,
        proxy: Optional[str] = None,
        verbose: bool = True
    ):
        """初始化下载器

        Args:
            max_concurrent (int): 最大并发下载数,默认50
            retry_attempts (int): 失败重试次数,默认3次
            timeout (int): 单个下载超时时间(秒),默认30秒
            proxy (str, optional): HTTP代理地址,格式如 "http://127.0.0.1:7890"
            verbose (bool): 是否显示详细日志,默认True
        """
        self.max_concurrent = max_concurrent
        self.retry_attempts = retry_attempts
        self.timeout = timeout
        self.proxy = proxy
        self.verbose = verbose

        self.downloaded_count = 0
        self.failed_count = 0
        self.failed_urls: List[str] = []

    def _log(self, message: str) -> None:
        """输出日志"""
        if self.verbose:
            print(message)

    async def _download_file(
        self,
        session: aiohttp.ClientSession,
        url: str,
        save_path: str
    ) -> bool:
        """下载单个文件

        Args:
            session: aiohttp session
            url: 文件URL
            save_path: 保存路径

        Returns:
            bool: 下载是否成功
        """
        try:
            # 如果文件已存在,跳过下载
            if os.path.exists(save_path):
                self._log(f"[跳过] 文件已存在: {os.path.basename(save_path)}")
                return True

            self._log(f"[下载] {url} -> {os.path.basename(save_path)}")

            # 发起请求
            kwargs = {"timeout": aiohttp.ClientTimeout(total=self.timeout)}
            if self.proxy:
                kwargs["proxy"] = self.proxy

            async with session.get(url, **kwargs) as response:
                response.raise_for_status()

                # 写入文件
                with open(save_path, "wb") as f:
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)

            self._log(f"[成功] {os.path.basename(save_path)}")
            return True

        except Exception as e:
            self._log(f"[失败] {url}: {str(e)}")
            # 删除不完整的文件
            if os.path.exists(save_path):
                try:
                    os.remove(save_path)
                except:
                    pass
            return False

    async def _download_batch_async(
        self,
        download_tasks: List[Tuple[str, str]]
    ) -> Tuple[int, int]:
        """异步批量下载

        Args:
            download_tasks: 下载任务列表 [(url, save_path), ...]

        Returns:
            Tuple[int, int]: (成功数, 失败数)
        """
        if not AIOHTTP_AVAILABLE:
            raise RuntimeError("aiohttp 未安装,无法使用异步下载")

        # 配置重试策略
        retry_options = ExponentialRetry(
            attempts=self.retry_attempts,
            start_timeout=1,
            max_timeout=10,
            factor=2.0
        )

        # 配置连接器
        connector = aiohttp.TCPConnector(
            limit=self.max_concurrent,
            limit_per_host=10,
            force_close=False
        )

        success_count = 0
        failed_count = 0

        async with RetryClient(
            connector=connector,
            retry_options=retry_options,
            raise_for_status=False
        ) as session:
            # 创建所有下载任务
            tasks = []
            for url, save_path in download_tasks:
                task = self._download_file(session, url, save_path)
                tasks.append((url, task))

            # 并发执行所有任务
            results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

            # 统计结果
            for (url, _), result in zip(tasks, results):
                if isinstance(result, Exception):
                    self._log(f"[异常] {url}: {str(result)}")
                    failed_count += 1
                    self.failed_urls.append(url)
                elif result:
                    success_count += 1
                else:
                    failed_count += 1
                    self.failed_urls.append(url)

        return success_count, failed_count

    def _download_batch_sync(
        self,
        download_tasks: List[Tuple[str, str]]
    ) -> Tuple[int, int]:
        """同步批量下载(降级方案)

        Args:
            download_tasks: 下载任务列表 [(url, save_path), ...]

        Returns:
            Tuple[int, int]: (成功数, 失败数)
        """
        import urllib.request

        success_count = 0
        failed_count = 0

        for url, save_path in download_tasks:
            try:
                if os.path.exists(save_path):
                    self._log(f"[跳过] 文件已存在: {os.path.basename(save_path)}")
                    success_count += 1
                    continue

                self._log(f"[下载] {url} -> {os.path.basename(save_path)}")

                # 设置代理(如果有)
                if self.proxy:
                    proxy_handler = urllib.request.ProxyHandler({'http': self.proxy, 'https': self.proxy})
                    opener = urllib.request.build_opener(proxy_handler)
                    urllib.request.install_opener(opener)

                urllib.request.urlretrieve(url, save_path)
                self._log(f"[成功] {os.path.basename(save_path)}")
                success_count += 1

            except Exception as e:
                self._log(f"[失败] {url}: {str(e)}")
                failed_count += 1
                self.failed_urls.append(url)

                # 删除不完整的文件
                if os.path.exists(save_path):
                    try:
                        os.remove(save_path)
                    except:
                        pass

        return success_count, failed_count

    def download_materials(
        self,
        materials: Dict[str, List[Dict[str, Any]]],
        draft_id: str,
        draft_dir: str
    ) -> Tuple[int, int]:
        """下载所有远程素材

        这是主要的对外接口,一行调用即可完成所有下载

        Args:
            materials: 素材字典,格式为 {material_type: [material_dict, ...]}
            draft_id: 草稿ID
            draft_dir: 草稿目录

        Returns:
            Tuple[int, int]: (成功数, 失败数)

        Example:
            >>> downloader = RemoteMaterialDownloader(proxy="http://127.0.0.1:7890")
            >>> success, failed = downloader.download_materials(
            ...     materials=script.content["materials"],
            ...     draft_id=script.content["id"],
            ...     draft_dir="/path/to/draft"
            ... )
        """
        # 重置计数器
        self.downloaded_count = 0
        self.failed_count = 0
        self.failed_urls = []

        # 创建下载目录
        download_dir = os.path.join(draft_dir, draft_id)
        os.makedirs(download_dir, exist_ok=True)

        # 收集所有需要下载的任务
        download_tasks = []
        material_updates = []  # 记录需要更新的素材 (material_dict, field_name, new_path)

        # 需要处理的素材类型及其路径字段
        material_types_to_process = {
            "videos": "path",
            "audios": "path",
            "images": "path",
        }

        for material_type, path_field in material_types_to_process.items():
            if material_type not in materials:
                continue

            for material_dict in materials[material_type]:
                if path_field not in material_dict:
                    continue

                path = material_dict[path_field]
                if not isinstance(path, str) or not path.startswith("http"):
                    continue

                # 解析文件名
                parsed_url = urllib.parse.urlparse(path)
                filename = os.path.basename(parsed_url.path)

                # 如果无法从URL获取有效文件名,生成一个
                if not filename or '.' not in filename:
                    ext = self._guess_extension(path)
                    filename = f"{uuid.uuid4().hex}{ext}"

                # 保存路径
                save_path = os.path.join(download_dir, filename)

                # 添加到下载任务
                download_tasks.append((path, save_path))

                # 记录需要更新的素材信息
                new_path = f"{self.DRAFT_PATH_PLACEHOLDER}\\{draft_id}\\{filename}"
                material_updates.append((material_dict, path_field, new_path))

        if not download_tasks:
            self._log("没有需要下载的远程素材")
            return 0, 0

        self._log(f"\n开始下载 {len(download_tasks)} 个远程素材...")
        self._log(f"下载目录: {download_dir}")
        if self.proxy:
            self._log(f"使用代理: {self.proxy}")

        # 执行下载
        if AIOHTTP_AVAILABLE:
            # 使用异步下载
            try:
                success_count, failed_count = asyncio.run(
                    self._download_batch_async(download_tasks)
                )
            except Exception as e:
                self._log(f"异步下载失败,降级为同步模式: {str(e)}")
                success_count, failed_count = self._download_batch_sync(download_tasks)
        else:
            # 使用同步下载
            success_count, failed_count = self._download_batch_sync(download_tasks)

        # 更新成功下载的素材路径
        for i, (material_dict, path_field, new_path) in enumerate(material_updates):
            # 只更新成功下载的素材
            if i < len(download_tasks):
                url, save_path = download_tasks[i]
                if os.path.exists(save_path):
                    material_dict[path_field] = new_path

        self.downloaded_count = success_count
        self.failed_count = failed_count

        # 输出统计信息
        self._log(f"\n下载完成: 成功 {success_count}, 失败 {failed_count}")
        if self.failed_urls:
            self._log("\n失败的URL:")
            for url in self.failed_urls:
                self._log(f"  - {url}")

        return success_count, failed_count

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

        # 默认视频扩展名
        return '.mp4'


def download_remote_materials(
    materials: Dict[str, List[Dict[str, Any]]],
    draft_id: str,
    draft_dir: str,
    max_concurrent: int = 50,
    proxy: Optional[str] = None,
    verbose: bool = True
) -> Tuple[int, int]:
    """便捷函数: 一行代码下载所有远程素材

    Args:
        materials: 素材字典
        draft_id: 草稿ID
        draft_dir: 草稿目录
        max_concurrent: 最大并发数
        proxy: 代理地址
        verbose: 是否显示日志

    Returns:
        Tuple[int, int]: (成功数, 失败数)

    Example:
        >>> from pyJianYingDraft.remote_downloader import download_remote_materials
        >>> success, failed = download_remote_materials(
        ...     materials=script.content["materials"],
        ...     draft_id=script.content["id"],
        ...     draft_dir="/path/to/draft",
        ...     proxy="http://127.0.0.1:7890"  # 可选
        ... )
    """
    downloader = RemoteMaterialDownloader(
        max_concurrent=max_concurrent,
        proxy=proxy,
        verbose=verbose
    )
    return downloader.download_materials(materials, draft_id, draft_dir)
