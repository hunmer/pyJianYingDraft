"""
草稿文件解析服务
"""

import os
from copy import deepcopy
from typing import Dict, List, Any, Optional
import pyJianYingDraft as draft

from app.models.draft_models import (
    DraftInfo, TrackInfo, SegmentInfo, MaterialInfo,
    SubdraftInfo, TimerangeInfo
)


class DraftService:
    """草稿文件解析服务类"""

    @staticmethod
    def _microseconds_to_seconds(microseconds: int) -> float:
        """将微秒转换为秒"""
        return microseconds / 1000000.0

    @staticmethod
    def _format_timerange(timerange_data: Dict[str, Any]) -> TimerangeInfo:
        """格式化时间范围信息"""
        start = timerange_data.get('start', 0)
        duration = timerange_data.get('duration', 0)

        return TimerangeInfo(
            start=start,
            duration=duration,
            start_seconds=DraftService._microseconds_to_seconds(start),
            duration_seconds=DraftService._microseconds_to_seconds(duration)
        )

    @staticmethod
    def _extract_segment_style(segment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Collect style-related attributes from a raw segment."""
        exclude_keys = {
            'id',
            'material_id',
            'target_timerange',
            'source_timerange',
            'speed',
            'volume',
            'name',
        }
        style = {
            key: value
            for key, value in segment.items()
            if key not in exclude_keys and value not in (None, {}, [], '')
        }
        return style or None

    @staticmethod
    def _build_segment_info(segment: Dict[str, Any]) -> SegmentInfo:
        """Convert raw segment dict to SegmentInfo with style details."""
        target_time = segment.get('target_timerange', {})
        source_time = segment.get('source_timerange', {})

        return SegmentInfo(
            id=segment.get('id', ''),
            material_id=segment.get('material_id', ''),
            target_timerange=DraftService._format_timerange(target_time),
            source_timerange=DraftService._format_timerange(source_time) if source_time else None,
            speed=segment.get('speed'),
            volume=segment.get('volume'),
            style=DraftService._extract_segment_style(segment)
        )

    @staticmethod
    def load_draft(file_path: str) -> draft.ScriptFile:
        """加载草稿文件

        Args:
            file_path: 草稿文件路径

        Returns:
            ScriptFile对象

        Raises:
            FileNotFoundError: 文件不存在
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"草稿文件不存在: {file_path}")

        return draft.ScriptFile.load_template(file_path)

    @staticmethod
    def get_raw_content(file_path: str) -> Dict[str, Any]:
        """获取草稿完整原始JSON内容"""
        script = DraftService.load_draft(file_path)
        return deepcopy(script.content)

    @staticmethod
    def get_draft_info(file_path: str) -> DraftInfo:
        """获取草稿文件基础信息

        Args:
            file_path: 草稿文件路径

        Returns:
            DraftInfo对象
        """
        script = DraftService.load_draft(file_path)

        tracks_info = []
        for track_data in script.content.get('tracks', []):
            segments = track_data.get('segments', [])
            segments_info = [
                DraftService._build_segment_info(seg)
                for seg in segments
            ]


            track_info = TrackInfo(
                id=track_data.get('id', ''),
                name=track_data.get('name', ''),
                type=track_data.get('type', ''),
                render_index=track_data.get('render_index', 0),
                segment_count=len(segments),
                segments=segments_info
            )
            tracks_info.append(track_info)

        return DraftInfo(
            width=script.width,
            height=script.height,
            fps=script.fps,
            duration=script.duration,
            duration_seconds=DraftService._microseconds_to_seconds(script.duration),
            track_count=len(script.content.get('tracks', [])),
            tracks=tracks_info
        )

    @staticmethod
    def get_subdrafts(file_path: str) -> List[SubdraftInfo]:
        """获取复合片段信息列表

        Args:
            file_path: 草稿文件路径

        Returns:
            SubdraftInfo对象列表
        """
        script = DraftService.load_draft(file_path)
        subdrafts = script.read_subdrafts()

        result = []
        for subdraft in subdrafts:
            nested_draft = subdraft.get('draft', {})
            materials = nested_draft.get('materials', {})

            # 统计素材
            material_stats = {}
            for material_type, material_list in materials.items():
                if isinstance(material_list, list) and len(material_list) > 0:
                    material_stats[material_type] = len(material_list)

            # 处理轨道信息
            tracks_info = []
            for track_data in nested_draft.get('tracks', []):
                segments = track_data.get('segments', [])
                segments_info = []

                for seg in segments:
                    target_time = seg.get('target_timerange', {})
                    source_time = seg.get('source_timerange', {})

                    seg_info = SegmentInfo(
                        id=seg.get('id', ''),
                        material_id=seg.get('material_id', ''),
                        target_timerange=DraftService._format_timerange(target_time),
                        source_timerange=DraftService._format_timerange(source_time) if source_time else None,
                        speed=seg.get('speed'),
                        volume=seg.get('volume')
                    )
                    segments_info.append(seg_info)

                track_info = TrackInfo(
                    id=track_data.get('id', ''),
                    name=track_data.get('name', ''),
                    type=track_data.get('type', ''),
                    render_index=track_data.get('render_index', 0),
                    segment_count=len(segments),
                    segments=segments_info
                )
                tracks_info.append(track_info)

            # 创建嵌套草稿信息
            canvas = nested_draft.get('canvas_config', {})
            draft_duration = nested_draft.get('duration', 0)

            draft_info = DraftInfo(
                width=canvas.get('width', 0),
                height=canvas.get('height', 0),
                fps=nested_draft.get('fps', 0),
                duration=draft_duration,
                duration_seconds=DraftService._microseconds_to_seconds(draft_duration),
                track_count=len(nested_draft.get('tracks', [])),
                tracks=tracks_info
            )

            subdraft_info = SubdraftInfo(
                id=subdraft.get('id', ''),
                name=subdraft.get('name', ''),
                type=subdraft.get('type', ''),
                combination_id=subdraft.get('combination_id', ''),
                draft_info=draft_info,
                material_stats=material_stats
            )
            result.append(subdraft_info)

        return result

    @staticmethod
    def get_materials(file_path: str, material_type: Optional[str] = None) -> Dict[str, Any]:
        """获取素材信息

        Args:
            file_path: 草稿文件路径
            material_type: 素材类型，如'videos', 'audios', 'texts'等，None表示所有类型

        Returns:
            素材信息字典
        """
        script = DraftService.load_draft(file_path)
        materials = script.content.get('materials', {})

        if material_type:
            if material_type not in materials:
                return {material_type: []}
            return {material_type: materials[material_type]}

        # 返回所有素材，添加统计信息
        result = {}
        for mat_type, mat_list in materials.items():
            if isinstance(mat_list, list):
                result[mat_type] = {
                    'count': len(mat_list),
                    'items': mat_list
                }

        return result

    @staticmethod
    def get_tracks_by_type(file_path: str, track_type: str) -> List[TrackInfo]:
        """根据类型获取轨道列表

        Args:
            file_path: 草稿文件路径
            track_type: 轨道类型，如'video', 'audio', 'text'等

        Returns:
            TrackInfo对象列表
        """
        script = DraftService.load_draft(file_path)
        tracks = script.content.get('tracks', [])

        result = []
        for track_data in tracks:
            if track_data.get('type') != track_type:
                continue

            segments = track_data.get('segments', [])
            segments_info = [
                DraftService._build_segment_info(seg)
                for seg in segments
            ]


            track_info = TrackInfo(
                id=track_data.get('id', ''),
                name=track_data.get('name', ''),
                type=track_data.get('type', ''),
                render_index=track_data.get('render_index', 0),
                segment_count=len(segments),
                segments=segments_info
            )
            result.append(track_info)

        return result

    @staticmethod
    def list_drafts(base_path: str) -> List[Dict[str, Any]]:
        """列出指定目录下的所有草稿

        Args:
            base_path: 剪映草稿根目录路径 (例如: "D:\\JianyingPro Drafts")

        Returns:
            草稿列表,每个包含: name, path, modified_time
        """
        if not os.path.exists(base_path):
            raise FileNotFoundError(f"目录不存在: {base_path}")

        if not os.path.isdir(base_path):
            raise ValueError(f"路径不是目录: {base_path}")

        drafts = []
        try:
            # 遍历base_path下的所有子目录
            for item in os.listdir(base_path):
                item_path = os.path.join(base_path, item)

                # 只处理目录
                if not os.path.isdir(item_path):
                    continue

                # 检查是否包含 draft_content.json 或 draft_content
                draft_file = None
                for filename in ['draft_content.json', 'draft_content']:
                    test_path = os.path.join(item_path, filename)
                    if os.path.exists(test_path) and os.path.isfile(test_path):
                        draft_file = test_path
                        break

                if draft_file:
                    # 获取文件修改时间
                    mtime = os.path.getmtime(draft_file)

                    drafts.append({
                        'name': item,
                        'path': draft_file,
                        'modified_time': mtime,
                        'folder_path': item_path
                    })
        except PermissionError as e:
            raise PermissionError(f"没有权限访问目录: {base_path}")
        except Exception as e:
            raise Exception(f"列出草稿失败: {str(e)}")

        # 按修改时间降序排序 (最新的在前)
        drafts.sort(key=lambda x: x['modified_time'], reverse=True)

        return drafts
