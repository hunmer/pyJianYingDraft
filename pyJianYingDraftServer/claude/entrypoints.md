# 入口与启动

## ASGI 入口

`app.main:app`（`app/main.py:168`）：

```python
app = FastAPI(title="pyJianYingDraft API", version="0.1.0", lifespan=lifespan)
```

CORS：`allow_origins=["*"]`，`allow_credentials=True`。

路由注册：`app.include_router(draft.router, prefix="/api/draft", ...)` 等共 9 个。

静态目录：`app/static`（若存在）挂载到 `/static`。

## lifespan 启动流程

1. Windows 下把 stdout/stderr 包装为 UTF-8（兼容 GBK）。
2. 最小化日志配置（`pyJianYingDraft` logger，`propagate=False`）。
3. 启动 `Aria2ProcessManager` 单例 + 健康检查（30s）。
4. 初始化 SQLite（`get_database()`）。
5. 启动 `TaskQueue` + Aria2 客户端，从 DB 加载历史任务，启动进度监控（1s 轮询）。
6. 关闭时反向停止：进度监控 → Aria2 进程。

## run.py

`python run.py`：
- 把项目根目录加入 `sys.path`（开发环境用 `__file__` 推断；打包环境用 `sys.executable`）。
- `os.environ["PYTHONUNBUFFERED"] = "1"`。
- `uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False, ...)`。

## 打包

`python build_server.py`：PyInstaller 打包为 `dist/pyJianYingDraftServer.exe`，自动复制到 `../pyjianyingdraft-web/resources/`。

打包环境识别：`getattr(sys, 'frozen', False)`，路径用 `sys.executable` 推断。

## API 文档

- Swagger UI：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`
