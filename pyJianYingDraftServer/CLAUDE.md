# CLAUDE.md — pyJianYingDraftServer

[根目录](../CLAUDE.md) > **pyJianYingDraftServer**

## 模块简单介绍

pyJianYingDraftServer 是基于 FastAPI 的剪映草稿 API 服务器，把核心库 `pyJianYingDraft` 的能力封装为 REST API，并叠加基于 Aria2 的高性能异步下载系统、SQLite 任务持久化、文件版本管理。作为前端 `pyjianyingdraft-web` 的后端，支持 PyInstaller 打包成单文件 exe 嵌入 Electron/桌面应用分发。

关键技术栈：FastAPI + uvicorn、SQLAlchemy 异步 ORM + SQLite、aria2p + 外部 aria2c、依赖父目录的核心库（通过 `sys.path` 注入）。

## 约定的规则

- 入口为 `app.main:app`（FastAPI 实例），不是 `socket_app`。
- 开发模式**必须禁用 `--reload`**（`run.py` 已默认 `reload=False`），否则多个 aria2c 冲突。
- 不要修改根日志配置（与 uvicorn 冲突）；用 `print()` + `sys.stdout.flush()`。
- 时间内部统一微秒；API 响应可同时给微秒和秒。
- 路径用 `pathlib.Path` 或 `os.path.join()`，避免硬编码 Windows 路径。
- `config.json` 必须配置 `PYJY_DRAFT_ROOT`（剪映草稿文件夹）。
- 新增 API：`models/` 定义 schema → `services/` 实现 → `routers/` 路由 → `main.py` 注册。
- 详情见 [约定详情](claude/conventions.md)。

## 文件索引

| 文件 | 用途 | 何时阅读 |
| --- | --- | --- |
| [架构总览](claude/overview.md) | 分层架构、Aria2 异步下载流程 | 第一次接手 |
| [约定详情](claude/conventions.md) | 命令、日志、路径、新增 API 流程 | 写后端代码前 |
| [模块职责](claude/module-responsibilities.md) | routers/services/models 各文件职责 | 找实现位置 |
| [入口与启动](claude/entrypoints.md) | main.py lifespan、run.py、打包 | 跑起来或排错 |
| [对外接口](claude/public-interfaces.md) | REST 路由前缀、任务状态机、Swagger | 调用 API |
| [依赖与配置](claude/dependencies-and-config.md) | FastAPI/SQLAlchemy/aria2p、config.json | 环境配置 |
| [数据模型](claude/data-model.md) | SQLite 表、任务状态机、规则组结构 | 设计数据流 |
| [测试与质量](claude/testing-and-quality.md) | test_*.py、排障脚本与文档 | 验证改动 |
| [文件地图](claude/file-map.md) | app/ 全部文件清单 | 找文件 |
| [常见问题](claude/faq.md) | Aria2 多进程、GID 丢失、日志递归等 | 排错 |
| [变更记录](claude/changelog.md) | 索引生成记录 | 看历史 |

## 扫描状态

- 更新时间：2026-06-24 09:19:30
- 已扫描：`app/` 全部 28 个 `.py`（main/config/db/path_utils + 9 个 routers + 8 个 services + 4 个 models）、`run.py` 全文、`CLAUDE.md` 全文。
- 修正事实：实际入口 `app.main:app`（旧文档提到的 `socket_app` 当前未定义）。
- 跳过：`venv/`、`.venv/`、`data/`、`tasks.db`、`*.exe`、各 router/service 的函数体细节。
- 下一步建议：深挖各 router 的请求/响应 schema、`rule_test_service.py` 的草稿生成细节、Aria2 RPC 错误重试逻辑。
