# 文件地图

## 根目录

| 路径 | 说明 |
| --- | --- |
| `CLAUDE.md` | 本索引 |
| `claude/` | 本目录详情文件 |
| `setup.py` | 核心库 pip 打包配置 |
| `demo.py` | 核心库使用示例 |
| `demo_subdrafts.py` | 复合片段示例 |
| `README.md` | 用户文档 |
| `pypi_readme.md` | PyPI 长描述 |
| `.gitignore` | 忽略规则 |
| `pyJianYingDraft/` | 核心 Python 库 |
| `pyJianYingDraftServer/` | FastAPI 后端 |
| `pyjianyingdraft-web/` | Next.js 前端 |
| `n8n-plugin/` | n8n 插件（独立子项目，本次未深入扫描） |

## 核心 Python 库（`pyJianYingDraft/`）

| 文件 | 职责 |
| --- | --- |
| `__init__.py` | 公开 API 导出 + snake_case 旧别名 |
| `script_file.py` | `ScriptFile` 草稿主类 |
| `draft_folder.py` | `DraftFolder` 文件夹管理 |
| `track.py` | `TrackType` + `Track` |
| `segment.py` | 片段基类 |
| `video_segment.py` | 视频/贴纸片段、关键帧、蒙版、动画、特效、滤镜、转场、背景填充 |
| `audio_segment.py` | 音频片段、音量关键帧、淡入淡出、音效 |
| `text_segment.py` | 文本片段、字体样式、气泡/花字、描边/阴影/背景 |
| `effect_segment.py` | 独立轨道特效/滤镜片段 |
| `local_materials.py` | 本地素材封装 + 媒体信息提取 |
| `time_util.py` | `tim`/`trange`/`Timerange`/`srt_tstamp` |
| `keyframe.py` | 关键帧系统 |
| `animation.py` | 入场/出场/循环动画元数据 |
| `template_mode.py` | 模板模式专用类 |
| `jianying_controller.py` | UI 自动化导出（Windows only） |
| `util.py` | 通用工具（JSON 序列化、属性赋值） |
| `exceptions.py` | 自定义异常 |
| `metadata/` | 剪映内置资源枚举（17 个 `.py`） |
| `assets/*.json` | 打包数据 |

## 后端（`pyJianYingDraftServer/`）

| 路径 | 说明 |
| --- | --- |
| `run.py` | 开发启动（uvicorn，禁 reload） |
| `build_server.py` | PyInstaller 打包 |
| `config.json` | 服务配置 |
| `test_*.py` | 测试脚本 |
| `cleanup_aria2.py` / `example_aria2_usage.py` | Aria2 辅助 |
| `app/main.py` | FastAPI 入口 |
| `app/config.py` | 配置加载 |
| `app/path_utils.py` | 路径工具 |
| `app/db.py` | SQLite 异步 ORM |
| `app/routers/` | draft/subdrafts/materials/tracks/files/rules/tasks/aria2/generation_records |
| `app/services/` | draft_service/rule_test_service/task_queue/aria2_manager/aria2_client/aria2_controller/aria2_singleton/generation_record_service |
| `app/models/` | draft_models/rule_models/download_models/generation_record_models |

## 前端（`pyjianyingdraft-web/`）

| 路径 | 说明 |
| --- | --- |
| `package.json` | 依赖与脚本 |
| `next.config.ts` | Next.js 配置 |
| `tsconfig.json` | TypeScript 配置 |
| `postcss.config.js` | PostCSS（Tailwind v4） |
| `.eslintrc.json` | ESLint |
| `src/app/` | App Router 页面（page/editor/downloads + api/open-in-editor） |
| `src/components/` | React 组件（DraftEditor/Timeline/timeline-editor/TestDataEditor/CodeTestEditor/RuleGroup*/Aria2*/Snapshot* 等） |
| `src/hooks/` | 自定义 Hooks |
| `src/lib/` | api.ts、storage.ts |
| `src/types/` | TS 类型定义 |
| `src/config/` | defaultRules.ts |
| `public/` | 静态资源 |
