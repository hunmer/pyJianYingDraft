"""
规则组测试执行服务
"""

import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import pyJianYingDraft as draft

from app.config import get_config
from app.models.rule_models import (
    MaterialPayload,
    RuleGroupTestRequest,
    RuleGroupTestResponse,
    TestDataModel,
)


class RuleTestService:
    """执行规则测试并生成剪映草稿"""

    DEFAULT_WIDTH = 1920
    DEFAULT_HEIGHT = 1080
    DEFAULT_FPS = 30

    AUDIO_TYPES = {"audio", "music", "sound"}
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

        duration_value = RuleTestService._resolve_duration_seconds(material, item_data, material_type, path)
        timerange = draft.trange(f"{start}s", f"{duration_value}s")

        extra = getattr(material, "model_extra", None) or {}
        if material_type in RuleTestService.AUDIO_TYPES:
            if not path:
                raise ValueError(f"音频素材 {material.id} 缺少文件路径")
            volume = float(item_data.get("volume", 1.0))
            return draft.AudioSegment(path, timerange, volume=volume)

        if material_type in RuleTestService.TEXT_TYPES:
            text_content = item_data.get("text")
            if not text_content:
                raise ValueError(f"文本素材 {material.id} 缺少文本内容")
            clip = RuleTestService._build_clip_settings(item_data)
            return draft.TextSegment(text_content, timerange, clip_settings=clip)

        if not path:
            raise ValueError(f"视频素材 {material.id} 缺少文件路径")
        clip = RuleTestService._build_clip_settings(item_data)
        volume = float(item_data.get("volume", 1.0))
        return draft.VideoSegment(path, timerange, volume=volume, clip_settings=clip)

    @staticmethod
    def _build_clip_settings(item_data: Dict[str, Any]) -> Optional[draft.ClipSettings]:
        scale = item_data.get("scale")
        x = item_data.get("x")
        y = item_data.get("y")
        if scale is None and x is None and y is None:
            return None
        scale_value = float(scale) if scale is not None else 1.0
        return draft.ClipSettings(
            scale_x=scale_value,
            scale_y=scale_value,
            transform_x=float(x) if x is not None else 0.0,
            transform_y=float(y) if y is not None else 0.0,
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
