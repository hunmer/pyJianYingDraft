# 模块职责

## 入口与配置

- `app/main.py`：FastAPI `app`，lifespan 管理 Aria2 + DB + TaskQueue，注册全部路由，挂载 `/static`。
- `app/config.py`：加载 `config.json`，暴露配置项。
- `app/path_utils.py`：跨平台路径工具。
- `run.py`：uvicorn 启动脚本（注入父目录到 `sys.path`，`reload=False`）。
- `build_server.py`：PyInstaller 打包脚本。

## 路由（`app/routers/`）

| 文件 | 前缀 | 职责 |
| --- | --- | --- |
| `draft.py` | `/api/draft` | 草稿基础信息 |
| `subdrafts.py` | `/api/subdrafts` | 复合片段 |
| `materials.py` | `/api/materials` | 素材管理 |
| `tracks.py` | `/api/tracks` | 轨道管理 |
| `files.py` | `/api/files` | 文件服务 |
| `rules.py` | `/api/rules` | 规则测试 |
| `tasks.py` | `/api/tasks` | 异步任务提交/查询 |
| `aria2.py` | `/api/aria2` | Aria2 下载管理 |
| `generation_records.py` | （无统一前缀） | 生成记录 |

## 服务（`app/services/`）

- `draft_service.py`：草稿解析。
- `rule_test_service.py`：规则执行，核心方法 `RuleTestService.run_test()`，构建片段计划并生成草稿。
- `task_queue.py`：任务队列、状态机、进度监控（1s 轮询）、WebSocket 订阅。
- `aria2_manager.py`：`Aria2ProcessManager` 单例，进程 + 配置 + 健康检查。
- `aria2_client.py`：`Aria2Client`，aria2p RPC 封装，批量下载 + 重试（默认 3 次指数退避，`MAX_RETRY_COUNT`）。
- `aria2_controller.py`：下载流程编排。
- `aria2_singleton.py`：单例工具。
- `generation_record_service.py`：生成记录服务。

## 模型（`app/models/`）

- `draft_models.py`：草稿数据结构。
- `rule_models.py`：规则组与测试数据（`RuleGroupTestRequest` 等）。
- `download_models.py`：下载任务模型。
- `generation_record_models.py`：生成记录模型。

## 持久化

- `app/db.py`：`get_database()` 异步初始化 SQLite + SQLAlchemy，任务持久化，自动清理 30 天前任务。
