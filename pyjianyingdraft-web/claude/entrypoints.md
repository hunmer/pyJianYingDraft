# 入口与启动

## Next.js 启动

- 开发：`npm run dev`（`next dev`）。
- 生产构建：`npm run build`（`next build`）。
- 启动生产：`npm run start`（`next start`）。

## App Router 入口

- 根布局：`src/app/layout.tsx`。
- 首页：`src/app/page.tsx`。
- 全局样式：`src/app/globals.css`。

## API Route

- `src/app/api/open-in-editor/route.ts`：开发态通过本地服务打开编辑器（具体实现未深读）。

## 配套后端启动

- `npm run run:backend`：cd 到 `../pyJianYingDraftServer` 跑 `python run.py`（端口 8000，禁 reload）。

## 全量打包

- `npm run build:all`：
  1. `npm run build:backend` → 在后端目录跑 `python build_server.py` → 产出 `pyJianYingDraftServer.exe` → 复制到 `resources/`。
  2. `npm run build` → `next build`。

## 无 Electron 入口

当前仓库无 `electron/main.js`、`electron/preload.js`。如需桌面化分发，需要另行引入 Electron（历史描述提到，当前代码不存在）。
