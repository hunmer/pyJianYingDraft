# 探索发现

## 项目结构（src）
```
src/
├── app/
│   ├── layout.tsx              # HeroUI 入口（无 Provider）
│   ├── page.tsx                # 主页
│   ├── editor/page.tsx         # 编辑器页
│   ├── downloads/page.tsx      # 下载页
│   └── globals.css             # Tailwind v4 + HeroUI styles
├── components/  (27 个组件，已全量迁移)
├── hooks/  (6 个，无 UI 依赖)
├── lib/  (api.ts, storage.ts)
├── types/  (aria2, draft, rule, global.d.ts)  # electron.d.ts 已删
├── config/defaultRules.ts
└── theme.ts  # 已删除（HeroUI 用 CSS 变量）
```

## ★ HeroUI v3 真实 API（关键，与 v2/记忆不同）

### Tooltip（必须复合模式，无 content prop）
```tsx
<Tooltip delay={0}>
  <Button>trigger</Button>
  <Tooltip.Content placement="bottom">提示文字</Tooltip.Content>
</Tooltip>
```
- ❌ `<Tooltip content="x" placement="y">` 不存在
- placement 在 `Tooltip.Content` 上，值：top/bottom/left/right
- trigger 必须是 Tooltip 的第一个子元素

### Button（用 variant，无 color prop）
- variant 值：默认(primary) / secondary / tertiary / outline / ghost / danger / danger-soft
- ❌ `color="primary"` / `color="secondary"` 不存在
- 支持：isIconOnly, size, onPress, isDisabled, fullWidth
- 图标作为子元素直接放（无 startIcon）

### 其他已确认
- Spinner（替代 CircularProgress）
- ProgressBar / ProgressCircle（替代 LinearProgress）
- 无需 Provider（v3 废弃 HeroUIProvider）

## 已完成的迁移
**亲自迁移**：layout, theme(删), globals.css, page.tsx, SideBar, TabManager, TabContextMenu, RuleGroupPanel, DraftList, PathSelector, TestDataEditorWithTabs, DraftEditor
**Agent 迁移**（5 个并行）：
- Dialog 组：DownloadManagerDialog, GenerationRecordsDialog, AddToRuleGroupDialog, PathReplacementDialog
- Download 组：DownloadList, DownloadProgressBar, Aria2DownloadManager
- Editor 组：CodeMirrorEditor, CodeTestEditor, TestDataEditor, TestDataPage
- Misc 组：RuleGroupList, RuleGroupSelector, MaterialPreview, SnapshotManager
- Timeline+Pages：Timeline, editor/page, downloads/page

## 迁移策略（混合）
- HeroUI 基础组件（Button/Tooltip/Spinner/ProgressBar）→ 用 HeroUI
- 复杂容器（Box/Paper/Dialog/Tabs/Menu/Drawer/Grid/List）→ 自定义 Tailwind + CSS 变量
- 原因：避免 HeroUI v3 复杂组件 API 不确定导致返工

## Electron 移除（Phase 5 完成）
已删除：
- electron/ 目录（main.js, preload.js）
- scripts/build-electron.js（scripts/ 现已空）
- electron-builder.json
- src/types/electron.d.ts（新建 global.d.ts 声明 window.electron? 为可选）

保留（防御性降级代码，web 下 window.electron=undefined，可选链短路，零功能损失）：
- DraftList, PathSelector, Timeline: (window as any).electron
- Aria2DownloadManager, PathReplacementDialog: window.electron?.fs
这些代码在纯 web 下永不执行，保留比删除更安全（最小改动）。

## 配置变更
- next.config.ts：移除 output:'export' / assetPrefix / trailingSlash（Electron 静态导出）
- package.json：移除 @mui/* @emotion/* electron electron-builder concurrently cross-env wait-on autoprefixer file-loader css-loader；新增 @heroui/react @heroui/styles tailwind-variants lucide-react tailwindcss @tailwindcss/postcss
- postcss.config.js：仅 @tailwindcss/postcss

## 待验证（Phase 6）
- npm run build 是否通过
- 是否有遗漏的 @mui 引用
- HeroUI 组件 API 是否还有其他误用

## 注意事项
- React 19 peer dep 冲突：npm install --legacy-peer-deps（447 包已装）
- tsconfig ignoreBuildErrors + eslint ignoreDuringBuilds 已开（容忍迁移期错误）
- .heroui-docs/ 有完整离线文档可查组件示例
