# 常见问题

## HeroUI 组件背景/文字透明

- 引用了 `var(--xxx)` 但 `globals.css` 未定义该变量。
- 定位：`src/app/globals.css`，先补变量定义再使用。

## API 调用 404 / 跨域

- 后端未启动或 baseURL 错误，检查 `.env.local`。
- 后端 CORS 已开 `*`，正常不应跨域。
- 定位：`src/lib/api.ts`、`.env.local`。

## 找不到 electron 入口

- 当前仓库无 `electron/`，纯 Next.js。
- 定位：`package.json`（无 electron 相关脚本）。

## react-timeline-editor 兼容性

- 基于 `@xzdarcy/react-timeline-editor@0.1.9`，React 19 下可能需注意 ref/children API。
- 定位：`src/components/timeline-editor/TimelineEditor.tsx`。

## 任务进度不更新

- 后端 TaskQueue 进度监控（1s 轮询）未启动，或 `useTaskProgress` 订阅失败。
- 定位：`src/hooks/useTaskProgress.ts`、后端 `app/services/task_queue.py`。

## 构建产物过大

- `out/` 与 `public/js/typescript.js` 体积大，确认是否需要。
- 定位：`next.config.ts`。
