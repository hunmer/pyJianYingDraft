# 架构总览

## 分层

```
FastAPI (app/main.py)
  - lifespan: Aria2 + DB + TaskQueue 启动/关闭
  - 路由注册 + CORS + 静态目录
        │
路由层 (app/routers/)
  draft / subdrafts / materials / tracks / files / rules / tasks / aria2 / generation_records
        │
服务层 (app/services/)
  draft_service / rule_test_service / task_queue
  aria2_manager / aria2_client / aria2_controller / aria2_singleton
  generation_record_service
        │
数据模型 (app/models/)
  draft_models / rule_models / download_models / generation_record_models
        │
持久化 (app/db.py)
  SQLite + SQLAlchemy 异步 ORM
```

## 异步下载系统

流程：HTTP 任务提交 → TaskQueue 异步处理 → Aria2 批量下载 → 进度监控（1s 轮询）→ 草稿生成 → 推送进度。

关键组件：
- `Aria2ProcessManager`（单例）：管理 aria2c 进程、生成 `aria2.conf`、健康检查（30s）、自动重启。
- `Aria2Client`：封装 aria2p RPC，批量下载 `add_batch_downloads`、进度查询 `get_batch_progress`、失败重试（默认 3 次指数退避）。
- `TaskQueue`：任务 CRUD、状态机、后台进度监控、订阅管理。
- `Database`：SQLite 异步 ORM，任务持久化，重启可恢复；自动清理 30 天前任务。

## 与核心库的关系

通过 `run.py` / `main.py` 把项目根目录加入 `sys.path`，`import pyJianYingDraft` 直接引用源码（非 pip 安装）。草稿生成核心逻辑在 `services/rule_test_service.py`，调用 `DraftFolder.create_draft()` → 添加轨道片段 → `script.dump()`。

## 设计取舍

- 禁用热重载：Aria2 是单例进程，多 worker 会冲突。
- 异步 ORM：避免阻塞事件循环。
- 日志最小化：避免与 uvicorn 根 logger 冲突导致递归。
