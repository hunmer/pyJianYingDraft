# 数据模型

## 核心类层次

见 [overview](overview.md) 的类层次图。

## 片段共通字段（`segment.py`）

- `time_range` / `target_timerange`：时间轴位置和长度（微秒）。
- `source_timerange`：从素材截取的范围。
- `material_id`：引用素材 ID（自动注册）。
- `speed`：播放速度。

## 轨道字段（`track.py`）

- `TrackType`：video / audio / text / effect / filter。
- `relative_index`：相对同类型轨道层级。
- `absolute_index`：覆盖 `render_index`。
- `track_name`：多同名轨道时必填。

## 素材（`local_materials.py`）

- `VideoMaterial` / `AudioMaterial`：封装本地文件路径 + 通过 pymediainfo 提取的时长/分辨率/帧率等。
- `CropSettings`：裁剪设置。

## 关键帧（`keyframe.py`）

- `KeyframeProperty` 枚举：alpha / transform / scale / volume 等。
- 关键帧时刻 = 相对片段头部的偏移。

## 动画（`animation.py`）

- 入场（Intro）/ 出场（Outro）/ 循环（GroupAnimation/Loop）三类。
- 文本动画：`TextIntro`/`TextOutro`/`TextLoopAnim`，同时设置时出入场优先。

## 模板模式（`template_mode.py`）

- `ImportedTrack` → `ImportedMediaTrack` / `ImportedTextTrack`。
- `ImportedSegment`：模板导入的片段基类。
- `ShrinkMode` / `ExtendMode`：替换素材后时间轴收缩/扩展策略。

## 元数据枚举

`metadata/` 下 17 个 `.py`，每个枚举：
- 成员中文命名对应剪映 UI。
- 注释标注可调参数及其顺序（与 UI 顺序可能不一致）。
- 提供 `from_name()` 容错查找。

## 导出形态

- `ScriptFile.dump(path)`：创建模式写出 `draft_content.json`。
- `ScriptFile.save()`：模板模式保存（覆盖原草稿）。
- JSON 结构对齐剪映 `draft_content.json` schema（tracks / segments / materials / effects / transitions 等顶层字段）。
