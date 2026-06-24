# 架构总览

## 目录划分

```
src/
  app/              Next.js App Router
    layout.tsx        根布局
    page.tsx          首页/草稿列表
    editor/page.tsx   草稿编辑器（时间轴）
    downloads/page.tsx 下载管理
    api/open-in-editor/route.ts  开发态打开本地编辑器
    globals.css       全局样式 + CSS 变量
  components/       React 组件
    DraftEditor / Timeline / timeline-editor/
    TestDataEditor/ / CodeTestEditor/
    RuleGroupPanel / RuleGroupList / RuleGroupSelector
    Aria2DownloadManager / DownloadList / DownloadManagerDialog / DownloadProgressBar
    SnapshotManager / GenerationRecordsDialog
    DialogManager / TabManager / TabContextMenu / ToastProvider
    MonacoEditor / CodeMirrorEditor / MaterialPreview / PathSelector ...
  hooks/            useDraftData / useTaskProgress / useAria2WebSocket / useSnapshots / useTabs / useDebounce
  lib/              api.ts（API 客户端）/ storage.ts
  types/            draft.ts / rule.ts / aria2.ts / global.d.ts
  config/           defaultRules.ts
```

## 数据流

```
浏览器 (React 组件)
   │  axios (src/lib/api.ts)
   ▼
FastAPI 后端 (:8000)
   │  import pyJianYingDraft
   ▼
剪映草稿文件
```

任务进度：组件 → `useTaskProgress` / `useAria2WebSocket` → 后端任务队列推送。

## 与后端关系

- 后端默认 `http://localhost:8000`（具体 baseURL 在 `.env.local` 或 `api.ts`，本次未读 `.env.local` 避免泄密）。
- 后端 Swagger：`http://localhost:8000/docs`。
- CORS：后端 `allow_origins=["*"]`。

## 重要设计取舍

- 时间轴使用 `@xzdarcy/react-timeline-editor`，自定义封装在 `components/timeline-editor/`（含 types/constants/utils/TooltipManager/TabPanel/useRawPayloads/useTestHandlers/ContextMenu/CustomAction/MaterialInfoPanel/TimelineEditor）。
- 代码编辑用 CodeMirror 6（json/python/js），支持 lint；另有 MonacoEditor 组件。
- 差异对比：`diff` + `diff2html` + `react-diff-view` + `unidiff`。
- UI 全量基于 HeroUI，Tailwind v4 提供原子类与 CSS 变量。

## 无 Electron

当前仓库无 `electron/` 目录。`build:all` 脚本仅：先打包后端 exe 到 `resources/`，再 `next build`。如需桌面化，需另引入 Electron（历史描述提到过，但当前代码不存在）。
