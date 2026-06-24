# 文件地图

| 文件 | 职责 |
| --- | --- |
| `__init__.py` | 公开 API 导出 + snake_case 旧别名 + Windows 条件导出 |
| `script_file.py` | `ScriptFile` 草稿主类 |
| `draft_folder.py` | `DraftFolder` 文件夹管理 |
| `track.py` | `TrackType` + `Track` |
| `segment.py` | 片段基类 |
| `video_segment.py` | 视频/贴纸片段、关键帧、蒙版、动画、特效、滤镜、转场、背景填充 |
| `audio_segment.py` | 音频片段、音量关键帧、淡入淡出、音效 |
| `text_segment.py` | 文本片段、字体样式、气泡/花字、描边/阴影/背景 |
| `effect_segment.py` | 独立轨道特效/滤镜片段 |
| `local_materials.py` | 本地素材封装 + 媒体信息提取 |
| `time_util.py` | `tim`/`trange`/`Timerange`/`srt_tstamp`/`SEC` |
| `keyframe.py` | 关键帧系统 |
| `animation.py` | 动画元数据管理 |
| `template_mode.py` | 模板模式专用类 |
| `jianying_controller.py` | UI 自动化导出（Windows only） |
| `util.py` | 通用工具 |
| `exceptions.py` | 自定义异常 |
| `metadata/__init__.py` | 元数据包入口 |
| `metadata/font_meta.py` | FontType |
| `metadata/mask_meta.py` | MaskType |
| `metadata/filter_meta.py` | FilterType |
| `metadata/transition_meta.py` | TransitionType |
| `metadata/video_intro.py` | IntroType |
| `metadata/video_outro.py` | OutroType |
| `metadata/video_group_animation.py` | GroupAnimationType |
| `metadata/text_intro.py` | TextIntro |
| `metadata/text_outro.py` | TextOutro |
| `metadata/text_loop.py` | TextLoopAnim |
| `metadata/video_scene_effect.py` | VideoSceneEffectType |
| `metadata/video_character_effect.py` | VideoCharacterEffectType |
| `metadata/audio_scene_effect.py` | AudioSceneEffectType |
| `metadata/effect_meta.py` | 通用特效元数据 |
| `metadata/speech_to_song.py` | 语音转歌曲 |
| `metadata/tone_effect.py` | 音调特效 |
| `assets/*.json` | 打包资源数据 |
