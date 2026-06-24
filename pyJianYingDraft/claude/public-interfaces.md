# 对外接口（SDK 导出）

来源：`__init__.py` 的 `__all__`（去重整理）。

## 容器

- `DraftFolder`、`ScriptFile`

## 片段

- `VideoSegment`、`AudioSegment`、`TextSegment`、`StickerSegment`、`EffectSegment`、`FilterSegment`
- 配套：`ClipSettings`

## 素材

- `VideoMaterial`、`AudioMaterial`、`CropSettings`

## 时间

- `Timerange`、`tim`、`trange`、`SEC`

## 轨道与关键帧与模板

- `TrackType`
- `KeyframeProperty`
- `ShrinkMode`、`ExtendMode`

## 元数据枚举

- 字体/蒙版/滤镜/转场：`FontType`、`MaskType`、`FilterType`、`TransitionType`
- 视频动画：`IntroType`、`OutroType`、`GroupAnimationType`
- 文本动画：`TextIntro`、`TextOutro`、`TextLoopAnim`
- 特效：`AudioSceneEffectType`、`VideoSceneEffectType`、`VideoCharacterEffectType`

## Windows 专属

- `JianyingController`、`ExportResolution`、`ExportFramerate`

## 向后兼容别名（snake_case，触发 DeprecationWarning）

`Script_file`、`Draft_folder`、`Shrink_mode`、`Extend_mode`、`Track_type`、`Font_type`、`Mask_type`、`Filter_type`、`Transition_type`、`Intro_type`、`Outro_type`、`Group_animation_type`、`Text_intro`、`Text_outro`、`Text_loop_anim`、`Audio_scene_effect_type`、`Video_scene_effect_type`、`Video_character_effect_type`、`Clip_settings`、`Text_style`、`Text_border`、`Text_background`、`Text_segment`、`Audio_segment`、`Video_segment`、`Sticker_segment`、`Effect_segment`、`Filter_segment`、`Video_material`、`Audio_material`、`Crop_settings`、`Keyframe_property`，以及 Windows 下的 `Jianying_controller`、`Export_resolution`、`Export_framerate`。

## 主要链式 API

`DraftFolder.create_draft()` / `duplicate_as_template()` → `ScriptFile.add_track()` → `.add_segment()` → `.dump()` / `.save()`。
