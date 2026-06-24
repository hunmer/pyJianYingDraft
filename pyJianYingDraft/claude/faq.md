# 常见问题

## trange 第二参数搞错

- `trange("0s", "5s")` 是从 0s 开始持续 5 秒，不是到 5 秒结束。
- 定位：`time_util.py`。

## 主视频轨道被剪映强制对齐

- 主视频轨道（最底层）片段必须从 `0s` 开始。
- 定位：`track.py`、`script_file.py`。

## 模板模式加载失败

- 剪映 6+ 加密，仅支持 ≤5.9。
- 定位：`template_mode.py`。

## 文本动画顺序错乱

- 同时设置循环 + 出入场，必须先出入场。
- 定位：`text_segment.py`。

## 多同名轨道报错

- 指定 `track_name`。
- 定位：`track.py`。

## 非 Windows 调用 JianyingController 报错

- 仅 Windows 导出，用 `ISWIN` 判断或 `getattr(draft, 'JianyingController', None)`。
- 定位：`__init__.py`、`jianying_controller.py`。

## pymediainfo 报找不到库

- 系统未安装 MediaInfo。Windows 装安装包，Linux 装 `libmediainfo`。
- 定位：`local_materials.py`。

## 关键帧时间对不上

- 关键帧时刻是相对片段头部的偏移，不是绝对时间。
- 定位：`keyframe.py`。

## 特效参数顺序与剪映 UI 不一致

- 以枚举注释为准。
- 定位：`metadata/*.py`。
