# CLAUDE.md — pyjianyingdraft-web

[根目录](../CLAUDE.md) > **pyjianyingdraft-web**

## 模块简单介绍

pyjianyingdraft-web 是 pyJianYingDraft 工具集的可视化前端，基于 Next.js 15（App Router）+ React 19，提供剪映草稿的时间轴可视化编辑、规则组管理、Aria2 下载管理、快照与生成记录等功能。通过 HTTP 调用后端 `pyJianYingDraftServer` 的 REST API，并订阅任务进度。

关键技术栈：Next.js 15.5.6、React 19、HeroUI（@heroui/react v3）、Tailwind CSS v4、CodeMirror 6（json/python/js 编辑 + 校验）、@xzdarcy/react-timeline-editor（时间轴）、axios、diff/diff2html（差异对比）。

注意：当前仓库**无 `electron/` 目录**（与历史描述不符），实际为纯 Next.js 应用；`build:all` 仅做后端 exe + `next build`。

## 约定的规则

- 框架：Next.js App Router，页面放 `src/app/`，组件 `src/components/`， Hooks `src/hooks/`，类型 `src/types/`。
- UI 库：HeroUI（@heroui/react），引用 `var(--xxx)` 前先确认 globals.css 已定义。
- 样式：Tailwind v4 + tailwind-variants。
- 开发：`npm run dev`；Lint：`npm run lint`；构建：`npm run build`。
- 联调后端：`npm run run:backend`（cd 到 `../pyJianYingDraftServer` 跑 `python run.py`）。
- API 客户端集中在 `src/lib/api.ts`，时间轴状态在 `src/components/timeline-editor/`。
- 后端默认 `http://localhost:8000`，Swagger 在 `/docs`。
- 详情见 [约定详情](claude/conventions.md)。

## 文件索引

| 文件 | 用途 | 何时阅读 |
| --- | --- | --- |
| [架构总览](claude/overview.md) | 目录划分、数据流、与后端关系 | 第一次接手 |
| [约定详情](claude/conventions.md) | 框架/UI/样式/命令细则 | 写组件前 |
| [模块职责](claude/module-responsibilities.md) | app/components/hooks/lib/types 职责 | 找实现位置 |
| [入口与启动](claude/entrypoints.md) | Next.js 启动、App Router 入口 | 跑起来 |
| [对外接口](claude/public-interfaces.md) | 页面路由、API Route、api.ts 调用 | 调后端 |
| [依赖与配置](claude/dependencies-and-config.md) | package.json 关键依赖、环境变量 | 升级或环境 |
| [数据模型](claude/data-model.md) | TS 类型、时间轴状态、规则组结构 | 设计数据流 |
| [测试与质量](claude/testing-and-quality.md) | Lint、类型检查、质量风险 | 验证改动 |
| [文件地图](claude/file-map.md) | src/ 全部文件清单 | 找文件 |
| [常见问题](claude/faq.md) | HeroUI 变量缺失、API 跨域等 | 排错 |
| [变更记录](claude/changelog.md) | 索引生成记录 | 看历史 |

## 扫描状态

- 更新时间：2026-06-24 09:19:30
- 已扫描：`package.json` 全文、`src/` 全部文件路径（app 5 个、components ~40 个、hooks 6 个、types 4 个、lib 2 个、config 1 个）。
- 修正事实：无 `electron/` 目录；App Router 实际路由为 `/`、`/editor`、`/downloads`、`/api/open-in-editor`。
- 跳过：`node_modules/`、`.heroui-docs/`（HeroUI 官方示例，非业务代码）、`out/`（构建产物）、`public/`、各组件函数体细节。
- 下一步建议：深挖 `src/components/timeline-editor/` 状态管理、`src/lib/api.ts` 全部端点封装、`src/hooks/useAria2WebSocket.ts` 的实时推送实现。
