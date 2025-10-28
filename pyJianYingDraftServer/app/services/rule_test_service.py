"""
规则组测试执行服务
"""

import json
import os
import re
import uuid
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set

import pyJianYingDraft as draft
from pyJianYingDraft.template_mode import ImportedSegment
from pyJianYingDraft.metadata.video_group_animation import GroupAnimationType
from pyJianYingDraft.animation import SegmentAnimations, VideoAnimation

from app.config import get_config
from app.models.rule_models import (
    MaterialPayload,
    RawMaterialPayload,
    RawSegmentPayload,
    RuleGroupTestRequest,
    RuleGroupTestResponse,
    SegmentStylesPayload,
    TestDataModel,
    TestTrackModel,
)


class RuleTestService:
    """执行规则测试并生成剪映草稿"""

    DEFAULT_WIDTH = 1920
    DEFAULT_HEIGHT = 1080
    DEFAULT_FPS = 30

    AUDIO_TYPES = {"audio", "music", "sound", "extract_music"}
    TEXT_TYPES = {"text", "subtitle"}
    EFFECT_TYPES = {"video_effect"}

    @staticmethod
    def run_test(payload: RuleGroupTestRequest) -> RuleGroupTestResponse:
        """根据规则组和测试数据生成新的剪映草稿"""
        rule_group = payload.ruleGroup
        test_data = payload.testData
        materials = payload.materials

        draft_root = RuleTestService._get_draft_root()
        draft_name = RuleTestService._build_draft_name(rule_group.title)

        # 解析画布配置，优先使用draft_config，回退到旧字段
        canvas_width = RuleTestService.DEFAULT_WIDTH
        canvas_height = RuleTestService.DEFAULT_HEIGHT
        fps = RuleTestService.DEFAULT_FPS

        if payload.draft_config:
            # 使用新的draft_config结构
            if payload.draft_config.canvas_config:
                canvas_width = payload.draft_config.canvas_config.get("canvas_width") or canvas_width
                canvas_height = payload.draft_config.canvas_config.get("canvas_height") or canvas_height
            if payload.draft_config.fps:
                fps = payload.draft_config.fps

        folder = draft.DraftFolder(draft_root)
        script = folder.create_draft(
            draft_name,
            canvas_width,
            canvas_height,
            fps=fps,
            allow_replace=True,
        )

        # 应用draft_config到草稿JSON（覆盖草稿文件的配置字段）
        RuleTestService._apply_draft_config(script, payload)

        RuleTestService._attach_segment_styles(materials, payload.segment_styles)

        rule_lookup = {rule.type: rule for rule in rule_group.rules}
        material_lookup = {material.id: material for material in materials}
        plans = RuleTestService._build_segment_plans(test_data, rule_lookup, material_lookup)

        if payload.use_raw_segments:
            RuleTestService._build_raw_draft(script, payload)
            if plans:
                # 将raw_segments的默认时间信息注入到plans中(作为未指定值的后备)
                RuleTestService._inject_raw_segment_defaults(plans, payload.raw_segments or [])
                RuleTestService._merge_raw_segments_with_test_data(script, plans)
        else:
            track_configs = RuleTestService._prepare_tracks(test_data, rule_lookup, material_lookup)
            track_order = RuleTestService._resolve_track_order(test_data, track_configs)

            track_name_map: Dict[str, str] = {}
            used_names: Set[str] = set()
            for track_id in track_order:
                track_info = track_configs[track_id]
                track_name = RuleTestService._ensure_unique_name(track_info["name"], used_names)
                track_type = RuleTestService._resolve_track_type(track_info["type"])

                script.add_track(track_type, track_name=track_name)
                track_name_map[track_id] = track_name
                used_names.add(track_name)

            for plan in plans:
                track_name = track_name_map[plan["track_id"]]
                segment = RuleTestService._build_segment(plan["material"], plan["item"])
                script.add_segment(segment, track_name=track_name)

        script.save()

        draft_path = os.path.abspath(os.path.join(draft_root, draft_name))
        return RuleGroupTestResponse(
            status_code=200,
            draft_path=draft_path,
            message="规则测试执行完成",
        )

    @staticmethod
    def _get_draft_root() -> str:
        draft_root = get_config("PYJY_DRAFT_ROOT") or os.getenv("PYJY_DRAFT_ROOT")
        if not draft_root:
            raise ValueError("未在 config.json 或环境变量 PYJY_DRAFT_ROOT 中配置草稿保存目录")
        draft_root = os.path.abspath(draft_root)
        if not os.path.isdir(draft_root):
            raise FileNotFoundError(f"草稿根目录不存在: {draft_root}")
        return draft_root

    @staticmethod
    def _build_draft_name(title: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = re.sub(r"[^a-zA-Z0-9_-]", "-", title or "rule-test").strip("-")
        if not base:
            base = "rule-test"
        return f"{base}_{timestamp}"

    @staticmethod
    def _infer_track_type(material: MaterialPayload) -> str:
        extra = material.model_extra or {}
        material_type = (material.type or extra.get("material_type") or "video").lower()
        print(material_type)
        if material_type in RuleTestService.AUDIO_TYPES:
            return "audio"
        if material_type in RuleTestService.TEXT_TYPES:
            return "text"
        if material_type in RuleTestService.EFFECT_TYPES:
            return "effect"
        if material_type in {"sticker"}:
            return "sticker"
        return "video"

    @staticmethod
    def _prepare_tracks(
        test_data: TestDataModel,
        rule_lookup: Dict[str, Any],
        material_lookup: Dict[str, MaterialPayload],
    ) -> Dict[str, Dict[str, str]]:
        configs: Dict[str, Dict[str, str]] = {
            track.id: {
                "name": track.title or f"Track {track.id}",
                "type": track.type.lower(),
            }
            for track in test_data.tracks
        }

        for item in test_data.items:
            rule = rule_lookup.get(item.type)
            if not rule:
                raise ValueError(f"规则类型 {item.type} 不存在")

            track_id = str(item.data.get("track", "")).strip()
            if not track_id:
                raise ValueError(f"规则 {item.type} 缺少轨道标识 track")

            if track_id not in configs:
                configs[track_id] = {"name": f"Track {track_id}", "type": "video"}

            for material_id in rule.material_ids:
                material = material_lookup.get(material_id)
                if not material:
                    raise ValueError(f"素材 {material_id} 未提供")
                inferred_type = RuleTestService._infer_track_type(material)
                configs[track_id]["type"] = inferred_type

        return configs

    @staticmethod
    def _resolve_track_order(test_data: TestDataModel, configs: Dict[str, Dict[str, str]]) -> List[str]:
        order: List[str] = [track.id for track in test_data.tracks if track.id in configs]
        for track_id in configs.keys():
            if track_id not in order:
                order.append(track_id)
        return order

    @staticmethod
    def _ensure_unique_name(name: str, used: set[str]) -> str:
        candidate = name
        index = 1
        while candidate in used:
            candidate = f"{name}_{index}"
            index += 1
        return candidate

    @staticmethod
    def _resolve_track_type(name: str) -> draft.TrackType:
        try:
            return draft.TrackType.from_name(name)
        except ValueError as exc:
            raise ValueError(f"不支持的轨道类型: {name}") from exc

    @staticmethod
    def _build_segment_plans(
        test_data: TestDataModel,
        rule_lookup: Dict[str, Any],
        material_lookup: Dict[str, MaterialPayload],
    ) -> List[Dict[str, Any]]:
        plans: List[Dict[str, Any]] = []
        for item in test_data.items:
            rule = rule_lookup.get(item.type)
            if not rule:
                raise ValueError(f"规则类型 {item.type} 不存在")

            track_id = str(item.data.get("track", "")).strip()
            if not track_id:
                raise ValueError(f"规则 {item.type} 缺少轨道标识 track")

            for material_id in rule.material_ids:
                material = material_lookup.get(material_id)
                if not material:
                    raise ValueError(f"素材 {material_id} 未提供")
                plans.append(
                    {
                        "track_id": track_id,
                        "material": material,
                        "item": item.data,
                    }
                )
        return plans

    @staticmethod
    def _build_segment(material: MaterialPayload, item_data: Dict[str, Any]):
        start = float(item_data.get("start", 0.0))
        material_type = RuleTestService._infer_material_kind(material)
        path = (
            item_data.get("path")
            or material.path
            or (getattr(material, "model_extra", None) or {}).get("media_path")
            or (getattr(material, "model_extra", None) or {}).get("material_url")
        )
        track_id = str(item_data.get("track", "")).strip()
        style_hint = RuleTestService._extract_style_for_track(material, track_id)

        duration_value = RuleTestService._resolve_duration_seconds(material, item_data, material_type, path)
        timerange = draft.trange(f"{start}s", f"{duration_value}s")

        if material_type in RuleTestService.AUDIO_TYPES:
            if not path:
                raise ValueError(f"audio material {material.id} missing file path")
            volume = RuleTestService._resolve_volume(item_data, style_hint)
            return draft.AudioSegment(path, timerange, volume=volume)

        if material_type in RuleTestService.TEXT_TYPES:
            text_content = item_data.get("text")
            if not text_content:
                raise ValueError(f"text material {material.id} missing text content")
            clip = RuleTestService._build_clip_settings(item_data, style_hint)
            return draft.TextSegment(text_content, timerange, clip_settings=clip)

        if not path:
            raise ValueError(f"video material {material.id} missing file path")
        clip = RuleTestService._build_clip_settings(item_data, style_hint)
        volume = RuleTestService._resolve_volume(item_data, style_hint)
        return draft.VideoSegment(path, timerange, volume=volume, clip_settings=clip)

    @staticmethod
    def _extract_style_for_track(material: MaterialPayload, track_id: str) -> Optional[Dict[str, Any]]:
        direct_styles = getattr(material, "segment_styles_map", None)
        styles: Optional[Dict[str, Any]] = direct_styles if isinstance(direct_styles, dict) else None

        extra = getattr(material, "model_extra", None) or {}
        if styles is None:
            for key in ("segmentStyles", "segment_styles", "styles"):
                value = extra.get(key)
                if isinstance(value, dict):
                    styles = value
                    break
        if not styles:
            return None
        if track_id and track_id in styles and isinstance(styles[track_id], dict):
            return styles[track_id]
        default_style = styles.get("__default__")
        if isinstance(default_style, dict):
            return default_style
        for candidate in styles.values():
            if isinstance(candidate, dict):
                return candidate
        return None

    @staticmethod
    def _resolve_volume(item_data: Dict[str, Any], style: Optional[Dict[str, Any]]) -> float:
        volume = item_data.get("volume")
        if volume is None and style:
            for key in ("volume", "last_nonzero_volume"):
                candidate = style.get(key)
                if candidate is not None:
                    volume = candidate
                    break
        if volume is None:
            return 1.0
        try:
            return float(volume)
        except (TypeError, ValueError):
            return 1.0

    @staticmethod
    def _build_clip_settings(item_data: Dict[str, Any], style: Optional[Dict[str, Any]] = None) -> Optional[draft.ClipSettings]:
        scale = item_data.get("scale")
        x = item_data.get("x")
        y = item_data.get("y")

        clip_hint: Optional[Dict[str, Any]] = None
        if style and isinstance(style, dict):
            clip_candidate = style.get("clip")
            if isinstance(clip_candidate, dict):
                clip_hint = clip_candidate
        if clip_hint:
            scale_hint = clip_hint.get("scale")
            if scale is None and isinstance(scale_hint, dict):
                for key in ("x", "y"):
                    if scale_hint.get(key) is not None:
                        try:
                            scale = float(scale_hint.get(key))
                        except (TypeError, ValueError):
                            pass
                        break
            transform_hint = clip_hint.get("transform")
            if isinstance(transform_hint, dict):
                if x is None and transform_hint.get("x") is not None:
                    x = transform_hint.get("x")
                if y is None and transform_hint.get("y") is not None:
                    y = transform_hint.get("y")

        if scale is None and x is None and y is None:
            return None
        scale_value = float(scale) if scale is not None else 1.0
        transform_x = float(x) if x is not None else 0.0
        transform_y = float(y) if y is not None else 0.0
        return draft.ClipSettings(
            scale_x=scale_value,
            scale_y=scale_value,
            transform_x=transform_x,
            transform_y=transform_y,
        )

    @staticmethod
    def _infer_material_kind(material: MaterialPayload) -> str:
        extra = getattr(material, "model_extra", None) or {}
        return (material.type or extra.get("material_type") or extra.get("material_category") or "video").lower()

    @staticmethod
    def _resolve_duration_seconds(
        material: MaterialPayload,
        item_data: Dict[str, Any],
        material_type: str,
        path: Optional[str],
    ) -> float:
        explicit_duration = item_data.get("duration")
        candidate = float(explicit_duration) if explicit_duration is not None else None

        extra_duration = RuleTestService._extract_duration_from_material(material)
        if candidate is None and extra_duration is not None:
            candidate = extra_duration

        probed_duration: Optional[float] = None
        if path:
            probed_duration = RuleTestService._probe_media_duration(path, material_type)
            if candidate is None:
                candidate = probed_duration

        if candidate is None or candidate <= 0:
            raise ValueError(f"素材 {material.id} 缺少持续时长 duration")

        if probed_duration is not None:
            candidate = probed_duration if explicit_duration is None else min(candidate, probed_duration)

        return candidate

    @staticmethod
    def _apply_draft_config(script: draft.ScriptFile, payload: RuleGroupTestRequest) -> None:
        """
        应用draft_config到草稿JSON，覆盖草稿文件的配置字段
        canvas_config, config, fps 对应草稿JSON的顶层字段
        """
        print(payload.draft_config)
        if not payload.draft_config:
            return

        # 获取草稿的原始JSON数据（ScriptFile对象应该有导出方法）
        # 我们需要在保存前修改这些字段

        # 应用 canvas_config（画布配置）
        if payload.draft_config.canvas_config:
            # canvas_config 对应草稿JSON的 canvas_config 字段
            # 注意: dumps() 方法会用 width/height 属性重新构建 canvas_config
            # 所以我们需要同时修改这些属性
            config = payload.draft_config.canvas_config
            if "width" in config:
                script.width = config["width"]
            if "height" in config:
                script.height = config["height"]
            if "ratio" in config:
                # ratio 需要直接写入 content,因为 dumps() 硬编码为 "original"
                script.content["canvas_config"]["ratio"] = config["ratio"]
            print(f"[DEBUG] 应用canvas_config: {payload.draft_config.canvas_config}")

        # 应用 config（通用配置）
        if payload.draft_config.config:
            # config 对应草稿JSON的 config 字段
            # 注意:必须直接修改 script.content["config"],因为 dumps() 方法使用的是 self.content
            if "config" not in script.content:
                script.content["config"] = {}
            for key, value in payload.draft_config.config.items():
                script.content["config"][key] = value
            print(f"[DEBUG] 应用config: {payload.draft_config.config}")

        # fps 已在create_draft时设置，这里可选择性覆盖
        if payload.draft_config.fps:
            script.fps = payload.draft_config.fps
            print(f"[DEBUG] 覆盖fps: {payload.draft_config.fps}")

    @staticmethod
    def _attach_segment_styles(materials: List[MaterialPayload], segment_styles: Optional[SegmentStylesPayload]) -> None:
        if not segment_styles:
            return
        for material in materials:
            styles = segment_styles.get(material.id)
            if isinstance(styles, dict) and styles:
                setattr(material, "segment_styles_map", styles)

    @staticmethod
    def _build_raw_draft(script: draft.ScriptFile, payload: RuleGroupTestRequest) -> None:
        raw_segments = payload.raw_segments or []
        if not raw_segments:
            raise ValueError("use_raw_segments 为 True 时必须提供 raw_segments")

        materials = RuleTestService._prepare_raw_materials(payload.raw_materials or [], raw_segments)

        # 从 testData.tracks 中获取轨道信息（包含层级选项）
        test_tracks = payload.testData.tracks if payload.testData else None
        tracks = RuleTestService._prepare_raw_tracks(raw_segments, test_tracks)
        for track in tracks:
            track_type = track.get("type")
            segments_count = len(track.get("segments", []))

        script.add_raw_segments(tracks, materials, ensure_unique_material_ids=True)

        for track in script.imported_tracks:
            track_type = getattr(track, "type", "?")
            segments = getattr(track, "segments", None)
            segments_count = len(segments) if segments else 0

    @staticmethod
    def _prepare_raw_materials(
        raw_materials: List[RawMaterialPayload], raw_segments: List[RawSegmentPayload]
    ) -> Dict[str, List[Dict[str, Any]]]:
        grouped: Dict[str, Dict[str, Dict[str, Any]]] = {}
        material_map: Dict[str, Dict[str, Any]] = {}
        id_category_map: Dict[str, str] = {}

        def register_material(category: Optional[str], material_id: Optional[str], data: Optional[Dict[str, Any]]) -> None:
            if not category or not material_id or not data:
                return
            key = str(material_id)
            if key in material_map:
                return
            payload = deepcopy(data)
            payload.setdefault("id", key)
            material_map[key] = payload
            id_category_map[key] = category

        for raw in raw_materials:
            if not raw.category:
                raise ValueError("raw_materials 条目缺少 category")
            material_id = raw.id or raw.data.get("id") or raw.data.get("material_id")
            if not material_id:
                raise ValueError("raw_materials 条目缺少 id")
            register_material(raw.category, material_id, raw.data)

        required_material_ids: Set[str] = set()

        for segment in raw_segments:
            material_payload = segment.material
            if material_payload:
                if not isinstance(material_payload, dict):
                    raise TypeError("raw segment material 数据必须是字典")
                category = segment.material_category or material_payload.get("category")
                material_id = (
                    material_payload.get("id")
                    or material_payload.get("material_id")
                    or segment.material_id
                )
                register_material(category, material_id, material_payload)
                if material_id:
                    required_material_ids.add(str(material_id))

            extra_materials = segment.extra_materials or {}
            for category, items in extra_materials.items():
                if not isinstance(items, list):
                    raise TypeError("extra_materials 中的分类应对应素材列表")
                for item in items:
                    if not isinstance(item, dict):
                        raise TypeError("extra_materials 内素材应为字典")
                    candidate_id = item.get("id") or item.get("material_id")
                    register_material(category, candidate_id, item)
                    if candidate_id:
                        required_material_ids.add(str(candidate_id))

        for segment in raw_segments:
            primary_id = segment.material_id or segment.segment.get("material_id")
            if primary_id:
                required_material_ids.add(str(primary_id))

            extra_refs = segment.segment.get("extra_material_refs")
            if isinstance(extra_refs, list):
                for ref in extra_refs:
                    if ref is not None:
                        required_material_ids.add(str(ref))

        missing_materials = [mid for mid in required_material_ids if mid not in material_map]
        if missing_materials:
            raise ValueError(f"缺少以下原始素材定义: {missing_materials}")

        for material_id in required_material_ids:
            category = id_category_map.get(material_id)
            if not category:
                raise ValueError(f"未能确定素材 {material_id} 的分类")
            bucket = grouped.setdefault(category, {})
            if material_id not in bucket:
                bucket[material_id] = deepcopy(material_map[material_id])

        return {category: list(items.values()) for category, items in grouped.items()}

    @staticmethod
    def _prepare_raw_tracks(
        raw_segments: List[RawSegmentPayload],
        test_tracks: Optional[List[TestTrackModel]] = None
    ) -> List[Dict[str, Any]]:
        # 首先从 testData.tracks 构建 track_map
        track_map: Dict[str, Dict[str, Any]] = {}

        if test_tracks:
            for test_track in test_tracks:
                track = {
                    "id": test_track.id,
                    "type": test_track.type,
                    "name": test_track.title or test_track.type,
                    "is_default_name": test_track.title is None,
                    "segments": [],
                    "attribute": 0,
                    "flag": 0,
                }
                # 从 testData.tracks 中添加层级选项
                if test_track.relative_index is not None:
                    track["relative_index"] = test_track.relative_index
                if test_track.absolute_index is not None:
                    track["absolute_index"] = test_track.absolute_index
                track_map[test_track.id] = track

        # 然后处理 raw_segments，添加到对应的轨道中
        for raw in raw_segments:
            track_id = raw.track_id
            track_type = raw.track_type
            if not track_id:
                raise ValueError("原始片段缺少 track_id")
            if not track_type:
                raise ValueError("原始片段缺少 track_type")

            track = track_map.get(track_id)
            if track is None:
                # 如果 testData.tracks 中没有定义该轨道，则从 raw_segment 创建
                track = {
                    "id": track_id,
                    "type": track_type,
                    "name": raw.track_name or track_type,
                    "is_default_name": raw.track_name is None,
                    "segments": [],
                    "attribute": 0,
                    "flag": 0,
                }
                # 从 raw_segment 中添加层级选项（作为后备）
                if raw.relative_index is not None:
                    track["relative_index"] = raw.relative_index
                if raw.absolute_index is not None:
                    track["absolute_index"] = raw.absolute_index
                track_map[track_id] = track
            else:
                # 验证轨道类型一致性
                if track["type"] != track_type:
                    raise ValueError(f"轨道 {track_id} 的 track_type 不一致")

                # 如果 raw_segment 中也有层级选项，验证其与 testData.tracks 的一致性
                if raw.relative_index is not None and track.get("relative_index") is not None:
                    if track.get("relative_index") != raw.relative_index:
                        raise ValueError(f"轨道 {track_id} 的 relative_index 不一致")
                if raw.absolute_index is not None and track.get("absolute_index") is not None:
                    if track.get("absolute_index") != raw.absolute_index:
                        raise ValueError(f"轨道 {track_id} 的 absolute_index 不一致")

            segment_data = deepcopy(raw.segment)
            if not isinstance(segment_data, dict):
                raise TypeError("原始片段数据必须是字典")
            if "target_timerange" not in segment_data:
                raise ValueError("原始片段缺少 target_timerange")
            if ("material_id" not in segment_data or not segment_data["material_id"]) and raw.material_id:
                segment_data["material_id"] = raw.material_id

            track["segments"].append(segment_data)

        return list(track_map.values())

    @staticmethod
    def _seconds_to_microseconds(value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    return None
            return int(float(value) * 1_000_000)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _find_imported_material(script: draft.ScriptFile, material_id: str) -> Optional[Dict[str, Any]]:
        for material_list in script.imported_materials.values():
            for entry in material_list:
                entry_id = entry.get("id") or entry.get("material_id")
                if entry_id is not None and str(entry_id) == material_id:
                    return entry
        return None

    @staticmethod
    def _update_text_material(entry: Dict[str, Any], text_value: str) -> None:
        content = entry.get("content")
        parsed_content: Optional[Dict[str, Any]] = None
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    parsed_content = parsed
            except json.JSONDecodeError:
                parsed_content = None
        elif isinstance(content, dict):
            parsed_content = deepcopy(content)

        if parsed_content is None:
            parsed_content = {"text": text_value}
        else:
            parsed_content["text"] = text_value
            styles = parsed_content.get("styles")
            if isinstance(styles, list):
                for style in styles:
                    if isinstance(style, dict) and isinstance(style.get("range"), list) and len(style["range"]) == 2:
                        style["range"] = [0, len(text_value)]

        entry["content"] = json.dumps(parsed_content, ensure_ascii=False)
        entry["text"] = text_value

    @staticmethod
    def _apply_item_data_to_material(
        script: draft.ScriptFile, material_id: Optional[str], item_data: Dict[str, Any],
        style_hint: Optional[Dict[str, Any]] = None
    ) -> None:
        if not material_id:
            return
        material_entry = RuleTestService._find_imported_material(script, str(material_id))

        # 处理 path: 优先级为 item_data > segment_styles > material原值(来自raw_segments模板)
        path_value = item_data.get("path")
        if path_value:
            # item_data 明确指定了 path,使用它(最高优先级)
            material_entry["path"] = path_value
            if "media_path" in material_entry:
                material_entry["media_path"] = path_value
            if "material_url" in material_entry:
                material_entry["material_url"] = path_value
        elif style_hint and "path" in style_hint:
            # segment_styles 中有 path 预设,使用它(中等优先级)
            style_path = style_hint["path"]
            material_entry["path"] = style_path
            if "media_path" in material_entry:
                material_entry["media_path"] = style_path
            if "material_url" in material_entry:
                material_entry["material_url"] = style_path
        # 否则保持 material_entry 中的原值(来自 raw_segments 模板,最低优先级)

        duration_us = RuleTestService._seconds_to_microseconds(item_data.get("duration"))
        if duration_us is not None:
            material_entry["duration"] = duration_us
            material_entry["duration_us"] = duration_us
            material_entry["duration_seconds"] = duration_us / 1_000_000

        if "name" in item_data and item_data["name"]:
            material_entry["name"] = item_data["name"]

        if "text" in item_data and item_data["text"] is not None:
            RuleTestService._update_text_material(material_entry, str(item_data["text"]))

    @staticmethod
    def _apply_item_data_to_segment(segment: ImportedSegment, item_data: Dict[str, Any]) -> None:
        start_us = RuleTestService._seconds_to_microseconds(item_data.get("start"))
        duration_us = RuleTestService._seconds_to_microseconds(item_data.get("duration"))
        target = segment.target_timerange
        raw_target = segment.raw_data.setdefault("target_timerange", {})
        if start_us is not None:
            target.start = start_us
            raw_target["start"] = start_us
        if duration_us is not None:
            target.duration = duration_us
            raw_target["duration"] = duration_us

        if "volume" in item_data and item_data["volume"] is not None:
            segment.raw_data["volume"] = item_data["volume"]
            segment.raw_data["last_nonzero_volume"] = item_data["volume"]

        if "speed" in item_data and item_data["speed"] is not None:
            segment.raw_data["speed"] = item_data["speed"]

        if "name" in item_data and item_data["name"]:
            segment.raw_data["name"] = item_data["name"]

        source_start_us = RuleTestService._seconds_to_microseconds(item_data.get("source_start"))
        source_duration_us = RuleTestService._seconds_to_microseconds(item_data.get("source_duration"))

        # 获取speed(优先从item_data,否则从segment的raw_data)
        speed = item_data.get("speed")
        if speed is None:
            speed = segment.raw_data.get("speed", 1.0)

        if hasattr(segment, "source_timerange") and getattr(segment, "source_timerange") is not None:
            raw_source = segment.raw_data.setdefault("source_timerange", {})
            source_range = segment.source_timerange  # type: ignore[attr-defined]

            if source_start_us is not None:
                source_range.start = source_start_us
                raw_source["start"] = source_start_us

            if source_duration_us is not None:
                source_range.duration = source_duration_us
                raw_source["duration"] = source_duration_us
            else:
                # ⭐ 关键修复:如果没有显式指定source_duration,根据target和speed计算
                target_duration = segment.target_timerange.duration
                correct_source_duration = round(target_duration * speed)
                source_range.duration = correct_source_duration
                raw_source["duration"] = correct_source_duration

        # 处理clip相关属性（位置、大小等）- 只在有指定值时更新，否则保持模板原值
        x = item_data.get("x")
        y = item_data.get("y")
        scale = item_data.get("scale")

        if x is not None or y is not None or scale is not None:
            # 获取clip对象（应该已从模板克隆）
            clip = segment.raw_data.get("clip")
            if not clip:
                # 如果模板没有clip，创建一个基础结构
                clip = {}
                segment.raw_data["clip"] = clip

            # 更新transform（位置）- 只更新指定的值
            if x is not None or y is not None:
                transform = clip.get("transform")
                if not transform:
                    # 如果模板没有transform，创建默认值
                    transform = {"x": 0.0, "y": 0.0}
                    clip["transform"] = transform

                if x is not None:
                    transform["x"] = float(x)
                if y is not None:
                    transform["y"] = float(y)

            # 更新scale（大小）
            if scale is not None:
                scale_obj = clip.get("scale")
                if not scale_obj:
                    # 如果模板没有scale，创建默认值
                    scale_obj = {"x": 1.0, "y": 1.0}
                    clip["scale"] = scale_obj

                scale_value = float(scale)
                scale_obj["x"] = scale_value
                scale_obj["y"] = scale_value

        # 注意：animations字段在外层单独处理，确保它是最后执行的

    @staticmethod
    def _apply_animations_to_segment(segment: ImportedSegment, animations: Dict[str, Any], script: draft.ScriptFile) -> None:
        """
        根据animations配置为segment添加或修改组合动画

        正确结构:
        - materials.material_animations[] - 动画定义在草稿级别的materials字段中
        - segment.extra_material_refs 引用 material_animation 的 ID

        animations格式:
        - {"name": "动画名称", "duration": 持续时长(秒)} - 创建新动画并替换
        - {"name": "动画名称"} - 创建新动画,使用片段时长作为duration
        - {"duration": 持续时长(秒)} - 仅修改现有动画的duration
        """
        animation_name = animations.get("name")
        animation_duration = animations.get("duration")

        # 获取segment的extra_material_refs,查找material_animation的ID
        extra_refs = segment.raw_data.get("extra_material_refs", [])
        if not isinstance(extra_refs, list):
            extra_refs = []

        try:
            # 情况1: 只指定duration，修改现有动画的duration
            if animation_duration is not None and not animation_name:
                # 在materials.material_animations中查找并修改
                material_animations = script.imported_materials.get("material_animations", [])
                if not material_animations:
                    return

                # 将duration从秒转换为微秒
                duration_us = RuleTestService._seconds_to_microseconds(animation_duration)
                if duration_us is None or duration_us <= 0:
                    return

                # 遍历所有在extra_refs中引用的material_animations
                modified = False
                for mat_anim in material_animations:
                    if mat_anim.get("id") in extra_refs:
                        animations_list = mat_anim.get("animations", [])
                        if isinstance(animations_list, list):
                            for anim in animations_list:
                                if isinstance(anim, dict):
                                    anim["duration"] = duration_us
                                    modified = True

            # 情况2: 指定了name，创建新动画（有或没有duration）
            if animation_name:
                # 从GroupAnimationType枚举中查找动画
                try:
                    animation_type = GroupAnimationType.from_name(animation_name)
                except ValueError:
                    return

                # 确定动画duration
                if animation_duration is not None:
                    # 使用指定的duration
                    duration_us = RuleTestService._seconds_to_microseconds(animation_duration)
                    if duration_us is None or duration_us <= 0:
                        return
                else:
                    # 使用片段的target_timerange.duration作为动画duration
                    duration_us = segment.target_timerange.duration

                # 创建Segment Animations对象
                segment_animations = SegmentAnimations()

                # 创建VideoAnimation（组合动画从片段开始位置0开始）
                video_animation = VideoAnimation(
                    animation_type=animation_type,
                    start=0,
                    duration=duration_us
                )

                # 添加动画到SegmentAnimations
                segment_animations.add_animation(video_animation)

                # 生成新的material_animation ID
                new_anim_id = str(uuid.uuid4()).upper()

                # 导出动画JSON并添加必要字段
                anim_json = segment_animations.export_json()
                anim_json["id"] = new_anim_id

                # 添加到草稿级别的materials.material_animations
                material_animations_list = script.imported_materials.setdefault("material_animations", [])
                material_animations_list.append(anim_json)

                # 更新segment的extra_material_refs,添加新动画ID
                # 首先移除旧的动画引用(假设之前引用的也是material_animation)
                existing_refs = segment.raw_data.get("extra_material_refs", [])
                if not isinstance(existing_refs, list):
                    existing_refs = []

                # 过滤掉旧的material_animation引用
                old_anim_ids = set()
                if "material_animations" in script.imported_materials:
                    old_anim_ids = {ma.get("id") for ma in script.imported_materials["material_animations"] if ma.get("id")}

                # 保留非动画的引用(speeds, canvases等)
                new_refs = [ref for ref in existing_refs if ref not in old_anim_ids or ref == new_anim_id]

                # 添加新动画ID（确保在正确位置，通常在第3个位置）
                # extra_material_refs顺序: [speed_id, canvas_id, animation_id, sound_channel_id, vocal_separation_id]
                if len(new_refs) >= 2 and new_anim_id not in new_refs:
                    # 在第3个位置插入动画ID
                    new_refs.insert(2, new_anim_id)
                elif new_anim_id not in new_refs:
                    new_refs.append(new_anim_id)

                segment.raw_data["extra_material_refs"] = new_refs
                return


        except Exception as e:
            print(f"[ERROR] 处理animations失败: {e}")
            import traceback
            traceback.print_exc()

    @staticmethod
    def _inject_raw_segment_defaults(plans: List[Dict[str, Any]], raw_segments: List[RawSegmentPayload]) -> None:
        """
        将raw_segments中的默认时间信息注入到plans的item_data中
        只在item_data中未明确指定start/duration时才注入默认值

        匹配策略:通过material_id匹配raw_segment和plan
        - plan中的material对象的id对应raw_segment的material_id
        - 如果同一个material_id有多个raw_segments,按顺序匹配
        """
        if not raw_segments:
            return

        # 创建raw_segments的索引(按material_id分组)
        raw_segments_by_material: Dict[str, List[RawSegmentPayload]] = {}
        for raw_seg in raw_segments:
            material_id = raw_seg.material_id
            if not material_id:
                # 尝试从segment中获取material_id
                material_id = raw_seg.segment.get("material_id")

            if material_id:
                material_id_str = str(material_id)
                if material_id_str not in raw_segments_by_material:
                    raw_segments_by_material[material_id_str] = []
                raw_segments_by_material[material_id_str].append(raw_seg)

        # 为每个material_id维护一个指针,指向下一个要使用的raw_segment
        material_pointers: Dict[str, int] = defaultdict(int)

        for plan in plans:
            material_obj = plan.get("material")
            item_data = plan.get("item", {})

            if not material_obj:
                continue

            # 获取material的ID
            material_id = material_obj.id if hasattr(material_obj, 'id') else str(material_obj.get('id', ''))
            if not material_id:
                continue

            # 获取该material_id的raw_segments列表
            raw_segs = raw_segments_by_material.get(material_id, [])
            if not raw_segs:
                continue

            # 获取当前指针位置的raw_segment
            pointer = material_pointers[material_id]
            if pointer >= len(raw_segs):
                # 如果raw_segments用完了,循环使用最后一个
                pointer = len(raw_segs) - 1

            raw_seg = raw_segs[pointer]
            raw_seg_data = raw_seg.segment

            # 提取target_timerange中的start和duration
            target_timerange = raw_seg_data.get("target_timerange", {})

            # 只在item_data中未指定start时,使用raw_segment的默认值
            if "start" not in item_data or item_data["start"] is None:
                raw_start_us = target_timerange.get("start")
                if raw_start_us is not None:
                    # 转换为秒
                    item_data["start"] = raw_start_us / 1_000_000

            # 只在item_data中未指定duration时,使用raw_segment的默认值
            if "duration" not in item_data or item_data["duration"] is None:
                raw_duration_us = target_timerange.get("duration")
                if raw_duration_us is not None:
                    # 转换为秒
                    item_data["duration"] = raw_duration_us / 1_000_000

            # 移动指针到下一个raw_segment
            material_pointers[material_id] += 1

    @staticmethod
    def _merge_raw_segments_with_test_data(script: draft.ScriptFile, plans: List[Dict[str, Any]]) -> None:
        """
        根据testData生成新的segments和materials，清除原始样本数据
        每个plan会创建独立的segment和material副本，确保ID唯一性
        """
        if not plans:
            return

        # 1. 收集所有原始segments（按material_id索引）
        segment_by_material_id: Dict[str, ImportedSegment] = {}
        segment_templates_by_type: Dict[str, ImportedSegment] = {}  # 类型后备模板

        for track in script.imported_tracks:
            track_type_enum = getattr(track, "track_type", None)
            if not track_type_enum:
                continue
            track_type = track_type_enum.name if hasattr(track_type_enum, "name") else str(track_type_enum)

            # 尝试获取segments: 优先从属性获取,否则从raw_data获取
            segments = getattr(track, "segments", None)
            if segments is None:
                # 对于ImportedTrack(effect/filter等不可修改轨道),从raw_data获取
                raw_data = getattr(track, "raw_data", None)
                if raw_data and isinstance(raw_data, dict):
                    raw_segments = raw_data.get("segments", [])
                    # 将原始segment JSON包装为ImportedSegment对象
                    from pyJianYingDraft.template_mode import ImportedSegment
                    segments = [ImportedSegment(seg) for seg in raw_segments] if raw_segments else None

            # 调试:打印轨道类型
            print(f"[DEBUG] 加载的轨道: track_type={track_type}, segments={len(segments) if segments else 0}")

            if segments:
                for seg in segments:
                    mat_id = getattr(seg, "material_id", None)
                    if mat_id:
                        segment_by_material_id[str(mat_id)] = seg

                # 保留类型的第一个segment作为后备模板
                if track_type not in segment_templates_by_type and len(segments) > 0:
                    segment_templates_by_type[track_type] = segments[0]

        if not segment_by_material_id and not segment_templates_by_type:
            return

        print(f"[DEBUG] 收集到 {len(segment_by_material_id)} 个segment模板(按material_id)")
        print(f"[DEBUG] 类型模板: {list(segment_templates_by_type.keys())}")

        # 2. 保存原始materials的深拷贝（用于克隆）
        original_materials = deepcopy(script.imported_materials)

        # 3. 清空所有旧轨道
        old_tracks_count = len(script.imported_tracks)
        script.imported_tracks.clear()

        # 4. 清空所有materials（样本数据不应写入）
        old_materials_count = sum(len(mats) for mats in script.imported_materials.values())
        script.imported_materials.clear()

        # 5. 从testData中提取tracks信息用于确定轨道类型
        from app.models.rule_models import RuleGroupTestRequest

        # 获取payload以访问testData.tracks（如果可能）
        # 这里我们需要一个更好的方式来传递track类型信息
        # 暂时先从plan中的material推断类型

        # 5. 根据plans中的track_id创建新轨道映射
        track_map: Dict[str, Any] = {}  # track_id -> ImportedTrack对象
        track_type_hints: Dict[str, str] = {}  # 收集每个轨道应该的类型

        # 先遍历一遍plans，收集轨道类型信息
        for plan in plans:
            track_id = str(plan["track_id"])
            if track_id not in track_type_hints:
                # 从material推断轨道类型
                material_obj = plan["material"]
                inferred_type = RuleTestService._infer_track_type(material_obj)
                track_type_hints[track_id] = inferred_type
                material_id = material_obj.id if hasattr(material_obj, 'id') else material_obj.get('id', 'N/A')
                material_type = material_obj.type if hasattr(material_obj, 'type') else material_obj.get('type', 'N/A')
                print(f"[DEBUG] 收集轨道类型: track_id={track_id}, inferred_type={inferred_type}, material_id={material_id}, material_type={material_type}")

        # 创建轨道
        for plan in plans:
            track_id = str(plan["track_id"])
            if track_id not in track_map:
                # 使用推断的轨道类型
                track_type = track_type_hints.get(track_id, "video")

                # 创建新轨道（使用ImportedTrack的结构）
                new_track_data = {
                    "id": str(uuid.uuid4()).upper(),  # 标准UUID格式，带连字符，大写
                    "type": track_type,  # 使用推断的类型
                    "name": f"Track_{track_id}",  # 添加name字段
                    "segments": [],
                    "attribute": 0,
                    "flag": 0,
                }
                # 创建ImportedTrack实例
                from pyJianYingDraft.template_mode import ImportedMediaTrack
                new_track = ImportedMediaTrack(new_track_data)
                track_map[track_id] = new_track
                script.imported_tracks.append(new_track)
                print(f"[DEBUG] 创建新轨道: track_id={track_id}, type={track_type}, name={new_track_data['name']}")

        # 6. 为每个plan创建新的segment和materials
        created_segments = 0
        for i, plan in enumerate(plans):
            track_id = str(plan["track_id"])
            material_obj = plan["material"]
            item_data = plan["item"]

            # 获取对应轨道
            track = track_map.get(track_id)
            if track is None:  # 使用 is None 而不是 not track
                print(f"[WARNING] 未找到轨道: track_id={track_id}, track_map.keys()={list(track_map.keys())}")
                continue

            # 优先通过material_id查找对应的segment模板
            material_id = material_obj.id if hasattr(material_obj, 'id') else str(material_obj.get('id', ''))
            segment_template = segment_by_material_id.get(material_id)

            if not segment_template:
                # 后备方案:使用轨道类型的第一个segment作为模板
                track_type = track_type_hints.get(track_id, "video")
                segment_template = segment_templates_by_type.get(track_type)
                if not segment_template:
                    # 最后的后备:使用任意可用模板
                    segment_template = segment_templates_by_type.get("video") or next(iter(segment_templates_by_type.values()), None)

                if not segment_template:
                    print(f"[ERROR] 未找到segment模板: material_id={material_id}, track_type={track_type}")
                    continue

                print(f"[WARNING] material_id={material_id} 未找到专用模板,使用类型模板")

            # 克隆segment和materials,分配新ID
            track_type = track_type_hints.get(track_id, "video")
            new_segment, new_material_id = RuleTestService._clone_segment_with_materials(
                script, segment_template, material_obj, original_materials, track_type=track_type
            )

            # 步骤1: 应用segment_styles（预设数据）
            segment_styles = getattr(material_obj, "segment_styles_map", None)
            style_for_track = None
            if segment_styles and isinstance(segment_styles, dict):
                # 尝试获取该track_id的专属样式，或使用__default__样式
                style_for_track = segment_styles.get(track_id) or segment_styles.get("__default__")
                if style_for_track and isinstance(style_for_track, dict):
                    # 应用所有样式属性到segment（包括material_animations）
                    style_properties = ["clip", "hdr_settings", "uniform_scale", "enable_adjust",
                                       "enable_color_correct", "enable_color_correct_adjust",
                                       "enable_lut", "intensity", "reverse", "material_animations",
                                       "common_keyframes"]

                    for prop in style_properties:
                        if prop in style_for_track:
                            # 深拷贝整个属性（保留模板的完整结构）
                            new_segment.raw_data[prop] = deepcopy(style_for_track[prop])

                    # volume和speed也可能在segment_styles中
                    for prop in ["volume", "last_nonzero_volume", "speed"]:
                        if prop in style_for_track and prop not in item_data:
                            # 只在item_data没有指定时应用（这些值item_data优先级更高）
                            new_segment.raw_data[prop] = style_for_track[prop]

            # 步骤2: 应用item_data的基础数据（不包括animations）
            RuleTestService._apply_item_data_to_segment(new_segment, item_data)
            # 传入 style_for_track 以支持从 segment_styles 获取 path 等预设值
            RuleTestService._apply_item_data_to_material(script, new_material_id, item_data, style_for_track)

            # 步骤3: 最后单独处理animations（确保覆盖所有预设）
            animations = item_data.get("animations")
            if animations and isinstance(animations, dict):
                RuleTestService._apply_animations_to_segment(new_segment, animations, script)

            # 添加到轨道
            track.segments.append(new_segment)
            created_segments += 1

        # 7. 更新草稿总时长
        max_end = 0
        for track in script.imported_tracks:
            segments = getattr(track, "segments", None)
            if not segments:
                continue
            for segment in segments:
                end_point = segment.target_timerange.start + segment.target_timerange.duration
                max_end = max(max_end, end_point)
        script.duration = max(script.duration, max_end)

        # 输出最终统计
        print(f"[DEBUG] ===== Merge完成统计 =====")
        print(f"[DEBUG] 创建了 {len(track_map)} 个新轨道")
        print(f"[DEBUG] 创建了 {created_segments} 个segments")
        print(f"[DEBUG] 当前materials categories: {list(script.imported_materials.keys())}")
        for cat, mats in script.imported_materials.items():
            print(f"[DEBUG]   - {cat}: {len(mats)}个material")
        total_segments = sum(len(getattr(track, "segments", [])) for track in script.imported_tracks)
        print(f"[DEBUG] 所有轨道的segments总数: {total_segments}")
        print(f"[DEBUG] =============================")

    @staticmethod
    def _clone_segment_with_materials(
        script: draft.ScriptFile,
        template_segment: ImportedSegment,
        material_obj: MaterialPayload,
        original_materials: Dict[str, List[Dict[str, Any]]],
        track_type: str = "video",
    ) -> tuple[ImportedSegment, str]:
        """
        克隆segment及其所有相关materials，分配新的唯一ID
        返回: (新segment, 新material_id)
        """
        # 生成ID映射表
        old_to_new_ids: Dict[str, str] = {}

        def get_new_id(old_id: Optional[str]) -> str:
            if not old_id:
                return str(uuid.uuid4()).upper()  # 标准UUID格式，带连字符，大写
            old_id_str = str(old_id)
            if old_id_str not in old_to_new_ids:
                old_to_new_ids[old_id_str] = str(uuid.uuid4()).upper()
            return old_to_new_ids[old_id_str]

        # 1. 克隆segment的raw_data
        new_segment_raw = deepcopy(template_segment.raw_data)

        # 2. 分配新的segment ID
        old_segment_id = template_segment.raw_data.get("id")
        new_segment_id = get_new_id(old_segment_id)
        new_segment_raw["id"] = new_segment_id

        # 3. 根据segment的material_id查找对应的material模板
        old_material_id = template_segment.material_id
        new_material_id = get_new_id(str(old_material_id))

        # 查找原始material（通过material_id精确匹配）
        old_material = RuleTestService._find_material_in_dict(original_materials, str(old_material_id))

        if old_material:
            old_path = old_material["data"].get("path", "N/A")
            print(f"[DEBUG] 找到material_id={old_material_id}, path={old_path[:80] if old_path != 'N/A' else 'N/A'}...")
        else:
            # 如果找不到对应的material_id,作为后备方案,使用对应类型的第一个material
            # 注意:effect轨道可能包含video_effects或effects两种category的素材
            material_category_map = {
                "audio": "audios",
                "video": "videos",
                "text": "stickers",
                "video_effect": "video_effects",
                "sticker": "stickers",
                "effect": "video_effects",  # effect轨道优先使用video_effects
            }
            target_category = material_category_map.get(track_type, "videos")

            if target_category in original_materials and original_materials[target_category]:
                old_material = {"category": target_category, "data": original_materials[target_category][0]}
                print(f"[WARNING] 未找到material_id={old_material_id},使用{target_category}的第一个material作为后备")
        if old_material:
            new_material = deepcopy(old_material["data"])

            # 先更新material中的嵌套ID引用（会重新映射所有ID）
            RuleTestService._remap_material_ids(new_material, old_to_new_ids, get_new_id)

            # 然后强制设置顶层ID为我们指定的新ID（覆盖_remap_material_ids的结果）
            new_material["id"] = new_material_id

            # 将新material添加到对应的category
            category = old_material["category"]
            if category:
                material_list = script.imported_materials.setdefault(category, [])
                material_list.append(new_material)
        else:
            print(f"[WARNING] 未找到template segment的material: material_id={old_material_id}")

        # 4. 更新segment中的material_id引用
        new_segment_raw["material_id"] = new_material_id

        # 5. 处理extra_material_refs（额外的素材引用，如特效、滤镜等）
        extra_refs = new_segment_raw.get("extra_material_refs")
        if isinstance(extra_refs, list):
            new_extra_refs = []
            for old_ref_id in extra_refs:
                if old_ref_id:
                    # 为这个ID生成新的映射（即使找不到material也要保持映射关系）
                    new_ref_id = get_new_id(str(old_ref_id))

                    # 克隆额外素材
                    old_extra_material = RuleTestService._find_material_in_dict(original_materials, str(old_ref_id))
                    if old_extra_material:
                        new_extra_material = deepcopy(old_extra_material["data"])

                        # 先更新嵌套ID引用
                        RuleTestService._remap_material_ids(new_extra_material, old_to_new_ids, get_new_id)

                        # 然后强制设置顶层ID
                        new_extra_material["id"] = new_ref_id

                        # 添加到materials
                        extra_category = old_extra_material["category"]
                        if extra_category:
                            script.imported_materials.setdefault(extra_category, []).append(new_extra_material)

                    # 无论是否找到material，都使用新ID（保持引用关系）
                    new_extra_refs.append(new_ref_id)
                else:
                    new_extra_refs.append(old_ref_id)
            new_segment_raw["extra_material_refs"] = new_extra_refs

        # 6. 创建新的segment实例
        new_segment = type(template_segment)(new_segment_raw)
        new_segment.material_id = new_material_id

        return new_segment, new_material_id

    @staticmethod
    def _find_material_in_dict(
        materials_dict: Dict[str, List[Dict[str, Any]]], material_id: str
    ) -> Optional[Dict[str, Any]]:
        """在materials字典中查找material，返回包含category和data的字典"""
        for category, material_list in materials_dict.items():
            for material in material_list:
                entry_id = material.get("id") or material.get("material_id")
                if entry_id and str(entry_id) == material_id:
                    return {"category": category, "data": material}
        return None

    @staticmethod
    def _remap_material_ids(
        material_data: Dict[str, Any], old_to_new_ids: Dict[str, str], get_new_id: Callable[[Optional[str]], str]
    ) -> None:
        """
        递归重映射material数据中的所有ID引用
        处理嵌套的ID引用（如特效参数中的ID）
        """
        # 处理常见的ID字段
        id_fields = ["id", "material_id", "effect_id", "filter_id", "transition_id", "animation_id"]
        for field in id_fields:
            if field in material_data and material_data[field]:
                old_id = str(material_data[field])
                material_data[field] = get_new_id(old_id)

        # 递归处理嵌套结构
        for key, value in list(material_data.items()):
            if isinstance(value, dict):
                RuleTestService._remap_material_ids(value, old_to_new_ids, get_new_id)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        RuleTestService._remap_material_ids(item, old_to_new_ids, get_new_id)

    @staticmethod
    def _extract_duration_from_material(material: MaterialPayload) -> Optional[float]:
        extra = getattr(material, "model_extra", None) or {}
        duration_seconds = extra.get("duration_seconds")
        if duration_seconds is not None:
            return float(duration_seconds)
        raw_duration = extra.get("duration")
        if raw_duration is not None:
            raw_value = float(raw_duration)
            return raw_value / 1_000_000 if abs(raw_value) > 10_000 else raw_value
        return None

    @staticmethod
    def _probe_media_duration(path: str, material_type: str) -> Optional[float]:
        try:
            if material_type in RuleTestService.AUDIO_TYPES:
                media = draft.AudioMaterial(path)
            else:
                media = draft.VideoMaterial(path)
            return max(float(media.duration) / 1_000_000, 0.0)
        except FileNotFoundError:
            return None
        except Exception:
            return None
