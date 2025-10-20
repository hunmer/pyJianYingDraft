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
from typing import Any, Dict, List, Optional, Set

import pyJianYingDraft as draft
from pyJianYingDraft.template_mode import ImportedSegment

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

        folder = draft.DraftFolder(draft_root)
        script = folder.create_draft(
            draft_name,
            RuleTestService.DEFAULT_WIDTH,
            RuleTestService.DEFAULT_HEIGHT,
            fps=RuleTestService.DEFAULT_FPS,
            allow_replace=True,
        )

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
        tracks = RuleTestService._prepare_raw_tracks(raw_segments)

        script.add_raw_segments(tracks, materials, ensure_unique_material_ids=True)

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
            return
        material_entry = RuleTestService._find_imported_material(script, str(material_id))
        if not material_entry:
            return

        path_value = item_data.get("path")
        if path_value:
            material_entry["path"] = path_value
            if "media_path" in material_entry:
                material_entry["media_path"] = path_value
            if "material_url" in material_entry:
                material_entry["material_url"] = path_value

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
        if hasattr(segment, "source_timerange") and getattr(segment, "source_timerange") is not None:
            raw_source = segment.raw_data.setdefault("source_timerange", {})
            source_range = segment.source_timerange  # type: ignore[attr-defined]
            if source_start_us is not None:
                source_range.start = source_start_us
                raw_source["start"] = source_start_us
            if source_duration_us is not None:
                source_range.duration = source_duration_us
                raw_source["duration"] = source_duration_us

    @staticmethod
    def _merge_raw_segments_with_test_data(script: draft.ScriptFile, plans: List[Dict[str, Any]]) -> None:
        if not plans:
            return

        track_segments: Dict[str, List[ImportedSegment]] = {}
        track_objects: Dict[str, Any] = {}
        for track in script.imported_tracks:
            segments = getattr(track, "segments", None)
            track_id_value = getattr(track, "track_id", None)
            if track_id_value is None or not segments:
                continue
            track_key = str(track_id_value)
            track_objects[track_key] = track
            track_segments[track_key] = segments  # type: ignore[assignment]

        material_segments: Dict[str, List[ImportedSegment]] = defaultdict(list)
        for segments in track_segments.values():
            for segment in segments:
                material_id = getattr(segment, "material_id", None)
                if material_id is not None:
                    material_segments[str(material_id)].append(segment)

        track_indices: Dict[str, int] = defaultdict(int)
        material_indices: Dict[str, int] = defaultdict(int)

        for plan in plans:
            track_id = str(plan["track_id"])
            material_obj = plan["material"]
            material_id_value = getattr(material_obj, "id", None)
            if material_id_value is None:
                continue
            material_key = str(material_id_value)
            item_data = plan["item"]

            selected_segment: Optional[ImportedSegment] = None

            segments_for_track = track_segments.get(track_id)
            if segments_for_track:
                idx = track_indices[track_id]
                if idx < len(segments_for_track):
                    selected_segment = segments_for_track[idx]
                    track_indices[track_id] += 1

            if selected_segment is None:
                segments_for_material = material_segments.get(material_key)
                if segments_for_material:
                    idx = material_indices[material_key]
                    if idx < len(segments_for_material):
                        selected_segment = segments_for_material[idx]
                        material_indices[material_key] += 1

            if selected_segment is None:
                track_obj = track_objects.get(track_id)
                segments_list = getattr(track_obj, "segments", None) if track_obj else None
                if track_obj and segments_list:
                    template_segment = segments_list[-1]
                    new_raw = deepcopy(template_segment.raw_data)
                    new_raw["id"] = uuid.uuid4().hex
                    target_json = new_raw.setdefault("target_timerange", {})
                    target_json.setdefault("start", template_segment.target_timerange.start)
                    target_json.setdefault("duration", template_segment.target_timerange.duration)
                    new_segment = type(template_segment)(new_raw)  # type: ignore[call-arg]
                    new_segment.material_id = material_key
                    new_segment.raw_data["material_id"] = material_key
                    segments_list.append(new_segment)
                    track_segments[track_id] = segments_list
                    material_segments[material_key].append(new_segment)
                    selected_segment = new_segment
                    track_indices[track_id] = len(segments_list)
                    material_indices[material_key] = len(material_segments[material_key])

            if selected_segment is not None:
                RuleTestService._apply_item_data_to_segment(selected_segment, item_data)

            RuleTestService._apply_item_data_to_material(script, material_key, item_data)

        max_end = 0
        for track in script.imported_tracks:
            segments = getattr(track, "segments", None)
            if not segments:
                continue
            for segment in segments:
                end_point = segment.target_timerange.start + segment.target_timerange.duration
                max_end = max(max_end, end_point)
        script.duration = max(script.duration, max_end)

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
