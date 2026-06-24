# 约定详情

## 命令

```bash
python run.py                 # 开发启动（reload=False）
python run_production.py      # 生产模式（旧文档提及）
python build_server.py        # PyInstaller 打包 → dist/pyJianYingDraftServer.exe
python test_e2e.py            # 端到端测试
python test_database.py       # 数据库测试
python test_groups.py         # 规则组测试
python cleanup_aria2.py       # 清理 aria2c 进程
python example_aria2_usage.py # Aria2 用法示例
```

直接 uvicorn：`uvicorn app.main:app --host 0.0.0.0 --port 8000`（不要加 `--reload`）。

## 入口

- 实际 ASGI app：`app.main:app`（FastAPI 实例，定义在 `app/main.py:168`）。
- 旧文档的 `socket_app` 当前未定义；若需 WebSocket 推送，看 TaskQueue 内部事件机制。

## 日志规范

- 不要修改根日志配置。
- 只配置 `pyJianYingDraft` logger，`propagate=False`。
- 用 `print()` + `sys.stdout.flush()`。
- `PYTHONUNBUFFERED=1`（`run.py` 已设）。

## 时间单位

- 内部微秒；API 响应可同时给微秒和秒。
- 用核心库 `draft.tim()` / `draft.trange()` 转换。

## 路径

- 优先 `pathlib.Path`。
- 跨平台用 `os.path.join()`，避免硬编码 Windows 路径。

## 新增 API 端点流程

1. `app/models/` 定义 Pydantic 请求/响应模型。
2. `app/services/` 实现业务逻辑。
3. `app/routers/` 创建 `APIRouter`。
4. `app/main.py` 用 `app.include_router(...)` 注册（注意 `prefix` 和 `tags`）。

## 新增 WebSocket 事件

旧文档描述用 `@sio.event`，但当前 `main.py` 未定义 `sio`。若需实时推送，需先确认当前事件机制（TaskQueue 内部轮询 + 客户端订阅），或引入 `python-socketio`。

## 配置

- `config.json`：`PYJY_DRAFT_ROOT`（必填）、`ARIA2_PATH`（可选）、`PYJY_RULE_GROUPS`。
- Aria2 发现顺序：`config.json` → 打包 `resources/aria2c.exe` → 系统 PATH。

## 错误处理

- REST 用 `fastapi.HTTPException`。
- 异步操作 try-except 捕获并打印 traceback。
