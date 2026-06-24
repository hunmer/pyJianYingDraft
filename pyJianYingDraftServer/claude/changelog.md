# 变更记录

## 2026-06-24 09:19:30 — 初始化模块索引

- 生成 `pyJianYingDraftServer/CLAUDE.md`（轻量索引）+ `claude/` 详情。
- 信息源：`app/` 全部 28 个 `.py`、`run.py`、旧 `CLAUDE.md`。
- 修正：入口实际为 `app.main:app`，非 `socket_app`。
- 跳过：各 router/service 函数体细节、`venv/`、`.venv/`、`data/`、`tasks.db`。
- 下一步：各 router schema、`rule_test_service.run_test()` 细节、Aria2 RPC 重试逻辑。
