# 变更记录

## 2026-06-24 09:19:30 — 初始化模块索引

- 全新创建 `pyjianyingdraft-web/CLAUDE.md`（轻量索引）+ `claude/` 详情（此前无模块级 CLAUDE.md）。
- 信息源：`package.json` 全文、`src/` 全部文件路径。
- 修正：当前无 `electron/` 目录（与历史根 CLAUDE.md 描述不符）；App Router 实际路由 `/`、`/editor`、`/downloads`、`/api/open-in-editor`。
- 跳过：`node_modules/`、`.heroui-docs/`、`out/`、`public/`、各组件函数体、`.env.local`（避免泄密）。
- 下一步：深挖 `timeline-editor/` 状态管理、`api.ts` 全部端点、`useAria2WebSocket` 实现细节。
