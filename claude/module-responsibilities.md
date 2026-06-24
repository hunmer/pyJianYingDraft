# 模块职责

## pyJianYingDraft（核心 Python 库）

**职责**：以编程方式生成和操作剪映草稿文件，是整个工具集的能力底座。

**子域**：
- 草稿文件夹管理：`draft_folder.py`（`DraftFolder` 创建/加载/复制草稿）。
- 草稿文件主体：`script_file.py`（`ScriptFile` 管理结构与导出）。
- 轨道与片段：`track.py`、`segment.py`、`video_segment.py`、`audio_segment.py`、`text_segment.py`、`effect_segment.py`、`sticker_segment`。
- 素材封装：`local_materials.py`（`VideoMaterial`/`AudioMaterial`，含媒体信息提取）。
- 元数据：`metadata/`（剪映内置资源枚举：字体/滤镜/转场/动画/特效等，中文命名）。
- 工具：`time_util.py`、`keyframe.py`、`animation.py`、`util.py`、`exceptions.py`。
- 模板模式：`template_mode.py`（`ImportedTrack`/`ShrinkMode`/`ExtendMode`）。
- 自动导出（Windows only）：`jianying_controller.py`（`JianyingController` + `ExportResolution`/`ExportFramerate`）。

**对外形态**：作为 pip 包发布（`setup.py`），也是后端的依赖。

## pyJianYingDraftServer（FastAPI 后端）

**职责**：把核心库能力封装为 HTTP/WebSocket 服务，并叠加异步下载与任务持久化。

**子域**：
- 入口：`app/main.py`（FastAPI `app`，lifespan 管理 Aria2 + DB + TaskQueue）。
- 路由：`app/routers/`（draft、subdrafts、materials、tracks、files、rules、tasks、aria2、generation_records）。
- 服务：`app/services/`（draft_service、rule_test_service、task_queue、aria2_manager/client/controller/singleton、generation_record_service）。
- 模型：`app/models/`（draft_models、rule_models、download_models、generation_record_models、file_watch 隐式）。
- 持久化：`app/db.py`（SQLite + SQLAlchemy 异步 ORM）。
- 工具：`app/path_utils.py`、`app/config.py`。
- 启动：`run.py`（uvicorn，禁用 reload）、`build_server.py`（PyInstaller 打包）。

**依赖**：父目录的 `pyJianYingDraft` 包（`run.py` 把父目录加入 `sys.path`）。

## pyjianyingdraft-web（Next.js 前端）

**职责**：可视化剪映草稿编辑器，对接后端 API，提供时间轴编辑、规则组管理、下载管理。

**子域**：
- 页面（App Router）：`src/app/page.tsx`（首页/草稿列表）、`src/app/editor/page.tsx`（编辑器）、`src/app/downloads/page.tsx`（下载管理）、`src/app/api/open-in-editor/route.ts`（开发态打开编辑器）。
- 组件：`src/components/`（DraftEditor、Timeline、timeline-editor/、TestDataEditor/、CodeTestEditor/、RuleGroupPanel、Aria2DownloadManager、SnapshotManager、DialogManager 等）。
- Hooks：`src/hooks/`（useDraftData、useTaskProgress、useAria2WebSocket、useSnapshots、useTabs、useDebounce）。
- 类型：`src/types/`（draft、rule、aria2、global.d.ts）。
- 库：`src/lib/api.ts`（API 客户端）、`src/lib/storage.ts`。
- 配置：`src/config/defaultRules.ts`。

**注意**：当前仓库**无 `electron/` 目录**（与历史描述不符），以实际扫描为准。
