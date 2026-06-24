# 变更记录

按时间倒序，最多保留 5 条。

## 2026-06-24 09:19:30 — 初始化索引

- 按新规范生成根 `CLAUDE.md`（轻量索引）+ `claude/` 详情文件（overview/conventions/module-responsibilities/entrypoints/public-interfaces/dependencies-and-config/data-model/testing-and-quality/file-map/faq/changelog）。
- 识别 3 个模块：`pyJianYingDraft/`、`pyJianYingDraftServer/`、`pyjianyingdraft-web/`，各自生成模块级 `CLAUDE.md` + `claude/`。
- 修正事实：后端入口为 `app.main:app`（非 `socket_app`）；前端当前无 `electron/` 目录；Web App Router 实际路由为 `/`、`/editor`、`/downloads`、`/api/open-in-editor`。
- 跳过：`node_modules/`、`.venv/`、`venv/`、`out/`、`dist/`、`build/`、`.heroui-docs/`、二进制文件、`n8n-plugin/` 深度扫描。
- 下一步建议：核心库各 `*_segment.py` 参数细节、Server 各 router schema、Web `timeline-editor/` 状态管理。
