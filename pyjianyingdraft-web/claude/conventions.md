# 约定详情

## 命令

```bash
npm run dev            # next dev（开发）
npm run build          # next build（生产构建）
npm run start          # next start（启动生产服务）
npm run lint           # next lint（ESLint）
npm run run:backend    # cd ../pyJianYingDraftServer && python run.py
npm run build:backend  # cd ../pyJianYingDraftServer && python build_server.py
npm run build:all      # 先打包后端，再 next build
```

## 框架与路由

- Next.js 15 App Router。
- 页面在 `src/app/<route>/page.tsx`。
- API Route（Route Handler）在 `src/app/api/<route>/route.ts`。
- 根布局 `src/app/layout.tsx`，全局样式 `src/app/globals.css`。

## UI 与样式

- 组件库：`@heroui/react` v3、`@heroui/styles`。
- 原子类：Tailwind CSS v4（`@tailwindcss/postcss`）+ `tailwind-variants`。
- 图标：`lucide-react`。
- 注意：引用 `var(--xxx)` 前确认 `globals.css` 已定义该变量，否则背景/文字可能透明。

## 编辑器

- CodeMirror 6：`@uiw/react-codemirror` + `@codemirror/*`（lang-json/lang-python/lang-javascript/lint/autocomplete 等）+ `@uiw/codemirror-theme-vscode`。
- 另有 `MonacoEditor.tsx`（备用）。

## 时间轴

- `@xzdarcy/react-timeline-editor`，封装在 `src/components/timeline-editor/`。
- 配套样式 `src/components/timeline.css`。

## 网络

- `axios`（`src/lib/api.ts` 集中封装）。
- 实时进度：`src/hooks/useTaskProgress.ts`、`src/hooks/useAria2WebSocket.ts`。

## 类型

- TypeScript 5，配置 `tsconfig.json`。
- 业务类型集中在 `src/types/`。
- 全局补丁 `src/types/global.d.ts`。

## 配置文件

- `.env.local`：实际环境变量（未读）。
- `.env.example`：模板（未读）。
- `next.config.ts`、`tsconfig.json`、`postcss.config.js`、`.eslintrc.json`。

## 后端联调

- 后端默认 `:8000`，Swagger `/docs`。
- 后端 CORS 已开 `*`。
