# 模块职责

## src/app（页面）

| 文件 | 职责 |
| --- | --- |
| `layout.tsx` | 根布局，挂载全局 Provider |
| `page.tsx` | 首页/草稿列表 |
| `editor/page.tsx` | 草稿编辑器（时间轴 + 组件） |
| `downloads/page.tsx` | 下载管理 |
| `api/open-in-editor/route.ts` | 开发态打开本地编辑器的 Route Handler |
| `globals.css` | 全局样式 + CSS 变量 |

## src/components（组件，按域分组）

- 编辑器核心：`DraftEditor`、`Timeline`、`DraftList`、`SideBar`、`TabManager`、`TabContextMenu`、`DialogManager`、`ToastProvider`、`DevInspector`。
- 时间轴：`timeline-editor/`（TimelineEditor、TabPanel、ContextMenu、CustomAction、MaterialInfoPanel、TooltipManager、types、constants、utils、useRawPayloads、useTestHandlers、useRuleGroups、index）。
- 测试数据：`TestDataEditor/`（index、utils、parts/：DatasetSelector、EditorToolbar、DownloadConfirmDialog、EditorHeader、BottomActions、MessagePanel）、`TestDataPage`、`TestDataEditorWithTabs`。
- 代码测试：`CodeTestEditor/`（index、types、templates、codeRunner、useRuntimeLoader、components/：Toolbar、CodeEditorPanel、DataPanel、BottomActions）。
- 规则组：`RuleGroupPanel`、`RuleGroupList`、`RuleGroupSelector`、`AddToRuleGroupDialog`。
- 下载：`Aria2DownloadManager`、`DownloadList`、`DownloadManagerDialog`、`DownloadProgressBar`。
- 快照与记录：`SnapshotManager`、`GenerationRecordsDialog`。
- 路径/素材：`PathSelector`、`PathReplacementDialog`、`MaterialPreview`。
- 编辑器组件：`MonacoEditor`、`CodeMirrorEditor`。

## src/hooks

- `useDraftData`：草稿数据加载。
- `useTaskProgress`：任务进度订阅。
- `useAria2WebSocket`：Aria2 实时推送。
- `useSnapshots`：快照管理。
- `useTabs`：标签页管理。
- `useDebounce`：防抖。

## src/lib

- `api.ts`：axios 封装的 API 客户端。
- `storage.ts`：本地存储工具。

## src/types

- `draft.ts`、`rule.ts`、`aria2.ts`、`global.d.ts`。

## src/config

- `defaultRules.ts`：默认规则组配置。
