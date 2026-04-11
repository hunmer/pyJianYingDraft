# LLM JSON 字段速查

基于 `pyJianYingDraftServer/app/services/rule_test_service.py` 当前实现整理。

目标：让 LLM 只输出当前服务真正支持的 JSON 字段，不猜测未实现能力。

## 1. `testData.items[].data` 当前可直接使用的字段

```json
{
  "track": "video_main",
  "path": "D:/assets/a.mp4",
  "text": "字幕内容",
  "start": 0,
  "duration": 3,
  "source_start": 0,
  "source_duration": 3,
  "volume": 0.8,
  "speed": 1.0,
  "name": "片段名",
  "x": 0.0,
  "y": 0.0,
  "scale": 1.0,
  "keyframes": {},
  "animations": {},
  "transitions": {}
}
```

说明：

- `start` / `duration` / `source_start` / `source_duration` 单位都是秒。
- `x` / `y` / `scale` 会写入 `clip.transform` / `clip.scale`。
- `text` 仅文本素材需要。
- `path` 可覆盖素材自身路径。
- `volume`、`speed`、`name` 直接写入片段。

## 2. 转场 `transitions`

格式：

```json
{
  "transitions": {
    "name": "3D空间",
    "duration": 1.5
  }
}
```

或：

```json
{
  "transitions": {
    "id": "7049979667406656014",
    "duration": 1.5
  }
}
```

规则：

- 支持 `name` 或 `id(resource_id)` 定位转场。
- `duration` 单位为秒；不传时使用转场默认时长。
- 转场会挂到“前一个片段”上，这是剪映草稿的实际语义。
- 当前可用转场来源：`pyJianYingDraft/metadata/transition_meta.py`
- 当前转场枚举数量：`433`

命名匹配：

- `name` 匹配忽略大小写、空格、下划线。
- 不建议 LLM 自造名称，优先从名称字典中选。

## 3. 动画 `animations`

支持两种写法：

```json
{
  "animations": {
    "type": "video_intro",
    "name": "渐显",
    "duration": 0.5
  }
}
```

```json
{
  "animations": [
    {
      "type": "text_intro",
      "name": "弹入"
    },
    {
      "type": "text_outro",
      "name": "淡出",
      "duration": 0.5
    }
  ]
}
```

规则：

- `animations` 支持单个对象或对象数组。
- 仅传 `duration`：修改已有动画时长，不创建新动画。
- 传 `name`：创建新动画；若未传 `duration`，默认使用片段时长。
- 动画最终写入草稿级 `materials.material_animations`，片段通过 `extra_material_refs` 引用。

当前支持的 `type`：

- `video_group_animation`：视频组合动画，数量 `123`
- `video_intro`：视频入场动画，数量 `155`
- `video_outro`：视频出场动画，数量 `124`
- `text_intro`：文字入场动画，数量 `145`
- `text_loop`：文字循环动画，数量 `93`
- `text_outro`：文字出场动画，数量 `97`

完整枚举来源：

- `pyJianYingDraft/metadata/video_group_animation.py`
- `pyJianYingDraft/metadata/video_intro.py`
- `pyJianYingDraft/metadata/video_outro.py`
- `pyJianYingDraft/metadata/text_intro.py`
- `pyJianYingDraft/metadata/text_loop.py`
- `pyJianYingDraft/metadata/text_outro.py`

命名匹配：

- `name` 匹配忽略大小写、空格、下划线。
- 不建议 LLM 编造动画名，必须从对应名称字典中挑选。

## 4. 关键帧 `keyframes`

格式：

```json
{
  "keyframes": {
    "PositionX": [
      { "time": 0, "value": 0.0 },
      { "time": 1.5, "value": 0.2 }
    ],
    "PositionY": [
      { "time": 0, "value": 0.0 },
      { "time": 1.5, "value": -0.1 }
    ],
    "ScaleX": [
      { "time": 0, "value": 1.0 },
      { "time": 1.5, "value": 1.2 }
    ]
  }
}
```

当前支持的属性名：

- `PositionX`
- `PositionY`
- `Rotation`
- `ScaleX`
- `ScaleY`
- `UniformScale`
- `Alpha`
- `Saturation`
- `Contrast`
- `Brightness`
- `Volume`

规则：

- 属性名大小写不敏感，且兼容下划线/中划线写法。
- `time` 单位为秒，内部会转微秒。
- `value` 通常是单个数值。
- 如果是“覆盖已有关键帧”，可以只传 `time` 不传 `value`，保留原值。
- 如果是“新增关键帧”，必须传 `value`。
- `PositionX` / `PositionY` 的时间点会自动对齐同步。
- 最终写入 `common_keyframes`。

## 5. 与 `segment_styles` 的关系

如果素材带了 `segment_styles` / `segmentStyles` / `styles`，服务会先从样式里读取默认值，再用 `item.data` 覆盖。

当前会从样式中继承的重点字段：

- `clip`
- `volume`
- `last_nonzero_volume`
- `speed`
- `material_animations`
- `common_keyframes`

结论：

- LLM 若需要“明确控制”，应直接在 `item.data` 中写值。
- LLM 若只做轻量调整，可以依赖样式默认值，只补充差异字段。

## 6. 名称字典索引

以下文件均为纯文本名称字典，每行一个可用名称。

- [转场名称字典.txt](d:/programming/pyJianYingDraft/docs/转场名称字典.txt)
- [视频入场动画名称字典.txt](d:/programming/pyJianYingDraft/docs/视频入场动画名称字典.txt)
- [视频出场动画名称字典.txt](d:/programming/pyJianYingDraft/docs/视频出场动画名称字典.txt)
- [文字入场动画名称字典.txt](d:/programming/pyJianYingDraft/docs/文字入场动画名称字典.txt)
- [文字出场动画名称字典.txt](d:/programming/pyJianYingDraft/docs/文字出场动画名称字典.txt)
- [文字循环动画名称字典.txt](d:/programming/pyJianYingDraft/docs/文字循环动画名称字典.txt)
- [视频组合动画名称字典.txt](d:/programming/pyJianYingDraft/docs/视频组合动画名称字典.txt)

使用建议：

- `transitions.name` 从“转场名称字典”中选。
- `animations.type=video_intro` 从“视频入场动画名称字典”中选。
- `animations.type=video_outro` 从“视频出场动画名称字典”中选。
- `animations.type=text_intro` 从“文字入场动画名称字典”中选。
- `animations.type=text_outro` 从“文字出场动画名称字典”中选。
- `animations.type=text_loop` 从“文字循环动画名称字典”中选。
- `animations.type=video_group_animation` 从“视频组合动画名称字典”中选。

## 7. 给 LLM 的最小建议

- 转场优先输出 `name + duration`。
- 动画必须显式写 `type`，不要默认猜文字/视频。
- 关键帧优先使用 `PositionX`、`PositionY`、`ScaleX`、`ScaleY`、`Rotation`。
- 若没有可靠名称字典，不要编造转场名或动画名。
- 文本素材使用 `text`，视频/音频素材使用 `path`。

## 8. 推荐最小示例

```json
{
  "track": "main_video",
  "start": 0,
  "duration": 3,
  "x": 0,
  "y": 0,
  "scale": 1,
  "animations": [
    {
      "type": "video_intro",
      "name": "渐显",
      "duration": 0.5
    },
    {
      "type": "video_outro",
      "name": "淡出",
      "duration": 0.5
    }
  ],
  "transitions": {
    "name": "3D空间",
    "duration": 1.0
  },
  "keyframes": {
    "PositionX": [
      { "time": 0, "value": 0.0 },
      { "time": 2.5, "value": 0.15 }
    ],
    "ScaleX": [
      { "time": 0, "value": 1.0 },
      { "time": 2.5, "value": 1.1 }
    ],
    "ScaleY": [
      { "time": 0, "value": 1.0 },
      { "time": 2.5, "value": 1.1 }
    ]
  }
}
```
