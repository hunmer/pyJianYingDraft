# 模块职责

## 容器与主体

- `draft_folder.py`：`DraftFolder`，草稿文件夹级别操作（创建/加载/复制草稿）。
- `script_file.py`：`ScriptFile`，草稿文件主类，管理整体结构与导出逻辑。

## 轨道与片段

- `track.py`：`TrackType`（video/audio/text/effect/filter）+ `Track`。
- `segment.py`：`Segment` 片段基类，定义 `time_range`、`material_id` 等共通属性。
- `video_segment.py`：视频/贴纸片段，关键帧、蒙版、动画、特效、滤镜、转场、背景填充；`VideoSegment`、`StickerSegment`、`ClipSettings`。
- `audio_segment.py`：音频片段，音量关键帧、淡入淡出、音效；`AudioSegment`。
- `text_segment.py`：文本片段，字体样式、气泡/花字、描边/阴影/背景；`TextSegment`、`TextStyle`、`TextBorder`、`TextBackground`、`TextShadow`。
- `effect_segment.py`：独立轨道上的特效/滤镜片段；`EffectSegment`、`FilterSegment`。

## 素材

- `local_materials.py`：`VideoMaterial`、`AudioMaterial`、`CropSettings`，含媒体信息提取（依赖 pymediainfo/imageio）。

## 元数据（`metadata/`）

剪映内置资源枚举，成员中文命名，注释标注可调参数顺序：
- `font_meta.py`（FontType）、`mask_meta.py`（MaskType）、`filter_meta.py`（FilterType）、`transition_meta.py`（TransitionType）。
- `video_intro.py`/`video_outro.py`/`video_group_animation.py`（IntroType/OutroType/GroupAnimationType）。
- `text_intro.py`/`text_outro.py`/`text_loop.py`（TextIntro/TextOutro/TextLoopAnim）。
- `video_scene_effect.py`/`video_character_effect.py`/`audio_scene_effect.py`/`effect_meta.py`。
- `speech_to_song.py`、`tone_effect.py`。

## 工具与支撑

- `time_util.py`：`tim`、`trange`、`Timerange`、`srt_tstamp`、`SEC`。
- `keyframe.py`：`KeyframeProperty`，支持 alpha/transform/scale/volume 等。
- `animation.py`：入场/出场/循环动画元数据管理。
- `util.py`：JSON 序列化、属性赋值等通用工具。
- `exceptions.py`：`MaterialNotFound`、`TrackNotFound`、`ExtensionFailed` 等自定义异常。

## 模板模式与自动导出

- `template_mode.py`：`ImportedTrack`、`ImportedMediaTrack`、`ImportedTextTrack`、`ShrinkMode`、`ExtendMode`。
- `jianying_controller.py`（Windows only）：`JianyingController`、`ExportResolution`、`ExportFramerate`，UI 自动化导出。
