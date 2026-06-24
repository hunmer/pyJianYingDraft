# 文件地图

## 配置

| 文件 | 说明 |
| --- | --- |
| `package.json` | 依赖与脚本 |
| `next.config.ts` | Next.js 配置 |
| `tsconfig.json` | TypeScript 配置 |
| `postcss.config.js` | PostCSS（Tailwind v4） |
| `.eslintrc.json` | ESLint |
| `.env.local` / `.env.example` | 环境变量 |
| `inspect-source-loader.cjs` | dev-inspector 配套 |

## src/app

`layout.tsx`、`page.tsx`、`globals.css`、`editor/page.tsx`、`downloads/page.tsx`、`api/open-in-editor/route.ts`

## src/components

`DraftEditor`、`DraftList`、`Timeline`、`SideBar`、`TabManager`、`TabContextMenu`、`DialogManager`、`ToastProvider`、`DevInspector`、`MonacoEditor`、`CodeMirrorEditor`、`MaterialPreview`、`PathSelector`、`PathReplacementDialog`、`TestDataPage`、`TestDataEditorWithTabs`、`AddToRuleGroupDialog`、`RuleGroupPanel`、`RuleGroupList`、`RuleGroupSelector`、`Aria2DownloadManager`、`DownloadList`、`DownloadManagerDialog`、`DownloadProgressBar`、`SnapshotManager`、`GenerationRecordsDialog`、`timeline.css`

子目录：
- `timeline-editor/`：TimelineEditor、TabPanel、ContextMenu、CustomAction、MaterialInfoPanel、TooltipManager、types、constants、utils、useRawPayloads、useTestHandlers、useRuleGroups、index
- `TestDataEditor/`：index、utils、parts/（DatasetSelector、EditorToolbar、DownloadConfirmDialog、EditorHeader、BottomActions、MessagePanel）
- `CodeTestEditor/`：index、types、templates、codeRunner、useRuntimeLoader、components/（Toolbar、CodeEditorPanel、DataPanel、BottomActions）

## src/hooks

`useDraftData`、`useTaskProgress`、`useAria2WebSocket`、`useSnapshots`、`useTabs`、`useDebounce`

## src/lib

`api.ts`、`storage.ts`

## src/types

`draft.ts`、`rule.ts`、`aria2.ts`、`global.d.ts`

## src/config

`defaultRules.ts`

## 其他（跳过）

- `node_modules/`、`.heroui-docs/`（HeroUI 官方示例）、`out/`（构建产物）、`public/`
