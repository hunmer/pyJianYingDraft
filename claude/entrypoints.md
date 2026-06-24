# 入口与启动

## 核心库

无独立入口，作为包导入：

```python
import pyJianYingDraft as draft
```

包入口 `pyJianYingDraft/__init__.py` 导出全部公开 API，并在 Windows 平台额外导出 `JianyingController` 等。提供 snake_case 旧别名的 deprecation 警告。

示例脚本：根目录 `demo.py`、`demo_subdrafts.py`。

## 后端（pyJianYingDraftServer）

- **开发启动**：`python run.py`
  - 内部调用 `uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)`。
  - `reload=False` 是硬性要求（Aria2 单例）。
  - `run.py` 会把项目根目录加入 `sys.path` 以便导入核心库。
- **直接 uvicorn**：`uvicorn app.main:app --host 0.0.0.0 --port 8000`（同样不要加 `--reload`）。
- **打包**：`python build_server.py` → `dist/pyJianYingDraftServer.exe`，自动复制到 `../pyjianyingdraft-web/resources/`。

### lifespan 初始化流程（`app/main.py`）

1. 设置 stdout/stderr 为 UTF-8（Windows GBK 兼容）。
2. 最小化日志配置（仅 `pyJianYingDraft` logger，`propagate=False`）。
3. 启动 `Aria2ProcessManager` 单例 + 健康检查（30s 间隔）。
4. 初始化 SQLite 数据库。
5. 启动 `TaskQueue` + Aria2 客户端，从 DB 恢复历史任务，启动进度监控（1s 轮询）。
6. 关闭时反向停止：进度监控 → Aria2 进程。

## 前端（pyjianyingdraft-web）

- **开发**：`npm run dev`（`next dev`）。
- **生产构建**：`npm run build` → `next build`。
- **启动生产服务**：`npm run start`。
- **联动后端**：`npm run run:backend`（cd 到后端执行 `python run.py`）。
- **全量打包**：`npm run build:all`（先打包后端 exe，再 `next build`）。

App Router 入口：`src/app/layout.tsx`（根布局）+ `src/app/page.tsx`（首页）。
