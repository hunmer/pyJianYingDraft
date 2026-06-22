# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**pyJianYingDraft Web** 是剪映草稿文件的可视化编辑器前端应用，基于 Next.js 15 + React 19 + Material-UI 7 构建。它与 `pyJianYingDraftServer` FastAPI 后端配合，提供草稿文件的可视化展示、编辑和规则组测试功能。

**核心功能：**
- 草稿文件可视化：时间轴视图、轨道管理、素材预览
- 规则组编辑器：创建和测试草稿生成规则
- Python/JSON 代码编辑器（支持离线使用）
- 文件版本管理和差异对比
- Aria2 下载管理
- Electron 桌面应用支持（含后端服务集成）

## 开发环境

### 启动开发服务器

```bash
# 安装依赖
npm install

# 启动 Next.js 开发服务器
npm run dev
```

访问 http://localhost:3000

### 启动后端服务

后端服务必须运行才能使用完整功能：

```bash
# 在父目录的 pyJianYingDraftServer 中运行
cd ../pyJianYingDraftServer
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或使用快捷命令：
```bash
npm run run:backend
```

### Electron 桌面应用

```bash
# Windows 开发模式
npm run electron:dev:win

# macOS 开发模式
npm run electron:dev:macos

# 构建 Electron 应用
npm run electron:build

# 构建后端+前端完整应用
npm run build:all
```

## 技术架构

### 关键技术栈

- **Next.js 15 App Router**：React 服务端组件，文件路由
- **Material-UI 7**：UI 组件库，使用 `@mui/material-nextjs` 适配 Next.js
- **CodeMirror 6**：主要代码编辑器（Python/JSON），轻量级
- **Socket.IO**：实时通信（文件变更通知、下载进度）
- **Electron**：桌面应用框架，包含后端服务自动启动

### 项目结构

```
src/
├── app/                     # Next.js App Router 页面
│   ├── page.tsx            # 主页：草稿列表和规则组管理
│   ├── editor/page.tsx     # 编辑器页面（草稿可视化）
│   └── layout.tsx          # 根布局
├── components/             # React 组件
│   ├── CodeMirrorEditor.tsx       # Python/JSON 代码编辑器（主要）
│   ├── CodeTestEditor.tsx         # 规则组测试编辑器
│   ├── DraftList.tsx              # 草稿列表
│   ├── RuleGroupList.tsx          # 规则组列表
│   ├── FileVersionList.tsx        # 文件版本管理
│   ├── FileDiffViewer.tsx         # 差异对比
│   ├── Aria2DownloadManager.tsx   # 下载管理器
│   └── Timeline.tsx               # 时间轴编辑器
├── lib/                    # 工具库
│   ├── api.ts              # REST API 客户端封装
│   └── socket.ts           # WebSocket 客户端封装
├── types/                  # TypeScript 类型定义
│   ├── draft.ts            # 草稿相关类型
│   ├── rule.ts             # 规则组类型
│   └── aria2.ts            # Aria2 类型
├── hooks/                  # React Hooks
│   ├── useTaskProgress.ts  # 任务进度管理
│   └── useAria2WebSocket.ts # Aria2 WebSocket
├── config/                 # 配置文件
│   └── defaultRules.ts     # 默认规则组定义
└── theme.ts                # MUI 主题配置

electron/
├── main.js                 # Electron 主进程
└── preload.js             # 预加载脚本

public/                     # 静态资源
└── monaco-editor/         # Monaco Editor 本地文件（已废弃，现用 CodeMirror）
```

## API 集成架构

### REST API (`lib/api.ts`)

所有 API 调用统一封装在 `api.ts` 中，按功能分组：

- **draftApi**：草稿信息、列表、配置、规则组
- **materialsApi**：素材查询、统计
- **tracksApi**：轨道查询、统计
- **subdraftsApi**：复合片段查询
- **ruleTestApi**：规则组同步测试
- **tasksApi**：异步任务管理
- **fileWatchApi**：文件监控和版本管理
- **generationRecordsApi**：生成记录管理

**API 基础 URL**：通过环境变量 `NEXT_PUBLIC_API_URL` 配置（默认 `http://localhost:8000`）

### WebSocket API (`lib/socket.ts`)

使用 Socket.IO 处理实时通信：

- **文件变更通知**：`file_changed` 事件
- **文件版本查询**：`get_file_versions` / `file_versions`
- **版本内容查询**：`get_version_content` / `version_content`
- **Aria2 下载事件**：通过 `useAria2WebSocket` Hook 管理

**连接管理**：
- `getSocket()`：获取单例 Socket.IO 连接
- 自动重连机制（5 次重试，延迟递增）

## 关键功能实现

### 1. 规则组测试流程

规则组测试有两种模式：

**同步测试**（`ruleTestApi.runTest`）：
- 阻塞式请求，直接返回草稿路径
- 适用于小型测试，无需下载素材

**异步测试**（`tasksApi.submit` + `useTaskProgress`）：
- 提交任务获取 `task_id`
- 通过 Socket.IO 监听进度更新
- 支持素材下载进度跟踪
- 适用于大型任务、需要下载素材的场景

### 2. 文件版本管理

- **文件监控**：后端通过 `watchdog` 监听文件变化
- **版本存储**：每次变化保存快照到 `.versions/` 目录
- **差异对比**：使用 `diff2html` 渲染 unified diff 格式
- **版本查询**：通过 WebSocket 实时获取版本列表和内容

### 3. 代码编辑器

**主要编辑器**：CodeMirror 6 (`CodeMirrorEditor.tsx`)
- 支持语言：Python（`@codemirror/lang-python`）、JSON（`@codemirror/lang-json`）
- 功能：语法高亮、自动补全、搜索、折叠、Lint
- 主题：One Dark 主题（`@codemirror/theme-one-dark`）
- 离线可用，无需 CDN

**已废弃**：Monaco Editor（保留配置但不推荐使用）

### 4. Electron 桌面应用

**后端服务集成**：
- 生产环境：自动启动打包的 `pyJianYingDraftServer.exe`
- 开发环境：假设后端已手动启动
- 健康检查：启动前检测 `/health` 端点

**自定义协议**：
- `app-asset://` 协议用于加载本地资源（Monaco Editor 遗留）
- 注册在 `protocol.registerSchemesAsPrivileged`

## 常用开发任务

### 构建生产版本

```bash
# 仅构建前端
npm run build
npm start

# 构建 Electron 桌面应用（需要先构建后端）
npm run build:backend  # 构建后端可执行文件
npm run electron:build # 构建前端+打包 Electron
```

### 环境变量配置

复制 `.env.example` 为 `.env.local`：

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**注意**：Next.js 中只有 `NEXT_PUBLIC_` 前缀的变量会暴露到客户端。

### 类型定义更新

当后端 API 返回结构变化时，更新对应类型：

1. `types/draft.ts` - 草稿、轨道、素材、片段类型
2. `types/rule.ts` - 规则组、测试数据类型
3. `lib/api.ts` - 更新对应的 API 接口类型

## 重要约定

### 1. API 客户端使用

- **始终使用封装的 API 函数**，不要直接调用 `fetch`
- 错误处理统一通过 `handleResponse<T>` 函数
- 查询参数通过 `buildUrl` 函数构建

示例：
```typescript
import api from '@/lib/api';

// 获取草稿信息
const draftInfo = await api.draft.getInfo(filePath);

// 提交异步任务
const taskResponse = await api.tasks.submit(payload);
```

### 2. WebSocket 事件命名

- **请求事件**：动词 + 名词（如 `get_file_versions`）
- **响应事件**：名词复数（如 `file_versions`）
- **错误事件**：名词 + `_error`（如 `file_versions_error`）
- **通知事件**：名词 + `_changed`（如 `file_changed`）

### 3. 组件状态管理

- **本地状态**：使用 `useState` 管理组件内部状态
- **持久化状态**：使用 `localStorage`（如草稿路径、编辑器设置）
- **共享状态**：通过 props 传递或使用 Context（目前较少使用）

### 4. Material-UI 使用

- **Client Component**：所有使用 MUI 的组件必须标注 `'use client'`
- **主题配置**：在 `src/theme.ts` 中统一配置
- **响应式设计**：使用 `Grid2`、`Stack`、`sx` prop 实现

## 已知问题和限制

### React 19 兼容性

- **问题**：部分依赖（如 `@xzdarcy/react-timeline-editor`）未正式支持 React 19
- **解决方案**：使用 `npm install --legacy-peer-deps` 安装依赖
- **影响**：功能正常，但 npm 会有警告

### 跨域问题

- **本地开发**：确保后端 FastAPI 配置 CORS 允许 `http://localhost:3000`
- **生产环境**：后端需配置正确的 `allow_origins`

### 时间轴编辑器限制

- **当前状态**：只读模式，不支持拖拽编辑
- **计划**：未来支持片段拖拽、素材替换等编辑功能

## 开发注意事项

### 添加新 API 接口

1. 在 `lib/api.ts` 中添加接口函数
2. 在 `types/*.ts` 中定义相关类型
3. 更新此文档的 API 集成架构部分

### 添加新组件

1. 在 `components/` 中创建 `.tsx` 文件
2. 使用 TypeScript 和 Material-UI
3. 如需使用 MUI，添加 `'use client'` 指令
4. 导出命名组件（而非默认导出）

### 调试 WebSocket

Socket.IO 客户端已启用详细日志：
- 连接事件：`connect`、`disconnect`、`connect_error`
- 所有事件：通过 `socket.onAny()` 记录到控制台

检查控制台输出：
- `✅ WebSocket已连接`
- `📨 收到WebSocket事件: [eventName]`
- `⚠️ WebSocket连接错误: [error]`

## 相关项目

- **pyJianYingDraft**：Python 核心库（草稿生成逻辑）
- **pyJianYingDraftServer**：FastAPI 后端服务（REST API + WebSocket）
- **@xzdarcy/react-timeline-editor**：时间轴组件库
- **CodeMirror 6**：代码编辑器核心

<!-- HEROUI-REACT-AGENTS-MD-START -->
[HeroUI React v3 Docs Index]|root: ./.heroui-docs/react|STOP. What you remember about HeroUI React v3 is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --react --output AGENTS.md|.:{components\(buttons)\button-group.mdx,components\(buttons)\button.mdx,components\(buttons)\close-button.mdx,components\(buttons)\toggle-button-group.mdx,components\(buttons)\toggle-button.mdx,components\(collections)\dropdown.mdx,components\(collections)\list-box.mdx,components\(collections)\tag-group.mdx,components\(colors)\color-area.mdx,components\(colors)\color-field.mdx,components\(colors)\color-picker.mdx,components\(colors)\color-slider.mdx,components\(colors)\color-swatch-picker.mdx,components\(colors)\color-swatch.mdx,components\(controls)\slider.mdx,components\(controls)\switch.mdx,components\(data-display)\badge.mdx,components\(data-display)\chip.mdx,components\(data-display)\table.mdx,components\(date-and-time)\calendar.mdx,components\(date-and-time)\date-field.mdx,components\(date-and-time)\date-picker.mdx,components\(date-and-time)\date-range-picker.mdx,components\(date-and-time)\range-calendar.mdx,components\(date-and-time)\time-field.mdx,components\(feedback)\alert.mdx,components\(feedback)\meter.mdx,components\(feedback)\progress-bar.mdx,components\(feedback)\progress-circle.mdx,components\(feedback)\skeleton.mdx,components\(feedback)\spinner.mdx,components\(forms)\checkbox-group.mdx,components\(forms)\checkbox.mdx,components\(forms)\description.mdx,components\(forms)\error-message.mdx,components\(forms)\field-error.mdx,components\(forms)\fieldset.mdx,components\(forms)\form.mdx,components\(forms)\input-group.mdx,components\(forms)\input-otp.mdx,components\(forms)\input.mdx,components\(forms)\label.mdx,components\(forms)\number-field.mdx,components\(forms)\radio-group.mdx,components\(forms)\search-field.mdx,components\(forms)\text-area.mdx,components\(forms)\text-field.mdx,components\(layout)\card.mdx,components\(layout)\separator.mdx,components\(layout)\surface.mdx,components\(layout)\toolbar.mdx,components\(media)\avatar.mdx,components\(navigation)\accordion.mdx,components\(navigation)\breadcrumbs.mdx,components\(navigation)\disclosure-group.mdx,components\(navigation)\disclosure.mdx,components\(navigation)\link.mdx,components\(navigation)\pagination.mdx,components\(navigation)\tabs.mdx,components\(overlays)\alert-dialog.mdx,components\(overlays)\drawer.mdx,components\(overlays)\modal.mdx,components\(overlays)\popover.mdx,components\(overlays)\toast.mdx,components\(overlays)\tooltip.mdx,components\(pickers)\autocomplete.mdx,components\(pickers)\combo-box.mdx,components\(pickers)\select.mdx,components\(typography)\kbd.mdx,components\(typography)\typography.mdx,components\(utilities)\scroll-shadow.mdx,components\index.mdx,getting-started\(handbook)\animation.mdx,getting-started\(handbook)\colors.mdx,getting-started\(handbook)\composition.mdx,getting-started\(handbook)\dark-mode.mdx,getting-started\(handbook)\styling.mdx,getting-started\(handbook)\theming.mdx,getting-started\(overview)\cli.mdx,getting-started\(overview)\design-principles.mdx,getting-started\(overview)\frameworks.mdx,getting-started\(overview)\quick-start.mdx,getting-started\(ui-for-agents)\agent-skills.mdx,getting-started\(ui-for-agents)\agents-md.mdx,getting-started\(ui-for-agents)\llms-txt.mdx,getting-started\(ui-for-agents)\mcp-server.mdx,getting-started\index.mdx,releases\index.mdx,releases\v3-0-0-alpha-32.mdx,releases\v3-0-0-alpha-33.mdx,releases\v3-0-0-alpha-34.mdx,releases\v3-0-0-alpha-35.mdx,releases\v3-0-0-beta-1.mdx,releases\v3-0-0-beta-2.mdx,releases\v3-0-0-beta-3.mdx,releases\v3-0-0-beta-4.mdx,releases\v3-0-0-beta-6.mdx,releases\v3-0-0-beta-7.mdx,releases\v3-0-0-beta-8.mdx,releases\v3-0-0-rc-1.mdx,releases\v3-0-0.mdx,releases\v3-0-2.mdx,releases\v3-0-3.mdx,releases\v3-0-4.mdx,releases\v3-0-5.mdx,releases\v3-1-0.mdx,releases\v3-2-0.mdx,releases\v3-2-1.mdx}|demos/.:{cn\accordion\basic.tsx,cn\accordion\controlled.tsx,cn\accordion\custom-indicator.tsx,cn\accordion\custom-render-function.tsx,cn\accordion\custom-styles.tsx,cn\accordion\disabled.tsx,cn\accordion\faq.tsx,cn\accordion\multiple.tsx,cn\accordion\surface.tsx,cn\accordion\without-separator.tsx,cn\alert-dialog\backdrop-variants.tsx,cn\alert-dialog\close-methods.tsx,cn\alert-dialog\controlled.tsx,cn\alert-dialog\custom-animations.tsx,cn\alert-dialog\custom-backdrop.tsx,cn\alert-dialog\custom-icon.tsx,cn\alert-dialog\custom-portal.tsx,cn\alert-dialog\custom-trigger.tsx,cn\alert-dialog\default.tsx,cn\alert-dialog\dismiss-behavior.tsx,cn\alert-dialog\placements.tsx,cn\alert-dialog\sizes.tsx,cn\alert-dialog\statuses.tsx,cn\alert-dialog\with-close-button.tsx,cn\alert\basic.tsx,cn\autocomplete\allows-empty-collection.tsx,cn\autocomplete\asynchronous-filtering.tsx,cn\autocomplete\controlled-open-state.tsx,cn\autocomplete\controlled.tsx,cn\autocomplete\custom-indicator.tsx,cn\autocomplete\default.tsx,cn\autocomplete\disabled.tsx,cn\autocomplete\email-recipients.tsx,cn\autocomplete\full-width.tsx,cn\autocomplete\location-search.tsx,cn\autocomplete\multiple-select.tsx,cn\autocomplete\required.tsx,cn\autocomplete\single-select.tsx,cn\autocomplete\tag-group-selection.tsx,cn\autocomplete\user-selection-multiple.tsx,cn\autocomplete\user-selection.tsx,cn\autocomplete\variants.tsx,cn\autocomplete\virtualization.tsx,cn\autocomplete\with-description.tsx,cn\autocomplete\with-disabled-options.tsx,cn\autocomplete\with-sections.tsx,cn\avatar\basic.tsx,cn\avatar\colors.tsx,cn\avatar\custom-styles.tsx,cn\avatar\fallback.tsx,cn\avatar\group.tsx,cn\avatar\sizes.tsx,cn\avatar\variants.tsx,cn\badge\basic.tsx,cn\badge\colors.tsx,cn\badge\dot.tsx,cn\badge\placements.tsx,cn\badge\sizes.tsx,cn\badge\variants.tsx,cn\badge\with-content.tsx,cn\breadcrumbs\basic.tsx,cn\breadcrumbs\custom-render-function.tsx,cn\breadcrumbs\custom-separator.tsx,cn\breadcrumbs\disabled.tsx,cn\breadcrumbs\level-2.tsx,cn\breadcrumbs\level-3.tsx,cn\button-group\basic.tsx,cn\button-group\disabled.tsx,cn\button-group\full-width.tsx,cn\button-group\orientation.tsx,cn\button-group\sizes.tsx,cn\button-group\variants.tsx,cn\button-group\with-icons.tsx,cn\button-group\without-separator.tsx,cn\button\basic.tsx,cn\button\custom-render-function.tsx,cn\button\custom-variants.tsx,cn\button\disabled.tsx,cn\button\full-width.tsx,cn\button\icon-only.tsx,cn\button\loading-state.tsx,cn\button\loading.tsx,cn\button\outline-variant.tsx,cn\button\ripple-effect.tsx,cn\button\sizes.tsx,cn\button\social.tsx,cn\button\variants.tsx,cn\button\with-icons.tsx,cn\calendar\basic.tsx,cn\calendar\booking-calendar.tsx,cn\calendar\controlled.tsx,cn\calendar\custom-icons.tsx,cn\calendar\custom-styles.tsx,cn\calendar\day-view.tsx,cn\calendar\default-value.tsx,cn\calendar\disabled.tsx,cn\calendar\focused-value.tsx,cn\calendar\international-calendar.tsx,cn\calendar\min-max-dates.tsx,cn\calendar\multiple-months.tsx,cn\calendar\multiple-selection.tsx,cn\calendar\read-only.tsx,cn\calendar\unavailable-dates.tsx,cn\calendar\week-view.tsx,cn\calendar\weeks-in-month.tsx,cn\calendar\with-indicators.tsx,cn\calendar\year-picker.tsx,cn\card\default.tsx,cn\card\horizontal.tsx,cn\card\variants.tsx,cn\card\with-avatar.tsx,cn\card\with-form.tsx,cn\card\with-images.tsx,cn\checkbox-group\basic.tsx,cn\checkbox-group\controlled.tsx,cn\checkbox-group\custom-render-function.tsx,cn\checkbox-group\disabled.tsx,cn\checkbox-group\features-and-addons.tsx,cn\checkbox-group\indeterminate.tsx,cn\checkbox-group\on-surface.tsx,cn\checkbox-group\validation.tsx,cn\checkbox-group\with-custom-indicator.tsx,cn\checkbox\basic.tsx,cn\checkbox\controlled.tsx,cn\checkbox\custom-indicator.tsx,cn\checkbox\custom-render-function.tsx,cn\checkbox\custom-styles.tsx,cn\checkbox\default-selected.tsx,cn\checkbox\disabled.tsx,cn\checkbox\external-label.tsx,cn\checkbox\form.tsx,cn\checkbox\full-rounded.tsx,cn\checkbox\indeterminate.tsx,cn\checkbox\invalid.tsx,cn\checkbox\render-props.tsx,cn\checkbox\variants.tsx,cn\checkbox\with-description.tsx,cn\chip\basic.tsx,cn\chip\statuses.tsx,cn\chip\variants.tsx,cn\chip\vibrant-palette.tsx,cn\chip\with-icon.tsx,cn\close-button\default.tsx,cn\close-button\interactive.tsx,cn\close-button\variants.tsx,cn\close-button\with-custom-icon.tsx,cn\color-area\basic.tsx,cn\color-area\controlled.tsx,cn\color-area\custom-render-function.tsx,cn\color-area\disabled.tsx,cn\color-area\space-and-channels.tsx,cn\color-area\with-dots.tsx,cn\color-field\basic.tsx,cn\color-field\channel-editing.tsx,cn\color-field\controlled.tsx,cn\color-field\custom-render-function.tsx,cn\color-field\disabled.tsx,cn\color-field\form-example.tsx,cn\color-field\full-width.tsx,cn\color-field\invalid.tsx,cn\color-field\on-surface.tsx,cn\color-field\required.tsx,cn\color-field\variants.tsx,cn\color-field\with-description.tsx,cn\color-picker\basic.tsx,cn\color-picker\controlled.tsx,cn\color-picker\with-fields.tsx,cn\color-picker\with-sliders.tsx,cn\color-picker\with-swatches.tsx,cn\color-slider\alpha-channel.tsx,cn\color-slider\basic.tsx,cn\color-slider\channels.tsx,cn\color-slider\controlled.tsx,cn\color-slider\custom-render-function.tsx,cn\color-slider\disabled.tsx,cn\color-slider\rgb-channels.tsx,cn\color-slider\vertical.tsx,cn\color-swatch-picker\basic.tsx,cn\color-swatch-picker\controlled.tsx,cn\color-swatch-picker\custom-indicator.tsx,cn\color-swatch-picker\custom-render-function.tsx,cn\color-swatch-picker\default-value.tsx,cn\color-swatch-picker\disabled.tsx,cn\color-swatch-picker\sizes.tsx,cn\color-swatch-picker\stack-layout.tsx,cn\color-swatch-picker\variants.tsx,cn\color-swatch\accessibility.tsx,cn\color-swatch\basic.tsx,cn\color-swatch\custom-render-function.tsx,cn\color-swatch\custom-styles.tsx,cn\color-swatch\shapes.tsx,cn\color-swatch\sizes.tsx,cn\color-swatch\transparency.tsx,cn\combo-box\allows-custom-value.tsx,cn\combo-box\asynchronous-loading.tsx,cn\combo-box\controlled-input-value.tsx,cn\combo-box\controlled.tsx,cn\combo-box\custom-filtering.tsx,cn\combo-box\custom-indicator.tsx,cn\combo-box\custom-render-function.tsx,cn\combo-box\custom-value.tsx,cn\combo-box\default-selected-key.tsx,cn\combo-box\default.tsx,cn\combo-box\disabled.tsx,cn\combo-box\full-width.tsx,cn\combo-box\menu-trigger.tsx,cn\combo-box\on-surface.tsx,cn\combo-box\required.tsx,cn\combo-box\with-description.tsx,cn\combo-box\with-disabled-options.tsx,cn\combo-box\with-sections.tsx,cn\date-field\basic.tsx,cn\date-field\controlled.tsx,cn\date-field\custom-render-function.tsx,cn\date-field\disabled.tsx,cn\date-field\form-example.tsx,cn\date-field\full-width.tsx,cn\date-field\granularity.tsx,cn\date-field\invalid.tsx,cn\date-field\on-surface.tsx,cn\date-field\required.tsx,cn\date-field\variants.tsx,cn\date-field\with-description.tsx,cn\date-field\with-prefix-and-suffix.tsx,cn\date-field\with-prefix-icon.tsx,cn\date-field\with-suffix-icon.tsx,cn\date-field\with-validation.tsx,cn\date-picker\basic.tsx,cn\date-picker\controlled.tsx,cn\date-picker\custom-render-function.tsx,cn\date-picker\disabled.tsx,cn\date-picker\form-example.tsx,cn\date-picker\format-options-no-ssr.tsx,cn\date-picker\format-options.tsx,cn\date-picker\international-calendar.tsx,cn\date-picker\with-custom-indicator.tsx,cn\date-picker\with-validation.tsx,cn\date-range-picker\basic.tsx,cn\date-range-picker\controlled.tsx,cn\date-range-picker\custom-render-function.tsx,cn\date-range-picker\disabled.tsx,cn\date-range-picker\form-example.tsx,cn\date-range-picker\format-options-no-ssr.tsx,cn\date-range-picker\format-options.tsx,cn\date-range-picker\input-container.tsx,cn\date-range-picker\international-calendar.tsx,cn\date-range-picker\with-custom-indicator.tsx,cn\date-range-picker\with-validation.tsx,cn\description\basic.tsx,cn\disclosure-group\basic.tsx,cn\disclosure-group\controlled.tsx,cn\disclosure\basic.tsx,cn\disclosure\custom-render-function.tsx,cn\drawer\backdrop-variants.tsx,cn\drawer\basic.tsx,cn\drawer\controlled.tsx,cn\drawer\navigation.tsx,cn\drawer\non-dismissable.tsx,cn\drawer\placements.tsx,cn\drawer\scrollable-content.tsx,cn\drawer\with-form.tsx,cn\dropdown\controlled-open-state.tsx,cn\dropdown\controlled.tsx,cn\dropdown\custom-trigger.tsx,cn\dropdown\default.tsx,cn\dropdown\long-press-trigger.tsx,cn\dropdown\single-with-custom-indicator.tsx,cn\dropdown\with-custom-submenu-indicator.tsx,cn\dropdown\with-descriptions.tsx,cn\dropdown\with-disabled-items.tsx,cn\dropdown\with-icons.tsx,cn\dropdown\with-keyboard-shortcuts.tsx,cn\dropdown\with-multiple-selection.tsx,cn\dropdown\with-section-level-selection.tsx,cn\dropdown\with-sections.tsx,cn\dropdown\with-single-selection.tsx,cn\dropdown\with-submenus.tsx,cn\error-message\basic.tsx,cn\error-message\with-tag-group.tsx,cn\field-error\basic.tsx,cn\fieldset\basic.tsx,cn\fieldset\on-surface.tsx,cn\form\basic.tsx,cn\form\custom-render-function.tsx,cn\input-group\default.tsx,cn\input-group\disabled.tsx,cn\input-group\full-width.tsx,cn\input-group\invalid.tsx,cn\input-group\on-surface.tsx,cn\input-group\password-with-toggle.tsx,cn\input-group\required.tsx,cn\input-group\variants.tsx,cn\input-group\with-badge-suffix.tsx,cn\input-group\with-copy-suffix.tsx,cn\input-group\with-icon-prefix-and-copy-suffix.tsx,cn\input-group\with-icon-prefix-and-text-suffix.tsx,cn\input-group\with-keyboard-shortcut.tsx,cn\input-group\with-loading-suffix.tsx,cn\input-group\with-prefix-and-suffix.tsx,cn\input-group\with-prefix-icon.tsx,cn\input-group\with-suffix-icon.tsx,cn\input-group\with-text-prefix.tsx,cn\input-group\with-text-suffix.tsx,cn\input-group\with-textarea.tsx,cn\input-otp\basic.tsx,cn\input-otp\controlled.tsx,cn\input-otp\disabled.tsx,cn\input-otp\form-example.tsx,cn\input-otp\four-digits.tsx,cn\input-otp\on-complete.tsx,cn\input-otp\on-surface.tsx,cn\input-otp\variants.tsx,cn\input-otp\with-pattern.tsx,cn\input-otp\with-validation.tsx,cn\input\basic.tsx,cn\input\controlled.tsx,cn\input\full-width.tsx,cn\input\on-surface.tsx,cn\input\types.tsx,cn\input\variants.tsx,cn\kbd\basic.tsx,cn\kbd\inline.tsx,cn\kbd\instructional.tsx,cn\kbd\navigation.tsx,cn\kbd\special.tsx,cn\kbd\variants.tsx,cn\label\basic.tsx,cn\link\basic.tsx,cn\link\custom-icon.tsx,cn\link\custom-render-function.tsx,cn\link\icon-placement.tsx,cn\link\underline-and-offset.tsx,cn\link\underline-offset.tsx,cn\link\underline-variants.tsx,cn\list-box\controlled.tsx,cn\list-box\custom-check-icon.tsx,cn\list-box\custom-render-function.tsx,cn\list-box\default.tsx,cn\list-box\multi-select.tsx,cn\list-box\scrollbar-modes.tsx,cn\list-box\virtualization.tsx,cn\list-box\with-disabled-items.tsx,cn\list-box\with-sections.tsx,cn\meter\basic.tsx,cn\meter\colors.tsx,cn\meter\custom-value.tsx,cn\meter\sizes.tsx,cn\meter\without-label.tsx,cn\modal\backdrop-variants.tsx,cn\modal\close-methods.tsx,cn\modal\controlled.tsx,cn\modal\custom-animations.tsx,cn\modal\custom-backdrop.tsx,cn\modal\custom-portal.tsx,cn\modal\custom-trigger.tsx,cn\modal\default.tsx,cn\modal\dismiss-behavior.tsx,cn\modal\placements.tsx,cn\modal\scroll-comparison.tsx,cn\modal\sizes.tsx,cn\modal\with-form.tsx,cn\number-field\basic.tsx,cn\number-field\controlled.tsx,cn\number-field\custom-icons.tsx,cn\number-field\custom-render-function.tsx,cn\number-field\disabled.tsx,cn\number-field\form-example.tsx,cn\number-field\full-width.tsx,cn\number-field\on-surface.tsx,cn\number-field\required.tsx,cn\number-field\validation.tsx,cn\number-field\variants.tsx,cn\number-field\with-chevrons.tsx,cn\number-field\with-description.tsx,cn\number-field\with-format-options.tsx,cn\number-field\with-step.tsx,cn\number-field\with-validation.tsx,cn\pagination\basic.tsx,cn\pagination\controlled.tsx,cn\pagination\custom-icons.tsx,cn\pagination\disabled.tsx,cn\pagination\simple-prev-next.tsx,cn\pagination\sizes.tsx,cn\pagination\with-ellipsis.tsx,cn\pagination\with-summary.tsx,cn\popover\basic.tsx,cn\popover\custom-render-function.tsx,cn\popover\interactive.tsx,cn\popover\placement.tsx,cn\popover\with-arrow.tsx,cn\progress-bar\basic.tsx,cn\progress-bar\colors.tsx,cn\progress-bar\custom-value.tsx,cn\progress-bar\indeterminate.tsx,cn\progress-bar\sizes.tsx,cn\progress-bar\without-label.tsx,cn\progress-circle\basic.tsx,cn\progress-circle\colors.tsx,cn\progress-circle\custom-svg.tsx,cn\progress-circle\indeterminate.tsx,cn\progress-circle\sizes.tsx,cn\progress-circle\with-label.tsx,cn\radio-group\basic.tsx,cn\radio-group\controlled.tsx,cn\radio-group\custom-indicator.tsx,cn\radio-group\custom-render-function.tsx,cn\radio-group\delivery-and-payment.tsx,cn\radio-group\disabled.tsx,cn\radio-group\horizontal.tsx,cn\radio-group\on-surface.tsx,cn\radio-group\uncontrolled.tsx,cn\radio-group\validation.tsx,cn\radio-group\variants.tsx,cn\range-calendar\allows-non-contiguous-ranges.tsx,cn\range-calendar\anchor-unavailable-dates.tsx,cn\range-calendar\basic.tsx,cn\range-calendar\booking-calendar.tsx,cn\range-calendar\controlled.tsx,cn\range-calendar\day-view.tsx,cn\range-calendar\default-value.tsx,cn\range-calendar\disabled.tsx,cn\range-calendar\focused-value.tsx,cn\range-calendar\international-calendar.tsx,cn\range-calendar\invalid.tsx,cn\range-calendar\min-max-dates.tsx,cn\range-calendar\multiple-months.tsx,cn\range-calendar\read-only.tsx,cn\range-calendar\three-months.tsx,cn\range-calendar\unavailable-dates.tsx,cn\range-calendar\week-view.tsx,cn\range-calendar\weeks-in-month.tsx,cn\range-calendar\with-indicators.tsx,cn\range-calendar\year-picker.tsx,cn\scroll-shadow\custom-size.tsx,cn\scroll-shadow\default.tsx,cn\scroll-shadow\hide-scroll-bar.tsx,cn\scroll-shadow\orientation.tsx,cn\scroll-shadow\visibility-change.tsx,cn\scroll-shadow\with-card.tsx,cn\search-field\basic.tsx,cn\search-field\controlled.tsx,cn\search-field\custom-icons.tsx,cn\search-field\custom-render-function.tsx,cn\search-field\disabled.tsx,cn\search-field\form-example.tsx,cn\search-field\full-width.tsx,cn\search-field\on-surface.tsx,cn\search-field\required.tsx,cn\search-field\validation.tsx,cn\search-field\variants.tsx,cn\search-field\with-description.tsx,cn\search-field\with-keyboard-shortcut.tsx,cn\search-field\with-validation.tsx,cn\select\asynchronous-loading.tsx,cn\select\controlled-multiple.tsx,cn\select\controlled-open-state.tsx,cn\select\controlled.tsx,cn\select\custom-indicator.tsx,cn\select\custom-render-function.tsx,cn\select\custom-value-multiple.tsx,cn\select\custom-value.tsx,cn\select\default.tsx,cn\select\disabled.tsx,cn\select\full-width.tsx,cn\select\multiple-select.tsx,cn\select\on-surface.tsx,cn\select\required.tsx,cn\select\variants.tsx,cn\select\with-description.tsx,cn\select\with-disabled-options.tsx,cn\select\with-sections.tsx,cn\separator\basic.tsx,cn\separator\custom-render-function.tsx,cn\separator\manual-variant-override.tsx,cn\separator\variants.tsx,cn\separator\vertical.tsx,cn\separator\with-content.tsx,cn\separator\with-surface.tsx,cn\skeleton\animation-types.tsx,cn\skeleton\basic.tsx,cn\skeleton\card.tsx,cn\skeleton\grid.tsx,cn\skeleton\list.tsx,cn\skeleton\single-shimmer.tsx,cn\skeleton\text-content.tsx,cn\skeleton\user-profile.tsx,cn\slider\custom-render-function.tsx,cn\slider\default.tsx,cn\slider\disabled.tsx,cn\slider\range.tsx,cn\slider\vertical.tsx,cn\spinner\basic.tsx,cn\spinner\colors.tsx,cn\spinner\sizes.tsx,cn\surface\variants.tsx,cn\switch\basic.tsx,cn\switch\controlled.tsx,cn\switch\custom-render-function.tsx,cn\switch\custom-styles.tsx,cn\switch\default-selected.tsx,cn\switch\disabled.tsx,cn\switch\form.tsx,cn\switch\group-horizontal.tsx,cn\switch\group.tsx,cn\switch\label-position.tsx,cn\switch\render-props.tsx,cn\switch\sizes.tsx,cn\switch\with-description.tsx,cn\switch\with-icons.tsx,cn\switch\without-label.tsx,cn\table\async-loading.tsx,cn\table\basic.tsx,cn\table\column-resizing.tsx,cn\table\custom-cells.tsx,cn\table\empty-state.tsx,cn\table\expandable-rows.tsx,cn\table\pagination.tsx,cn\table\secondary-variant.tsx,cn\table\selection.tsx,cn\table\sorting.tsx,cn\table\tanstack-table.tsx,cn\table\virtualization.tsx,cn\tabs\basic.tsx,cn\tabs\custom-render-function.tsx,cn\tabs\custom-styles.tsx,cn\tabs\disabled.tsx,cn\tabs\secondary-vertical.tsx,cn\tabs\secondary.tsx,cn\tabs\vertical.tsx,cn\tabs\with-separator.tsx,cn\tag-group\basic.tsx,cn\tag-group\controlled.tsx,cn\tag-group\custom-render-function.tsx,cn\tag-group\disabled.tsx,cn\tag-group\selection-modes.tsx,cn\tag-group\sizes.tsx,cn\tag-group\variants.tsx,cn\tag-group\with-error-message.tsx,cn\tag-group\with-list-data.tsx,cn\tag-group\with-prefix.tsx,cn\tag-group\with-remove-button.tsx,cn\textarea\basic.tsx,cn\textarea\controlled.tsx,cn\textarea\full-width.tsx,cn\textarea\on-surface.tsx,cn\textarea\rows.tsx,cn\textarea\variants.tsx,cn\textfield\basic.tsx,cn\textfield\controlled.tsx,cn\textfield\custom-render-function.tsx,cn\textfield\disabled.tsx,cn\textfield\full-width.tsx,cn\textfield\input-types.tsx,cn\textfield\on-surface.tsx,cn\textfield\required.tsx,cn\textfield\textarea.tsx,cn\textfield\validation.tsx,cn\textfield\with-description.tsx,cn\textfield\with-error.tsx,cn\time-field\basic.tsx,cn\time-field\controlled.tsx,cn\time-field\custom-render-function.tsx,cn\time-field\disabled.tsx,cn\time-field\form-example.tsx,cn\time-field\full-width.tsx,cn\time-field\invalid.tsx,cn\time-field\on-surface.tsx,cn\time-field\required.tsx,cn\time-field\with-description.tsx,cn\time-field\with-prefix-and-suffix.tsx,cn\time-field\with-prefix-icon.tsx,cn\time-field\with-suffix-icon.tsx,cn\time-field\with-validation.tsx,cn\toast\callbacks.tsx,cn\toast\custom-indicator.tsx,cn\toast\custom-queue.tsx,cn\toast\custom-toast.tsx,cn\toast\default.tsx,cn\toast\placements.tsx,cn\toast\promise.tsx,cn\toast\simple.tsx,cn\toast\variants.tsx,cn\toggle-button-group\attached.tsx,cn\toggle-button-group\basic.tsx,cn\toggle-button-group\controlled.tsx,cn\toggle-button-group\disabled.tsx,cn\toggle-button-group\full-width.tsx,cn\toggle-button-group\orientation.tsx,cn\toggle-button-group\selection-mode.tsx,cn\toggle-button-group\sizes.tsx,cn\toggle-button-group\without-separator.tsx,cn\toggle-button\basic.tsx,cn\toggle-button\controlled.tsx,cn\toggle-button\disabled.tsx,cn\toggle-button\icon-only.tsx,cn\toggle-button\sizes.tsx,cn\toggle-button\variants.tsx,cn\toolbar\basic.tsx,cn\toolbar\custom-styles.tsx,cn\toolbar\vertical.tsx,cn\toolbar\with-button-group.tsx,cn\tooltip\basic.tsx,cn\tooltip\custom-render-function.tsx,cn\tooltip\custom-trigger.tsx,cn\tooltip\placement.tsx,cn\tooltip\with-arrow.tsx,cn\typography\default.tsx,cn\typography\primitives.tsx,cn\typography\prose.tsx,cn\typography\render-props.tsx,cn\typography\typography-scale.tsx,en\accordion\basic.tsx,en\accordion\controlled.tsx,en\accordion\custom-indicator.tsx,en\accordion\custom-render-function.tsx,en\accordion\custom-styles.tsx,en\accordion\disabled.tsx,en\accordion\faq.tsx,en\accordion\multiple.tsx,en\accordion\surface.tsx,en\accordion\without-separator.tsx,en\alert-dialog\backdrop-variants.tsx,en\alert-dialog\close-methods.tsx,en\alert-dialog\controlled.tsx,en\alert-dialog\custom-animations.tsx,en\alert-dialog\custom-backdrop.tsx,en\alert-dialog\custom-icon.tsx,en\alert-dialog\custom-portal.tsx,en\alert-dialog\custom-trigger.tsx,en\alert-dialog\default.tsx,en\alert-dialog\dismiss-behavior.tsx,en\alert-dialog\placements.tsx,en\alert-dialog\sizes.tsx,en\alert-dialog\statuses.tsx,en\alert-dialog\with-close-button.tsx,en\alert\basic.tsx,en\autocomplete\allows-empty-collection.tsx,en\autocomplete\asynchronous-filtering.tsx,en\autocomplete\controlled-open-state.tsx,en\autocomplete\controlled.tsx,en\autocomplete\custom-indicator.tsx,en\autocomplete\default.tsx,en\autocomplete\disabled.tsx,en\autocomplete\email-recipients.tsx,en\autocomplete\full-width.tsx,en\autocomplete\location-search.tsx,en\autocomplete\multiple-select.tsx,en\autocomplete\required.tsx,en\autocomplete\single-select.tsx,en\autocomplete\tag-group-selection.tsx,en\autocomplete\user-selection-multiple.tsx,en\autocomplete\user-selection.tsx,en\autocomplete\variants.tsx,en\autocomplete\virtualization.tsx,en\autocomplete\with-description.tsx,en\autocomplete\with-disabled-options.tsx,en\autocomplete\with-sections.tsx,en\avatar\basic.tsx,en\avatar\colors.tsx,en\avatar\custom-styles.tsx,en\avatar\fallback.tsx,en\avatar\group.tsx,en\avatar\sizes.tsx,en\avatar\variants.tsx,en\badge\basic.tsx,en\badge\colors.tsx,en\badge\dot.tsx,en\badge\placements.tsx,en\badge\sizes.tsx,en\badge\variants.tsx,en\badge\with-content.tsx,en\breadcrumbs\basic.tsx,en\breadcrumbs\custom-render-function.tsx,en\breadcrumbs\custom-separator.tsx,en\breadcrumbs\disabled.tsx,en\breadcrumbs\level-2.tsx,en\breadcrumbs\level-3.tsx,en\button-group\basic.tsx,en\button-group\disabled.tsx,en\button-group\full-width.tsx,en\button-group\orientation.tsx,en\button-group\sizes.tsx,en\button-group\variants.tsx,en\button-group\with-icons.tsx,en\button-group\without-separator.tsx,en\button\basic.tsx,en\button\custom-render-function.tsx,en\button\custom-variants.tsx,en\button\disabled.tsx,en\button\full-width.tsx,en\button\icon-only.tsx,en\button\loading-state.tsx,en\button\loading.tsx,en\button\outline-variant.tsx,en\button\ripple-effect.tsx,en\button\sizes.tsx,en\button\social.tsx,en\button\variants.tsx,en\button\with-icons.tsx,en\calendar\basic.tsx,en\calendar\booking-calendar.tsx,en\calendar\controlled.tsx,en\calendar\custom-icons.tsx,en\calendar\custom-styles.tsx,en\calendar\day-view.tsx,en\calendar\default-value.tsx,en\calendar\disabled.tsx,en\calendar\focused-value.tsx,en\calendar\international-calendar.tsx,en\calendar\min-max-dates.tsx,en\calendar\multiple-months.tsx,en\calendar\multiple-selection.tsx,en\calendar\read-only.tsx,en\calendar\unavailable-dates.tsx,en\calendar\week-view.tsx,en\calendar\weeks-in-month.tsx,en\calendar\with-indicators.tsx,en\calendar\year-picker.tsx,en\card\default.tsx,en\card\horizontal.tsx,en\card\variants.tsx,en\card\with-avatar.tsx,en\card\with-form.tsx,en\card\with-images.tsx,en\checkbox-group\basic.tsx,en\checkbox-group\controlled.tsx,en\checkbox-group\custom-render-function.tsx,en\checkbox-group\disabled.tsx,en\checkbox-group\features-and-addons.tsx,en\checkbox-group\indeterminate.tsx,en\checkbox-group\on-surface.tsx,en\checkbox-group\validation.tsx,en\checkbox-group\with-custom-indicator.tsx,en\checkbox\basic.tsx,en\checkbox\controlled.tsx,en\checkbox\custom-indicator.tsx,en\checkbox\custom-render-function.tsx,en\checkbox\custom-styles.tsx,en\checkbox\default-selected.tsx,en\checkbox\disabled.tsx,en\checkbox\external-label.tsx,en\checkbox\form.tsx,en\checkbox\full-rounded.tsx,en\checkbox\indeterminate.tsx,en\checkbox\invalid.tsx,en\checkbox\render-props.tsx,en\checkbox\variants.tsx,en\checkbox\with-description.tsx,en\chip\basic.tsx,en\chip\statuses.tsx,en\chip\variants.tsx,en\chip\vibrant-palette.tsx,en\chip\with-icon.tsx,en\close-button\default.tsx,en\close-button\interactive.tsx,en\close-button\variants.tsx,en\close-button\with-custom-icon.tsx,en\color-area\basic.tsx,en\color-area\controlled.tsx,en\color-area\custom-render-function.tsx,en\color-area\disabled.tsx,en\color-area\space-and-channels.tsx,en\color-area\with-dots.tsx,en\color-field\basic.tsx,en\color-field\channel-editing.tsx,en\color-field\controlled.tsx,en\color-field\custom-render-function.tsx,en\color-field\disabled.tsx,en\color-field\form-example.tsx,en\color-field\full-width.tsx,en\color-field\invalid.tsx,en\color-field\on-surface.tsx,en\color-field\required.tsx,en\color-field\variants.tsx,en\color-field\with-description.tsx,en\color-picker\basic.tsx,en\color-picker\controlled.tsx,en\color-picker\with-fields.tsx,en\color-picker\with-sliders.tsx,en\color-picker\with-swatches.tsx,en\color-slider\alpha-channel.tsx,en\color-slider\basic.tsx,en\color-slider\channels.tsx,en\color-slider\controlled.tsx,en\color-slider\custom-render-function.tsx,en\color-slider\disabled.tsx,en\color-slider\rgb-channels.tsx,en\color-slider\vertical.tsx,en\color-swatch-picker\basic.tsx,en\color-swatch-picker\controlled.tsx,en\color-swatch-picker\custom-indicator.tsx,en\color-swatch-picker\custom-render-function.tsx,en\color-swatch-picker\default-value.tsx,en\color-swatch-picker\disabled.tsx,en\color-swatch-picker\sizes.tsx,en\color-swatch-picker\stack-layout.tsx,en\color-swatch-picker\variants.tsx,en\color-swatch\accessibility.tsx,en\color-swatch\basic.tsx,en\color-swatch\custom-render-function.tsx,en\color-swatch\custom-styles.tsx,en\color-swatch\shapes.tsx,en\color-swatch\sizes.tsx,en\color-swatch\transparency.tsx,en\combo-box\allows-custom-value.tsx,en\combo-box\asynchronous-loading.tsx,en\combo-box\controlled-input-value.tsx,en\combo-box\controlled.tsx,en\combo-box\custom-filtering.tsx,en\combo-box\custom-indicator.tsx,en\combo-box\custom-render-function.tsx,en\combo-box\custom-value.tsx,en\combo-box\default-selected-key.tsx,en\combo-box\default.tsx,en\combo-box\disabled.tsx,en\combo-box\full-width.tsx,en\combo-box\menu-trigger.tsx,en\combo-box\on-surface.tsx,en\combo-box\required.tsx,en\combo-box\with-description.tsx,en\combo-box\with-disabled-options.tsx,en\combo-box\with-sections.tsx,en\date-field\basic.tsx,en\date-field\controlled.tsx,en\date-field\custom-render-function.tsx,en\date-field\disabled.tsx,en\date-field\form-example.tsx,en\date-field\full-width.tsx,en\date-field\granularity.tsx,en\date-field\invalid.tsx,en\date-field\on-surface.tsx,en\date-field\required.tsx,en\date-field\variants.tsx,en\date-field\with-description.tsx,en\date-field\with-prefix-and-suffix.tsx,en\date-field\with-prefix-icon.tsx,en\date-field\with-suffix-icon.tsx,en\date-field\with-validation.tsx,en\date-picker\basic.tsx,en\date-picker\controlled.tsx,en\date-picker\custom-render-function.tsx,en\date-picker\disabled.tsx,en\date-picker\form-example.tsx,en\date-picker\format-options-no-ssr.tsx,en\date-picker\format-options.tsx,en\date-picker\international-calendar.tsx,en\date-picker\with-custom-indicator.tsx,en\date-picker\with-validation.tsx,en\date-range-picker\basic.tsx,en\date-range-picker\controlled.tsx,en\date-range-picker\custom-render-function.tsx,en\date-range-picker\disabled.tsx,en\date-range-picker\form-example.tsx,en\date-range-picker\format-options-no-ssr.tsx,en\date-range-picker\format-options.tsx,en\date-range-picker\input-container.tsx,en\date-range-picker\international-calendar.tsx,en\date-range-picker\with-custom-indicator.tsx,en\date-range-picker\with-validation.tsx,en\description\basic.tsx,en\disclosure-group\basic.tsx,en\disclosure-group\controlled.tsx,en\disclosure\basic.tsx,en\disclosure\custom-render-function.tsx,en\drawer\backdrop-variants.tsx,en\drawer\basic.tsx,en\drawer\controlled.tsx,en\drawer\navigation.tsx,en\drawer\non-dismissable.tsx,en\drawer\placements.tsx,en\drawer\scrollable-content.tsx,en\drawer\with-form.tsx,en\dropdown\controlled-open-state.tsx,en\dropdown\controlled.tsx,en\dropdown\custom-trigger.tsx,en\dropdown\default.tsx,en\dropdown\long-press-trigger.tsx,en\dropdown\single-with-custom-indicator.tsx,en\dropdown\with-custom-submenu-indicator.tsx,en\dropdown\with-descriptions.tsx,en\dropdown\with-disabled-items.tsx,en\dropdown\with-icons.tsx,en\dropdown\with-keyboard-shortcuts.tsx,en\dropdown\with-multiple-selection.tsx,en\dropdown\with-section-level-selection.tsx,en\dropdown\with-sections.tsx,en\dropdown\with-single-selection.tsx,en\dropdown\with-submenus.tsx,en\error-message\basic.tsx,en\error-message\with-tag-group.tsx,en\field-error\basic.tsx,en\fieldset\basic.tsx,en\fieldset\on-surface.tsx,en\form\basic.tsx,en\form\custom-render-function.tsx,en\input-group\default.tsx,en\input-group\disabled.tsx,en\input-group\full-width.tsx,en\input-group\invalid.tsx,en\input-group\on-surface.tsx,en\input-group\password-with-toggle.tsx,en\input-group\required.tsx,en\input-group\variants.tsx,en\input-group\with-badge-suffix.tsx,en\input-group\with-copy-suffix.tsx,en\input-group\with-icon-prefix-and-copy-suffix.tsx,en\input-group\with-icon-prefix-and-text-suffix.tsx,en\input-group\with-keyboard-shortcut.tsx,en\input-group\with-loading-suffix.tsx,en\input-group\with-prefix-and-suffix.tsx,en\input-group\with-prefix-icon.tsx,en\input-group\with-suffix-icon.tsx,en\input-group\with-text-prefix.tsx,en\input-group\with-text-suffix.tsx,en\input-group\with-textarea.tsx,en\input-otp\basic.tsx,en\input-otp\controlled.tsx,en\input-otp\disabled.tsx,en\input-otp\form-example.tsx,en\input-otp\four-digits.tsx,en\input-otp\on-complete.tsx,en\input-otp\on-surface.tsx,en\input-otp\variants.tsx,en\input-otp\with-pattern.tsx,en\input-otp\with-validation.tsx,en\input\basic.tsx,en\input\controlled.tsx,en\input\full-width.tsx,en\input\on-surface.tsx,en\input\types.tsx,en\input\variants.tsx,en\kbd\basic.tsx,en\kbd\inline.tsx,en\kbd\instructional.tsx,en\kbd\navigation.tsx,en\kbd\special.tsx,en\kbd\variants.tsx,en\label\basic.tsx,en\link\basic.tsx,en\link\custom-icon.tsx,en\link\custom-render-function.tsx,en\link\icon-placement.tsx,en\link\underline-and-offset.tsx,en\link\underline-offset.tsx,en\link\underline-variants.tsx,en\list-box\controlled.tsx,en\list-box\custom-check-icon.tsx,en\list-box\custom-render-function.tsx,en\list-box\default.tsx,en\list-box\multi-select.tsx,en\list-box\scrollbar-modes.tsx,en\list-box\virtualization.tsx,en\list-box\with-disabled-items.tsx,en\list-box\with-sections.tsx,en\meter\basic.tsx,en\meter\colors.tsx,en\meter\custom-value.tsx,en\meter\sizes.tsx,en\meter\without-label.tsx,en\modal\backdrop-variants.tsx,en\modal\close-methods.tsx,en\modal\controlled.tsx,en\modal\custom-animations.tsx,en\modal\custom-backdrop.tsx,en\modal\custom-portal.tsx,en\modal\custom-trigger.tsx,en\modal\default.tsx,en\modal\dismiss-behavior.tsx,en\modal\placements.tsx,en\modal\scroll-comparison.tsx,en\modal\sizes.tsx,en\modal\with-form.tsx,en\number-field\basic.tsx,en\number-field\controlled.tsx,en\number-field\custom-icons.tsx,en\number-field\custom-render-function.tsx,en\number-field\disabled.tsx,en\number-field\form-example.tsx,en\number-field\full-width.tsx,en\number-field\on-surface.tsx,en\number-field\required.tsx,en\number-field\validation.tsx,en\number-field\variants.tsx,en\number-field\with-chevrons.tsx,en\number-field\with-description.tsx,en\number-field\with-format-options.tsx,en\number-field\with-step.tsx,en\number-field\with-validation.tsx,en\pagination\basic.tsx,en\pagination\controlled.tsx,en\pagination\custom-icons.tsx,en\pagination\disabled.tsx,en\pagination\simple-prev-next.tsx,en\pagination\sizes.tsx,en\pagination\with-ellipsis.tsx,en\pagination\with-summary.tsx,en\popover\basic.tsx,en\popover\custom-render-function.tsx,en\popover\interactive.tsx,en\popover\placement.tsx,en\popover\with-arrow.tsx,en\progress-bar\basic.tsx,en\progress-bar\colors.tsx,en\progress-bar\custom-value.tsx,en\progress-bar\indeterminate.tsx,en\progress-bar\sizes.tsx,en\progress-bar\without-label.tsx,en\progress-circle\basic.tsx,en\progress-circle\colors.tsx,en\progress-circle\custom-svg.tsx,en\progress-circle\indeterminate.tsx,en\progress-circle\sizes.tsx,en\progress-circle\with-label.tsx,en\radio-group\basic.tsx,en\radio-group\controlled.tsx,en\radio-group\custom-indicator.tsx,en\radio-group\custom-render-function.tsx,en\radio-group\delivery-and-payment.tsx,en\radio-group\disabled.tsx,en\radio-group\horizontal.tsx,en\radio-group\on-surface.tsx,en\radio-group\uncontrolled.tsx,en\radio-group\validation.tsx,en\radio-group\variants.tsx,en\range-calendar\allows-non-contiguous-ranges.tsx,en\range-calendar\anchor-unavailable-dates.tsx,en\range-calendar\basic.tsx,en\range-calendar\booking-calendar.tsx,en\range-calendar\controlled.tsx,en\range-calendar\day-view.tsx,en\range-calendar\default-value.tsx,en\range-calendar\disabled.tsx,en\range-calendar\focused-value.tsx,en\range-calendar\international-calendar.tsx,en\range-calendar\invalid.tsx,en\range-calendar\min-max-dates.tsx,en\range-calendar\multiple-months.tsx,en\range-calendar\read-only.tsx,en\range-calendar\three-months.tsx,en\range-calendar\unavailable-dates.tsx,en\range-calendar\week-view.tsx,en\range-calendar\weeks-in-month.tsx,en\range-calendar\with-indicators.tsx,en\range-calendar\year-picker.tsx,en\scroll-shadow\custom-size.tsx,en\scroll-shadow\default.tsx,en\scroll-shadow\hide-scroll-bar.tsx,en\scroll-shadow\orientation.tsx,en\scroll-shadow\visibility-change.tsx,en\scroll-shadow\with-card.tsx,en\search-field\basic.tsx,en\search-field\controlled.tsx,en\search-field\custom-icons.tsx,en\search-field\custom-render-function.tsx,en\search-field\disabled.tsx,en\search-field\form-example.tsx,en\search-field\full-width.tsx,en\search-field\on-surface.tsx,en\search-field\required.tsx,en\search-field\validation.tsx,en\search-field\variants.tsx,en\search-field\with-description.tsx,en\search-field\with-keyboard-shortcut.tsx,en\search-field\with-validation.tsx,en\select\asynchronous-loading.tsx,en\select\controlled-multiple.tsx,en\select\controlled-open-state.tsx,en\select\controlled.tsx,en\select\custom-indicator.tsx,en\select\custom-render-function.tsx,en\select\custom-value-multiple.tsx,en\select\custom-value.tsx,en\select\default.tsx,en\select\disabled.tsx,en\select\full-width.tsx,en\select\multiple-select.tsx,en\select\on-surface.tsx,en\select\required.tsx,en\select\variants.tsx,en\select\with-description.tsx,en\select\with-disabled-options.tsx,en\select\with-sections.tsx,en\separator\basic.tsx,en\separator\custom-render-function.tsx,en\separator\manual-variant-override.tsx,en\separator\variants.tsx,en\separator\vertical.tsx,en\separator\with-content.tsx,en\separator\with-surface.tsx,en\skeleton\animation-types.tsx,en\skeleton\basic.tsx,en\skeleton\card.tsx,en\skeleton\grid.tsx,en\skeleton\list.tsx,en\skeleton\single-shimmer.tsx,en\skeleton\text-content.tsx,en\skeleton\user-profile.tsx,en\slider\custom-render-function.tsx,en\slider\default.tsx,en\slider\disabled.tsx,en\slider\range.tsx,en\slider\vertical.tsx,en\spinner\basic.tsx,en\spinner\colors.tsx,en\spinner\sizes.tsx,en\surface\variants.tsx,en\switch\basic.tsx,en\switch\controlled.tsx,en\switch\custom-render-function.tsx,en\switch\custom-styles.tsx,en\switch\default-selected.tsx,en\switch\disabled.tsx,en\switch\form.tsx,en\switch\group-horizontal.tsx,en\switch\group.tsx,en\switch\label-position.tsx,en\switch\render-props.tsx,en\switch\sizes.tsx,en\switch\with-description.tsx,en\switch\with-icons.tsx,en\switch\without-label.tsx,en\table\async-loading.tsx,en\table\basic.tsx,en\table\column-resizing.tsx,en\table\custom-cells.tsx,en\table\empty-state.tsx,en\table\expandable-rows.tsx,en\table\pagination.tsx,en\table\secondary-variant.tsx,en\table\selection.tsx,en\table\sorting.tsx,en\table\tanstack-table.tsx,en\table\virtualization.tsx,en\tabs\basic.tsx,en\tabs\custom-render-function.tsx,en\tabs\custom-styles.tsx,en\tabs\disabled.tsx,en\tabs\secondary-vertical.tsx,en\tabs\secondary.tsx,en\tabs\vertical.tsx,en\tabs\with-separator.tsx,en\tag-group\basic.tsx,en\tag-group\controlled.tsx,en\tag-group\custom-render-function.tsx,en\tag-group\disabled.tsx,en\tag-group\selection-modes.tsx,en\tag-group\sizes.tsx,en\tag-group\variants.tsx,en\tag-group\with-error-message.tsx,en\tag-group\with-list-data.tsx,en\tag-group\with-prefix.tsx,en\tag-group\with-remove-button.tsx,en\textarea\basic.tsx,en\textarea\controlled.tsx,en\textarea\full-width.tsx,en\textarea\on-surface.tsx,en\textarea\rows.tsx,en\textarea\variants.tsx,en\textfield\basic.tsx,en\textfield\controlled.tsx,en\textfield\custom-render-function.tsx,en\textfield\disabled.tsx,en\textfield\full-width.tsx,en\textfield\input-types.tsx,en\textfield\on-surface.tsx,en\textfield\required.tsx,en\textfield\textarea.tsx,en\textfield\validation.tsx,en\textfield\with-description.tsx,en\textfield\with-error.tsx,en\time-field\basic.tsx,en\time-field\controlled.tsx,en\time-field\custom-render-function.tsx,en\time-field\disabled.tsx,en\time-field\form-example.tsx,en\time-field\full-width.tsx,en\time-field\invalid.tsx,en\time-field\on-surface.tsx,en\time-field\required.tsx,en\time-field\with-description.tsx,en\time-field\with-prefix-and-suffix.tsx,en\time-field\with-prefix-icon.tsx,en\time-field\with-suffix-icon.tsx,en\time-field\with-validation.tsx,en\toast\callbacks.tsx,en\toast\custom-indicator.tsx,en\toast\custom-queue.tsx,en\toast\custom-toast.tsx,en\toast\default.tsx,en\toast\placements.tsx,en\toast\promise.tsx,en\toast\simple.tsx,en\toast\variants.tsx,en\toggle-button-group\attached.tsx,en\toggle-button-group\basic.tsx,en\toggle-button-group\controlled.tsx,en\toggle-button-group\disabled.tsx,en\toggle-button-group\full-width.tsx,en\toggle-button-group\orientation.tsx,en\toggle-button-group\selection-mode.tsx,en\toggle-button-group\sizes.tsx,en\toggle-button-group\without-separator.tsx,en\toggle-button\basic.tsx,en\toggle-button\controlled.tsx,en\toggle-button\disabled.tsx,en\toggle-button\icon-only.tsx,en\toggle-button\sizes.tsx,en\toggle-button\variants.tsx,en\toolbar\basic.tsx,en\toolbar\custom-styles.tsx,en\toolbar\vertical.tsx,en\toolbar\with-button-group.tsx,en\tooltip\basic.tsx,en\tooltip\custom-render-function.tsx,en\tooltip\custom-trigger.tsx,en\tooltip\placement.tsx,en\tooltip\with-arrow.tsx,en\typography\default.tsx,en\typography\primitives.tsx,en\typography\prose.tsx,en\typography\render-props.tsx,en\typography\typography-scale.tsx}
<!-- HEROUI-REACT-AGENTS-MD-END -->
