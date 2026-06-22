# 任务计划：MUI → HeroUI v3 迁移 + 移除 Electron

## 目标
1. 将 pyjianyingdraft-web 的 UI 框架从 MUI 6 全量迁移到 HeroUI v3（Tailwind CSS v4 + React Aria）
2. 移除 Electron 框架，改为纯 Web 应用（Next.js 标准模式）

## 关键约束
- HeroUI v3 **强制要求** Tailwind CSS v4（项目目前无 Tailwind）
- HeroUI v3 **无需 Provider**（v2 的 HeroUIProvider 已废弃）
- 使用**复合组件**模式（`Card.Header` 而非 flat props）
- 使用 `onPress` 而非 `onClick`
- 当前栈：Next.js 15.5.6 + React 19 + MUI 6 + Emotion

## 现状摸底
- **28 个文件**引用 @mui（27 个组件 + theme.ts + layout）
- MUI 使用模式：`sx` prop 动态样式、Box/Paper/Dialog/Typography/IconButton/Tooltip/Alert/CircularProgress/Tabs/Table/Grid 等
- 大量 `@mui/icons-material` 图标导入
- **Electron IPC 仅 2 个组件使用**（Aria2DownloadManager、PathReplacementDialog），均已用 `window.electron?.fs?.xxx` 可选链保护 → 移除后优雅降级
- next.config.ts 当前为 Electron 静态导出（`output: 'export'`、`assetPrefix: './'`、`trailingSlash: true`）

## 阶段划分

### Phase 1：基础设施（进行中）
- [ ] 安装 `@heroui/react @heroui/styles tailwind-variants tailwindcss @tailwindcss/postcss`
- [ ] 移除 MUI/Emotion 依赖（package.json）
- [ ] 配置 `postcss.config.js`（@tailwindcss/postcss）
- [ ] 重写 `src/app/globals.css`（@import tailwindcss + @heroui/styles）
- [ ] 改 `next.config.ts`（移除 output:'export' / assetPrefix / trailingSlash）

### Phase 2：主题与入口
- [ ] 重写 `src/theme.ts` → HeroUI CSS 变量主题（oklch）
- [ ] 重写 `src/app/layout.tsx`（移除 MUI Provider/CssBaseline/CacheProvider）
- [ ] 配置暗色/亮色主题变量

### Phase 3：核心页面与组件（首批）
优先让应用能跑起来的关键路径：
- [ ] `src/app/page.tsx`（主页）
- [ ] `src/components/SideBar.tsx`
- [ ] `src/components/TabManager.tsx`
- [ ] `src/components/TabContextMenu.tsx`
- [ ] `src/components/DraftEditor.tsx`
- [ ] `src/components/DraftList.tsx`
- [ ] `src/components/RuleGroupList.tsx` / `RuleGroupSelector.tsx` / `RuleGroupPanel.tsx`

### Phase 4：对话框与编辑器组件（次批）
- [ ] `src/components/DialogManager.tsx`
- [ ] `src/components/DownloadManagerDialog.tsx` / `DownloadList.tsx` / `DownloadProgressBar.tsx`
- [ ] `src/components/Aria2DownloadManager.tsx`
- [ ] `src/components/GenerationRecordsDialog.tsx`
- [ ] `src/components/AddToRuleGroupDialog.tsx`
- [ ] `src/components/PathReplacementDialog.tsx` / `PathSelector.tsx`
- [ ] `src/components/SnapshotManager.tsx`
- [ ] `src/components/CodeMirrorEditor.tsx` / `CodeTestEditor.tsx`
- [ ] `src/components/TestDataEditor.tsx` / `TestDataEditorWithTabs.tsx` / `TestDataPage.tsx`
- [ ] `src/components/MaterialPreview.tsx`
- [ ] `src/components/Timeline.tsx`
- [ ] `src/app/editor/page.tsx` / `src/app/downloads/page.tsx`

### Phase 5：移除 Electron
- [ ] 删除 `electron/main.js`、`electron/preload.js`、`electron/` 目录
- [ ] 删除 `scripts/build-electron.js`、`electron-builder.json`
- [ ] 删除 `src/types/electron.d.ts`
- [ ] 清理 `Aria2DownloadManager.tsx`、`PathReplacementDialog.tsx` 中的 `window.electron` 调用（改为 web 可用方案或移除）
- [ ] 清理 `package.json`（main 字段、electron scripts、build 配置、resources 引用）

### Phase 6：验证
- [ ] `npm install`（用 --legacy-peer-deps）
- [ ] `npm run dev` 启动验证
- [ ] `npm run build` 构建验证
- [ ] 手动验收核心页面

## MUI → HeroUI 组件映射（关键）

| MUI | HeroUI v3 | 备注 |
|-----|-----------|------|
| Box（sx） | `<div className="...">` | sx → Tailwind classes |
| Paper | Surface / Card | - |
| Button | Button | variant 映射：contained→primary, outlined→outline, text→ghost |
| IconButton | Button（isIconOnly） | - |
| Typography | Typography | variant→size |
| Tooltip | Tooltip | - |
| Dialog | Modal | 复合结构 Modal.Header/Content/Footer |
| Alert | Alert | - |
| CircularProgress | Spinner / ProgressCircle | - |
| LinearProgress | ProgressBar | - |
| TextField | TextField / Input | 复合结构 |
| Tabs / Tab | Tabs | 复合结构 Tabs.List/Tab/Panel |
| Grid / Stack | flex/grid Tailwind | 直接用 Tailwind |
| Menu | Dropdown / Menu | - |
| Checkbox / Switch / Radio | Checkbox / Switch / RadioGroup | - |
| Select | Select | 复合结构 |
| Table | Table | 复合结构 |
| Accordion | Accordion / Disclosure | - |
| Snackbar | Toast | - |
| AppBar | 自定义 div | - |

## sx prop 迁移策略
- 简单布局 sx → 直接 Tailwind class（`display:'flex'` → `flex`）
- 主题色 sx（`color: 'primary.main'`）→ HeroUI 语义 variant 或 CSS 变量（`text-[var(--accent-foreground)]`）
- 响应式 sx → Tailwind 响应式前缀（`md:flex-row`）
- 复杂动态 sx → tailwind-variants 的 `tv()` 或条件 className

## 决策记录
- **Electron 文件操作降级**：移除 Electron 后 `window.electron.fs.*` 永不触发。策略：保留可选链保护（最小改动），按钮在无 electron 时隐藏或 noop。
- **图标库**：MUI icons → 使用 lucide-react 或 HeroUI 内置。优先 lucide-react（轻量、API 一致）。

## 错误记录
| Error | 尝试 | 解决 |
|-------|------|------|
| - | - | - |
