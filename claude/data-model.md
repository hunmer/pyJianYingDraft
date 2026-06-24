# 数据模型

## 核心库类层次

```
DraftFolder (草稿文件夹管理器)
└── ScriptFile (草稿文件核心)
    ├── ScriptMaterial (素材集合: 音视频/文本/特效/转场等)
    ├── Track (轨道: video/audio/text/effect/filter)
    │   └── Segment (片段基类)
    │       ├── VideoSegment / AudioSegment
    │       ├── TextSegment
    │       ├── StickerSegment
    │       ├── EffectSegment / FilterSegment
    │       └── ImportedSegment (模板模式)
    └── ImportedTrack (模板模式导入的轨道)
        ├── ImportedMediaTrack (音视频轨道)
        └── ImportedTextTrack (文本轨道)
```

## 关键字段约定

- `target_timerange`：片段在时间轴的位置和长度（微秒）。
- `source_timerange`：从素材截取的范围。
- `material_id`：片段引用的素材 ID（自动注册）。
- `relative_index` / `absolute_index`：轨道层级控制。
- 关键帧时间：相对片段头部的偏移。

## 后端 SQLite（`app/db.py`）

- 异步 SQLAlchemy ORM。
- 主要表：任务（`tasks`，含状态、download_files、draft_path 等）、生成记录（generation_records）。
- 自动清理：默认保留 30 天任务。
- 服务器重启后从 DB 恢复任务（但 Aria2 GID 会变化，需通过 `download_files` 重新映射）。

## 后端任务状态机

```
PENDING → DOWNLOADING → PROCESSING → COMPLETED
                                   ↘ FAILED
```

## 规则组（Rule Group）结构

- 每条规则指定素材类型 + 素材 ID。
- 类型 → 轨道映射：`image/video`→视频，`audio/music/sound/extract_music`→音频，`text/subtitle`→文本，`video_effect`→特效。

## 测试数据（Test Data）

- `tracks`：轨道列表，每轨道含多个片段。
- `segments`：片段时间范围 `target_timerange`。
- `styles`：片段样式（关键帧、动画、特效）。
- `use_raw_segments: true` + `raw_segments`：原始片段模式，直接控制底层结构（高级用户/模板替换）。

## 文件版本管理

- 自动备份文件历史，最多保留 10 个版本。
- 通过 WebSocket 实时推送更新（旧文档描述，当前 main.py 未直接定义 socket_app，需以代码为准）。

## 前端类型定义（`src/types/`）

- `draft.ts`：草稿/轨道/片段/素材类型。
- `rule.ts`：规则组/测试数据类型。
- `aria2.ts`：下载任务/进度类型。
- `global.d.ts`：全局类型补丁。
