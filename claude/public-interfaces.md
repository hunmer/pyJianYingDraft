# 对外接口

## 核心 Python 库（SDK）

`import pyJianYingDraft as draft` 后主要导出：

- 容器：`DraftFolder`、`ScriptFile`。
- 片段：`VideoSegment`、`AudioSegment`、`TextSegment`、`StickerSegment`、`EffectSegment`、`FilterSegment`。
- 素材：`VideoMaterial`、`AudioMaterial`、`CropSettings`。
- 轨道：`TrackType`（video/audio/text/effect/filter）。
- 时间：`Timerange`、`tim`、`trange`、`SEC`。
- 关键帧：`KeyframeProperty`。
- 模板模式：`ShrinkMode`、`ExtendMode`。
- 元数据枚举：`FontType`、`MaskType`、`TransitionType`、`FilterType`、`IntroType`、`OutroType`、`GroupAnimationType`、`TextIntro`、`TextOutro`、`TextLoopAnim`、`AudioSceneEffectType`、`VideoSceneEffectType`、`VideoCharacterEffectType`。
- Windows 额外：`JianyingController`、`ExportResolution`、`ExportFramerate`。

链式主流程：`folder.create_draft(...)` → `script.add_track(...).add_segment(...).save()`。

## 后端 REST API（前缀 `/api`）

在 `app/main.py` 注册：

| 前缀 | 路由文件 | 说明 |
| --- | --- | --- |
| `/api/draft` | `routers/draft.py` | 草稿基础信息 |
| `/api/subdrafts` | `routers/subdrafts.py` | 复合片段 |
| `/api/materials` | `routers/materials.py` | 素材管理 |
| `/api/tracks` | `routers/tracks.py` | 轨道管理 |
| `/api/files` | `routers/files.py` | 文件服务 |
| `/api/rules` | `routers/rules.py` | 规则测试 |
| `/api/tasks`（无统一前缀） | `routers/tasks.py` | 异步任务提交/查询 |
| `/api/aria2` | `routers/aria2.py` | Aria2 下载管理 |
| （无统一前缀） | `routers/generation_records.py` | 生成记录 |

- Swagger UI：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`
- 静态目录：`/static`（若 `app/static` 存在）。
- CORS：`allow_origins=["*"]`。

## 后端任务流（典型）

1. `POST /api/tasks/submit` 提交任务（含规则组、素材、测试数据）。
2. 前端订阅进度（通过 TaskQueue 内部事件/WebSocket-like 推送，1s 轮询驱动）。
3. `GET /api/tasks/{task_id}` 查询状态：`PENDING → DOWNLOADING → PROCESSING → COMPLETED/FAILED`。
4. 完成后 `draft_path` 字段返回草稿文件路径。

## 前端路由（Next.js App Router）

| 路径 | 文件 | 用途 |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | 首页/草稿列表 |
| `/editor` | `src/app/editor/page.tsx` | 草稿编辑器（时间轴） |
| `/downloads` | `src/app/downloads/page.tsx` | 下载管理 |
| `/api/open-in-editor` | `src/app/api/open-in-editor/route.ts` | 开发态打开本地编辑器（Route Handler） |

## 规则组类型映射（后端/前端共享）

- `image`、`video` → 视频轨道
- `audio`、`music`、`sound`、`extract_music` → 音频轨道
- `text`、`subtitle` → 文本轨道
- `video_effect` → 特效轨道
