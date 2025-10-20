"""
规则组测试执行服务
"""

import os
import re
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import pyJianYingDraft as draft

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

        if payload.use_raw_segments:
            RuleTestService._build_raw_draft(script, payload)
        else:
            rule_lookup = {rule.type: rule for rule in rule_group.rules}
            material_lookup = {material.id: material for material in materials}

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

            for plan in RuleTestService._build_segment_plans(test_data, rule_lookup, material_lookup):
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

        def add_material(category: Optional[str], material_id: Optional[str], data: Optional[Dict[str, Any]]) -> None:
            if not category or not material_id or data is None:
                return
            bucket = grouped.setdefault(category, {})
            if material_id in bucket:
                return
            payload = deepcopy(data)
            payload.setdefault("id", material_id)
            bucket[material_id] = payload

        for raw in raw_materials:
            if not raw.category:
                raise ValueError("raw_materials 条目缺少 category")
            material_id = raw.id or raw.data.get("id")
            if not material_id:
                raise ValueError("raw_materials 条目缺少 id")
            payload = deepcopy(raw.data)
            payload.setdefault("id", material_id)
            add_material(raw.category, material_id, payload)

        for segment in raw_segments:
            material_payload = segment.material
            if material_payload:
                if not isinstance(material_payload, dict):
                    raise TypeError("raw segment material 数据必须是字典")
                category = material_payload.get("category") or segment.material_category
                material_id = material_payload.get("id") or segment.material_id
                add_material(category, material_id, material_payload)

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
