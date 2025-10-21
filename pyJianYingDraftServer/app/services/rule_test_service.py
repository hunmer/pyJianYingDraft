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
)


class RuleTestService:
    """执行规则测试并生成剪映草稿"""

    DEFAULT_WIDTH = 1920
    DEFAULT_HEIGHT = 1080
    DEFAULT_FPS = 30

    AUDIO_TYPES = {"audio", "music", "sound", "extract_music"}
    TEXT_TYPES = {"text", "subtitle"}

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
        else:
            # 回退到旧字段（兼容性）
            canvas_width = payload.canvas_width or canvas_width
            canvas_height = payload.canvas_height or canvas_height
            fps = payload.fps or fps

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
        draft_root = get_config("PYJY_TEST_DRAFT_ROOT") or os.getenv("PYJY_TEST_DRAFT_ROOT")
        if not draft_root:
            raise ValueError("未在 config.json 或环境变量 PYJY_TEST_DRAFT_ROOT 中配置草稿保存目录")
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
        if material_type in RuleTestService.AUDIO_TYPES:
            return "audio"
        if material_type in RuleTestService.TEXT_TYPES:
            return "text"
        if material_type in {"filter", "effect"}:
            return "effect"
        if material_type in {"sticker"}:
            return "sticker"
        print("unknown material type:", material_type)
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
        if not payload.draft_config:
            return

        # 获取草稿的原始JSON数据（ScriptFile对象应该有导出方法）
        # 我们需要在保存前修改这些字段

        # 应用 canvas_config（画布配置）
        if payload.draft_config.canvas_config:
            # canvas_config 对应草稿JSON的 canvas_config 字段
            if not hasattr(script, 'canvas_config'):
                script.canvas_config = {}
            for key, value in payload.draft_config.canvas_config.items():
                script.canvas_config[key] = value
            print(f"[DEBUG] 应用canvas_config: {payload.draft_config.canvas_config}")

        # 应用 config（通用配置）
        if payload.draft_config.config:
            # config 对应草稿JSON的 config 字段
            if not hasattr(script, 'config'):
                script.config = {}
            for key, value in payload.draft_config.config.items():
                script.config[key] = value
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

        print(f"[DEBUG] _build_raw_draft: raw_segments数量 = {len(raw_segments)}")

        materials = RuleTestService._prepare_raw_materials(payload.raw_materials or [], raw_segments)
        print(f"[DEBUG] _build_raw_draft: materials categories = {list(materials.keys())}")
        for cat, mats in materials.items():
            print(f"[DEBUG]   - {cat}: {len(mats)}个material")

        tracks = RuleTestService._prepare_raw_tracks(raw_segments)
        print(f"[DEBUG] _build_raw_draft: 准备了{len(tracks)}个tracks")
        for track in tracks:
            track_type = track.get("type")
            segments_count = len(track.get("segments", []))
            print(f"[DEBUG]   - Track type={track_type}, segments数量={segments_count}")

        script.add_raw_segments(tracks, materials, ensure_unique_material_ids=True)

        print(f"[DEBUG] _build_raw_draft完成: script.imported_tracks数量 = {len(script.imported_tracks)}")
        for track in script.imported_tracks:
            track_type = getattr(track, "type", "?")
            segments = getattr(track, "segments", None)
            segments_count = len(segments) if segments else 0
            print(f"[DEBUG]   - ImportedTrack type={track_type}, segments数量={segments_count}")

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
    def _prepare_raw_tracks(raw_segments: List[RawSegmentPayload]) -> List[Dict[str, Any]]:
        track_map: Dict[str, Dict[str, Any]] = {}
        for raw in raw_segments:
            track_id = raw.track_id
            track_type = raw.track_type
            if not track_id:
                raise ValueError("原始片段缺少 track_id")
            if not track_type:
                raise ValueError("原始片段缺少 track_type")

            track = track_map.get(track_id)
            if track is None:
                track = {
                    "id": track_id,
                    "type": track_type,
                    "name": raw.track_name or track_type,
                    "is_default_name": raw.track_name is None,
                    "segments": [],
                    "attribute": 0,
                    "flag": 0,
                }
                track_map[track_id] = track
            else:
                if track["type"] != track_type:
                    raise ValueError(f"轨道 {track_id} 的 track_type 不一致")

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
        script: draft.ScriptFile, material_id: Optional[str], item_data: Dict[str, Any]
    ) -> None:
        if not material_id:
            print(f"[DEBUG] _apply_item_data_to_material: material_id为空，跳过")
            return
        material_entry = RuleTestService._find_imported_material(script, str(material_id))
        if not material_entry:
            print(f"[WARNING] 未找到material: material_id={material_id}")
            print(f"[DEBUG] 当前script.imported_materials categories: {list(script.imported_materials.keys())}")
            for cat, mats in script.imported_materials.items():
                mat_ids = [m.get('id') or m.get('material_id') for m in mats[:3]]
                print(f"[DEBUG] {cat}前3个: {mat_ids}")
            return

        print(f"[DEBUG] 找到material {material_id}，应用item_data")

        path_value = item_data.get("path")
        if path_value:
            material_entry["path"] = path_value
            if "media_path" in material_entry:
                material_entry["media_path"] = path_value
            if "material_url" in material_entry:
                material_entry["material_url"] = path_value
            print(f"[DEBUG]   - 更新path: {path_value}")

        duration_us = RuleTestService._seconds_to_microseconds(item_data.get("duration"))
        if duration_us is not None:
            material_entry["duration"] = duration_us
            material_entry["duration_us"] = duration_us
            material_entry["duration_seconds"] = duration_us / 1_000_000
            print(f"[DEBUG]   - 更新duration: {duration_us}us ({duration_us/1000000}s)")

        if "name" in item_data and item_data["name"]:
            material_entry["name"] = item_data["name"]
            print(f"[DEBUG]   - 更新name: {item_data['name']}")

        if "text" in item_data and item_data["text"] is not None:
            RuleTestService._update_text_material(material_entry, str(item_data["text"]))
            print(f"[DEBUG]   - 更新text: {item_data['text']}")

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
                print(f"[DEBUG]   - 自动修正source_duration: {correct_source_duration}us (target={target_duration}, speed={speed})")

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
                    print(f"[DEBUG]   - 更新clip.transform.x: {x}")
                if y is not None:
                    transform["y"] = float(y)
                    print(f"[DEBUG]   - 更新clip.transform.y: {y}")

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
                print(f"[DEBUG]   - 更新clip.scale: {scale_value}")

        # 处理animations字段（组合动画）
        animations = item_data.get("animations")
        if animations and isinstance(animations, dict):
            RuleTestService._apply_animations_to_segment(segment, animations)

    @staticmethod
    def _apply_animations_to_segment(segment: ImportedSegment, animations: Dict[str, Any]) -> None:
        """
        根据animations配置为segment添加或修改组合动画

        animations格式:
        - {"name": "动画名称", "duration": 持续时长(秒)} - 创建新动画并替换
        - {"name": "动画名称"} - 创建新动画,使用片段时长作为duration
        - {"duration": 持续时长(秒)} - 仅修改现有动画的duration
        """
        animation_name = animations.get("name")
        animation_duration = animations.get("duration")

        # 获取现有的material_animations
        material_animations = segment.raw_data.get("material_animations", [])
        if not isinstance(material_animations, list):
            material_animations = []

        try:
            # 情况1: 只指定duration，修改现有动画的duration
            if animation_duration is not None and not animation_name:
                if not material_animations:
                    print("[WARNING] segment没有现有动画，无法仅修改duration")
                    return

                # 将duration从秒转换为微秒
                duration_us = RuleTestService._seconds_to_microseconds(animation_duration)
                if duration_us is None or duration_us <= 0:
                    print(f"[WARNING] 无效的duration: {animation_duration}")
                    return

                # 修改所有现有动画的duration
                for anim_group in material_animations:
                    if isinstance(anim_group, dict) and "animations" in anim_group:
                        animations_list = anim_group.get("animations", [])
                        if isinstance(animations_list, list):
                            for anim in animations_list:
                                if isinstance(anim, dict):
                                    anim["duration"] = duration_us
                                    print(f"[DEBUG]   - 修改动画duration: {duration_us}us ({animation_duration}s)")

                segment.raw_data["material_animations"] = material_animations
                return

            # 情况2: 指定了name，创建新动画（有或没有duration）
            if animation_name:
                # 从GroupAnimationType枚举中查找动画
                try:
                    animation_type = GroupAnimationType.from_name(animation_name)
                except ValueError:
                    print(f"[WARNING] 未找到组合动画: {animation_name}")
                    print(f"[DEBUG] 可用的组合动画: {[e.value.title for e in GroupAnimationType]}")
                    return

                # 确定动画duration
                if animation_duration is not None:
                    # 使用指定的duration
                    duration_us = RuleTestService._seconds_to_microseconds(animation_duration)
                    if duration_us is None or duration_us <= 0:
                        print(f"[WARNING] 无效的duration: {animation_duration}")
                        return
                else:
                    # 使用片段的target_timerange.duration作为动画duration
                    duration_us = segment.target_timerange.duration
                    print(f"[DEBUG]   - 未指定duration，使用片段时长: {duration_us}us ({duration_us/1000000}s)")

                # 创建SegmentAnimations对象
                segment_animations = SegmentAnimations()

                # 创建VideoAnimation（组合动画从片段开始位置0开始）
                video_animation = VideoAnimation(
                    animation_type=animation_type,
                    start=0,
                    duration=duration_us
                )

                # 添加动画到SegmentAnimations
                segment_animations.add_animation(video_animation)

                # 替换所有现有动画
                material_animations = [segment_animations.export_json()]
                segment.raw_data["material_animations"] = material_animations

                duration_s = duration_us / 1_000_000
                print(f"[DEBUG]   - 创建组合动画: name={animation_name}, duration={duration_us}us ({duration_s}s)")
                return

            # 情况3: 既没有name也没有duration
            print("[WARNING] animations字段必须至少包含name或duration")

        except Exception as e:
            print(f"[ERROR] 处理animations失败: {e}")
            import traceback
            traceback.print_exc()

    @staticmethod
    def _merge_raw_segments_with_test_data(script: draft.ScriptFile, plans: List[Dict[str, Any]]) -> None:
        """
        根据testData生成新的segments和materials，清除原始样本数据
        每个plan会创建独立的segment和material副本，确保ID唯一性
        """
        if not plans:
            print("[DEBUG] plans为空，跳过merge操作")
            return

        print(f"[DEBUG] 开始merge操作，plans数量: {len(plans)}")

        # 1. 收集各类型segment结构模板（按轨道类型分类）
        segment_templates: Dict[str, ImportedSegment] = {}
        for track in script.imported_tracks:
            # ImportedTrack使用track_type属性，不是type
            track_type_enum = getattr(track, "track_type", None)
            if not track_type_enum:
                continue
            # 转换为字符串（如"video", "audio", "text"）
            track_type = track_type_enum.name if hasattr(track_type_enum, "name") else str(track_type_enum)
            segments = getattr(track, "segments", None)
            if segments and len(segments) > 0 and track_type not in segment_templates:
                segment_templates[track_type] = segments[0]
                print(f"[DEBUG] 找到{track_type}类型segment模板: track_id={getattr(track, 'track_id', '?')}")

        if not segment_templates:
            print("[ERROR] 未找到任何segment模板")
            return

        print(f"[DEBUG] 收集到的模板类型: {list(segment_templates.keys())}")

        # 2. 保存原始materials的深拷贝（用于克隆）
        original_materials = deepcopy(script.imported_materials)
        print(f"[DEBUG] 保存原始materials: categories={list(original_materials.keys())}")
        for cat, mats in original_materials.items():
            print(f"[DEBUG]   - {cat}: {len(mats)}个material")

        # 3. 清空所有旧轨道
        old_tracks_count = len(script.imported_tracks)
        script.imported_tracks.clear()
        print(f"[DEBUG] 清空所有旧轨道: 清除了{old_tracks_count}个轨道")

        # 4. 清空所有materials（样本数据不应写入）
        old_materials_count = sum(len(mats) for mats in script.imported_materials.values())
        script.imported_materials.clear()
        print(f"[DEBUG] 清空materials: 清除了{old_materials_count}个material")

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
        print(f"[DEBUG] track_map包含的轨道: {list(track_map.keys())}")
        created_segments = 0
        for i, plan in enumerate(plans):
            track_id = str(plan["track_id"])
            material_obj = plan["material"]
            item_data = plan["item"]

            print(f"[DEBUG] 处理plan {i+1}/{len(plans)}: track_id={track_id} (type={type(track_id)}), material_id={material_obj.id}")

            # 获取对应轨道
            track = track_map.get(track_id)
            if track is None:  # 使用 is None 而不是 not track
                print(f"[WARNING] 未找到轨道: track_id={track_id}, track_map.keys()={list(track_map.keys())}")
                continue

            # 根据轨道类型选择对应的segment模板
            track_type = track_type_hints.get(track_id, "video")
            segment_template = segment_templates.get(track_type)
            if segment_template is None:
                # 如果没有对应类型的模板，尝试使用video模板或第一个可用模板
                segment_template = segment_templates.get("video") or next(iter(segment_templates.values()))
                print(f"[WARNING] 轨道{track_id}类型{track_type}没有对应模板，使用fallback模板")

            # 克隆segment和materials，分配新ID（传递轨道类型以选择正确的material模板）
            new_segment, new_material_id = RuleTestService._clone_segment_with_materials(
                script, segment_template, material_obj, original_materials, track_type=track_type
            )

            # 应用segment_styles（从material获取样式并应用到segment）
            # 先应用完整的segment_styles，然后item_data会覆盖指定的字段
            segment_styles = getattr(material_obj, "segment_styles_map", None)
            if segment_styles and isinstance(segment_styles, dict):
                # 尝试获取该track_id的专属样式，或使用__default__样式
                style_for_track = segment_styles.get(track_id) or segment_styles.get("__default__")
                if style_for_track and isinstance(style_for_track, dict):
                    print(f"[DEBUG] 应用segment_styles到segment: track_id={track_id}")
                    # 应用所有样式属性到segment（item_data稍后会覆盖指定的字段）
                    style_properties = ["clip", "hdr_settings", "uniform_scale", "enable_adjust",
                                       "enable_color_correct", "enable_color_correct_adjust",
                                       "enable_lut", "intensity", "reverse", "material_animations",
                                       "common_keyframes"]
                    for prop in style_properties:
                        if prop in style_for_track:
                            # 深拷贝整个属性（保留模板的完整结构）
                            new_segment.raw_data[prop] = deepcopy(style_for_track[prop])
                            print(f"[DEBUG]   - 应用{prop}从segment_styles")

                    # volume和speed也可能在segment_styles中
                    for prop in ["volume", "last_nonzero_volume", "speed"]:
                        if prop in style_for_track and prop not in item_data:
                            # 只在item_data没有指定时应用（这些值item_data优先级更高）
                            new_segment.raw_data[prop] = style_for_track[prop]
                            print(f"[DEBUG]   - 应用{prop}={style_for_track[prop]}从segment_styles")

                    # 注意：extra_material_refs不从segment_styles应用
                    # 因为它们的ID需要在克隆时正确映射，已经在_clone_segment_with_materials中处理了

            # 应用item_data的数据到新segment
            RuleTestService._apply_item_data_to_segment(new_segment, item_data)
            RuleTestService._apply_item_data_to_material(script, new_material_id, item_data)

            # 添加到轨道
            track.segments.append(new_segment)
            created_segments += 1
            print(f"[DEBUG] 添加segment到轨道: track_id={track_id}, 当前轨道segments数量={len(track.segments)}")

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

        # 3. 根据轨道类型选择正确的material模板
        material_category_map = {
            "audio": "audios",
            "video": "videos",
            "text": "texts",
            "sticker": "stickers",
            "effect": "effects",
        }
        target_category = material_category_map.get(track_type, "videos")

        # 优先从目标类型中选择material模板
        old_material_id = template_segment.material_id
        new_material_id = get_new_id(str(old_material_id))

        # 查找原始material（优先使用对应类型的material）
        old_material = None
        if target_category in original_materials and original_materials[target_category]:
            # 使用对应类型的第一个material作为模板
            old_material = {"category": target_category, "data": original_materials[target_category][0]}
            print(f"[DEBUG] 使用{target_category}类型的material模板")
        else:
            # 如果没有对应类型，尝试使用segment原本的material
            old_material = RuleTestService._find_material_in_dict(original_materials, str(old_material_id))
            if old_material:
                print(f"[DEBUG] 使用segment原有material: category={old_material['category']}")
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
                print(f"[DEBUG] 克隆主material: category={category}, old_id={old_material_id}, new_id={new_material_id}")
        else:
            print(f"[WARNING] 未找到template segment的material: material_id={old_material_id}")
            print(f"[DEBUG] original_materials categories: {list(original_materials.keys())}")
            # 打印前几个material的ID供参考
            for cat, mats in original_materials.items():
                mat_ids = [m.get('id') or m.get('material_id') for m in mats[:3]]
                print(f"[DEBUG] {cat}: {mat_ids}...")

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
                            print(f"[DEBUG] 克隆额外material: category={extra_category}, old_id={old_ref_id}, new_id={new_ref_id}")
                    else:
                        print(f"[WARNING] 未找到额外material: ref_id={old_ref_id}, 但已生成ID映射: {old_ref_id} -> {new_ref_id}")

                    # 无论是否找到material，都使用新ID（保持引用关系）
                    new_extra_refs.append(new_ref_id)
                else:
                    new_extra_refs.append(old_ref_id)
            new_segment_raw["extra_material_refs"] = new_extra_refs

        # 6. 创建新的segment实例
        new_segment = type(template_segment)(new_segment_raw)
        new_segment.material_id = new_material_id

        print(f"[DEBUG] 创建新segment: old_seg_id={old_segment_id}, new_seg_id={new_segment_id}, material_id={new_material_id}")

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
