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
