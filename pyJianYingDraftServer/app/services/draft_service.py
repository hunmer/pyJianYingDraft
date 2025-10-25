"""
草稿文件解析服务
"""

import json
import os
import re
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
    def _resolve_draft_folder(draft_path: str) -> str:
        """
        根据传入的草稿路径推导草稿所在目录。
        入参既可以是 draft_content.json 的完整路径，也可以直接是草稿目录。
        """
        if not draft_path:
            raise ValueError("草稿路径不能为空")

        normalized_path = os.path.abspath(draft_path)
        if os.path.isdir(normalized_path):
            return normalized_path
        if os.path.isfile(normalized_path):
            return os.path.dirname(normalized_path)
        raise FileNotFoundError(f"草稿路径不存在: {draft_path}")

    @staticmethod
    def _rules_dir(draft_folder: str) -> str:
        return os.path.join(draft_folder, "rules")

    @staticmethod
    def _rule_groups_file(draft_folder: str) -> str:
        return os.path.join(draft_folder, "rule_groups.json")

    @staticmethod
    def _sanitize_rule_filename(identifier: str) -> str:
        sanitized = re.sub(r"[^a-zA-Z0-9-_]", "_", identifier.strip())
        return sanitized or "rule"

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
    def _draft_has_rules(draft_folder: str) -> bool:
        rules_dir = DraftService._rules_dir(draft_folder)
        rule_groups_file = DraftService._rule_groups_file(draft_folder)

        if os.path.isfile(rule_groups_file):
            return True

        if os.path.isdir(rules_dir):
            for file_name in os.listdir(rules_dir):
                if file_name.lower().endswith(".json"):
                    return True
        return False

    @staticmethod
    def get_draft_rule_groups(draft_path: str) -> List[Dict[str, Any]]:
        """读取草稿绑定的规则组"""
        draft_folder = DraftService._resolve_draft_folder(draft_path)
        rule_groups_file = DraftService._rule_groups_file(draft_folder)
        rules_dir = DraftService._rules_dir(draft_folder)

        groups: List[Dict[str, Any]] = []

        if os.path.isfile(rule_groups_file):
            try:
                with open(rule_groups_file, "r", encoding="utf-8") as fp:
                    loaded = json.load(fp)
                    if isinstance(loaded, list):
                        groups = loaded
            except json.JSONDecodeError as exc:
                raise ValueError(f"解析规则组文件失败: {rule_groups_file}: {exc}") from exc

        # 如果 rules 目录存在，则尝试使用文件覆盖规则内容，保持数据同步
        if os.path.isdir(rules_dir):
            for group in groups:
                rules = group.get("rules")
                if not isinstance(rules, list):
                    continue
                merged_rules: List[Dict[str, Any]] = []
                for rule in rules:
                    rule_type = str(rule.get("type") or rule.get("title") or "")
                    if not rule_type:
                        continue
                    filename = f"{DraftService._sanitize_rule_filename(rule_type)}.json"
                    rule_path = os.path.join(rules_dir, filename)
                    if os.path.isfile(rule_path):
                        try:
                            with open(rule_path, "r", encoding="utf-8") as fp:
                                file_rule = json.load(fp)
                                if isinstance(file_rule, dict):
                                    merged_rules.append(file_rule)
                                    continue
                        except json.JSONDecodeError:
                            pass
                    merged_rules.append(rule)
                group["rules"] = merged_rules

        return groups

    @staticmethod
    def set_draft_rule_groups(draft_path: str, rule_groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """保存草稿绑定的规则组，并同步生成 rules 目录下的规则文件"""
        if not isinstance(rule_groups, list):
            raise ValueError("rule_groups 必须是列表")

        draft_folder = DraftService._resolve_draft_folder(draft_path)
        os.makedirs(draft_folder, exist_ok=True)

        rule_groups_file = DraftService._rule_groups_file(draft_folder)
        rules_dir = DraftService._rules_dir(draft_folder)
        os.makedirs(rules_dir, exist_ok=True)

        # 写入 rule_groups.json
        with open(rule_groups_file, "w", encoding="utf-8") as fp:
            json.dump(rule_groups, fp, ensure_ascii=False, indent=2)

        expected_files: set[str] = set()

        for group in rule_groups:
            rules = group.get("rules", [])
            if not isinstance(rules, list):
                continue
            for rule in rules:
                if not isinstance(rule, dict):
                    continue
                rule_type = str(rule.get("type") or rule.get("title") or "")
                if not rule_type:
                    continue
                filename = f"{DraftService._sanitize_rule_filename(rule_type)}.json"
                file_path = os.path.join(rules_dir, filename)
                expected_files.add(file_path)
                with open(file_path, "w", encoding="utf-8") as fp:
                    json.dump(rule, fp, ensure_ascii=False, indent=2)

        # 清理多余的旧规则文件
        for file_name in os.listdir(rules_dir):
            if not file_name.lower().endswith(".json"):
                continue
            absolute_path = os.path.join(rules_dir, file_name)
            if absolute_path not in expected_files:
                try:
                    os.remove(absolute_path)
                except OSError:
                    pass

        return rule_groups

    @staticmethod
    def get_all_rule_groups(base_path: str) -> List[Dict[str, Any]]:
        """从所有草稿目录收集规则组

        Args:
            base_path: 剪映草稿根目录路径

        Returns:
            所有规则组列表,每个规则组会添加 draft_name 字段标识来源
        """
        if not os.path.exists(base_path):
            raise FileNotFoundError(f"目录不存在: {base_path}")

        if not os.path.isdir(base_path):
            raise ValueError(f"路径不是目录: {base_path}")

        all_groups: List[Dict[str, Any]] = []
        seen_group_ids: set[str] = set()

        try:
            # 遍历所有草稿目录
            for item in os.listdir(base_path):
                item_path = os.path.join(base_path, item)

                # 只处理目录
                if not os.path.isdir(item_path):
                    continue

                # 检查是否有规则
                if not DraftService._draft_has_rules(item_path):
                    continue

                # 尝试读取该草稿的规则组
                try:
                    groups = DraftService.get_draft_rule_groups(item_path)

                    # 为每个规则组添加来源信息和去重
                    for group in groups:
                        if not isinstance(group, dict):
                            continue

                        group_id = group.get('id', '')
                        if not group_id:
                            continue

                        # 去重:如果已经存在相同ID的规则组,跳过
                        if group_id in seen_group_ids:
                            continue

                        seen_group_ids.add(group_id)

                        # 添加来源草稿名称
                        group_with_source = {
                            **group,
                            'draft_name': item,
                            'draft_path': item_path,
                        }
                        all_groups.append(group_with_source)

                except (FileNotFoundError, ValueError, json.JSONDecodeError):
                    # 跳过解析失败的草稿
                    continue

        except PermissionError:
            raise PermissionError(f"没有权限访问目录: {base_path}")
        except Exception as e:
            raise Exception(f"收集规则组失败: {str(e)}")

        return all_groups

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

        # 获取草稿文件夹的完整路径 (包含草稿名称的目录)
        # file_path 示例: G:\jianyin5.9_drafts\JianyingPro Drafts\火柴人双排版\draft_content.json
        # draft_folder_path 应该是: G:\jianyin5.9_drafts\JianyingPro Drafts\火柴人双排版
        draft_folder_path = os.path.dirname(file_path)

        # 替换路径占位符的辅助函数
        def replace_path_placeholder(path_str: str) -> str:
            """将路径中的占位符替换为实际的草稿路径"""
            if not isinstance(path_str, str):
                return path_str

            # 匹配模式: ##_draftpath_placeholder_{任意内容}_##
            pattern = r'##_draftpath_placeholder_[^#]+_##'

            # 查找占位符
            match = re.search(pattern, path_str)
            if match:
                # 使用字符串替换而不是正则替换,避免反斜杠转义问题
                placeholder = match.group(0)
                result = path_str.replace(placeholder, draft_folder_path)
                # 确保整个路径使用统一的反斜杠(Windows标准)
                result = result.replace('/', '\\')
                return result

            return path_str

        # 处理每个素材类型中items的path属性
        for mat_type, mat_list in materials.items():
            if isinstance(mat_list, list):
                for item in mat_list:
                    if isinstance(item, dict) and 'path' in item:
                        item['path'] = replace_path_placeholder(item['path'])

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

                draft_file = None
                for filename in ['draft_content.json', 'draft_info.json']:
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
                        'folder_path': item_path,
                        'has_rules': DraftService._draft_has_rules(item_path),
                    })
        except PermissionError as e:
            raise PermissionError(f"没有权限访问目录: {base_path}")
        except Exception as e:
            raise Exception(f"列出草稿失败: {str(e)}")

        # 按修改时间降序排序 (最新的在前)
        drafts.sort(key=lambda x: x['modified_time'], reverse=True)

        return drafts
