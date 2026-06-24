# 约定详情

## 时间系统

- 内部单位：微秒 `int`。
- `SEC = 1000000`。
- `tim("1.5s")` / `tim("1h3m12s")` → 微秒。
- `trange(start, duration)`：第二个参数是**持续时长**。
- `Timerange` 对象表示一段时间区间。
- `srt_tstamp`：SRT 字幕时间戳转换。
- 关键帧时刻 = 相对片段头部的偏移。

## 命名兼容

- 新代码用 PascalCase：`ScriptFile`、`VideoSegment`、`TrackType` 等。
- snake_case 旧别名（`Script_file`、`Video_segment`、`Track_type` …）触发 `DeprecationWarning`，仅向后兼容。
- 枚举中文成员名直接对应剪映 UI；`from_name()` 忽略大小写/空格/下划线查找。

## 片段构造顺序

`Segment.__init__(material, target_timerange, source_timerange=None, speed=None, ...)`：
- `target_timerange`：时间轴位置和长度。
- `source_timerange`：从素材截取的范围（可选，默认自动计算）。
- `speed`：播放速度（可选，默认 1.0）。

## 特效/滤镜参数

- `params` 顺序以枚举类**注释**为准。
- 取值 0-100，对应剪映 UI 百分比；`None` 用默认值。

## 轨道层级

- `relative_index`：相对同类型轨道，值越大越靠前景。
- `absolute_index`：覆盖 `render_index`，供高级用户。
- 主视频轨道片段必须从 `0s` 开始。

## 模板模式

- 仅支持未加密 `draft_content.json`（剪映 ≤5.9）。
- `ImportedTrack` 不可直接添加新片段。
- 三种替换：
  1. `replace_material_by_name`：按名称，影响所有引用。
  2. `replace_material_by_seg`：按片段，单个，可调时间范围。
  3. `replace_text`：替换文本，保留格式。

## 文本动画

同时设置循环 + 出入场动画时，**先添加出入场动画**。

## 平台条件导出

`__init__.py` 用 `ISWIN = (sys.platform == 'win32')`：
- Windows 额外导出 `JianyingController`、`ExportResolution`、`ExportFramerate` 及旧别名。
- 非 Windows 调用这些会 `ImportError`/`AttributeError`。

## 路径

- 用 `os.path.join()` 跨平台。
- Windows 路径用原始字符串 `r"path\to\file"`。
- 素材路径支持绝对与相对。
