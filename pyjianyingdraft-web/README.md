# pyJianYingDraft Web

基于 React + Next.js + Material-UI 构建的剪映草稿可视化编辑器。

## 功能特性

- ✅ **草稿可视化**: 将剪映草稿文件渲染为时间轴视图
- ✅ **轨道展示**: 支持视频、音频、文本等多种轨道类型
- ✅ **素材信息**: 显示草稿分辨率、时长、轨道数、素材统计
- ✅ **响应式设计**: 适配桌面和移动端设备
- 🚧 **编辑功能**: 计划中(当前为只读模式)

## 技术栈

- **Next.js 15**: App Router, Server Components
- **React 19**: 最新版本
- **Material-UI 7**: UI 组件库
- **TypeScript**: 类型安全
- **react-timeline-editor**: 时间轴编辑器组件
- **Monaco Editor**: 代码编辑器(本地加载,支持离线使用)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

> **注意**: 安装过程中会自动复制 Monaco Editor 文件到 `public/monaco-editor/` 目录,以支持离线使用。详见 [Monaco Editor 本地加载配置](./MONACO_LOCAL_LOADING.md)。

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`:

```bash
cp .env.example .env.local
```

编辑 `.env.local` 设置API服务端地址:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 启动API服务端

在使用编辑器之前,需要先启动 FastAPI 后端服务:

```bash
cd ../pyJianYingDraftServer
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 使用指南

### 打开编辑器

1. 访问主页 http://localhost:3000
2. 点击"打开编辑器"按钮
3. 或直接访问 http://localhost:3000/editor

### 加载草稿文件

1. 在输入框中粘贴草稿文件路径,例如:
   ```
   D:\JianyingPro Drafts\my_project\draft_content.json
   ```

2. 点击"加载草稿"按钮

3. 查看草稿信息和时间轴可视化

### 草稿文件路径

草稿文件通常位于:

- **Windows**: `C:\Users\{用户名}\AppData\Local\JianyingPro\User Data\Projects\{草稿名称}\draft_content.json`
- **macOS**: `~/Library/Containers/com.lveditor.LvEditor/Data/Movies/JianyingPro/User Data/Projects/{草稿名称}/draft_content.json`

## 项目结构

```
pyjianyingdraft-web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 主页
│   │   ├── editor/
│   │   │   └── page.tsx        # 编辑器页面
│   │   └── layout.tsx          # 根布局
│   ├── components/             # React 组件
│   │   └── Timeline.tsx        # 时间轴编辑器组件
│   ├── lib/                    # 工具库
│   │   └── api.ts              # API 客户端
│   ├── types/                  # TypeScript 类型定义
│   │   └── draft.ts            # 草稿相关类型
│   └── theme.ts                # MUI 主题配置
├── public/                     # 静态资源
├── .env.local                  # 环境变量(不提交到git)
├── .env.example                # 环境变量示例
├── package.json                # 项目配置
├── tsconfig.json               # TypeScript 配置
└── README.md                   # 项目文档
```

## API 接口

所有API接口由 `pyJianYingDraftServer` 提供,详见 [API文档](../pyJianYingDraftServer/README.md)

### 主要接口

- `GET /api/draft/info` - 获取草稿基础信息
- `GET /api/tracks/video` - 获取视频轨道
- `GET /api/tracks/audio` - 获取音频轨道
- `GET /api/tracks/text` - 获取文本轨道
- `GET /api/materials/all` - 获取所有素材

## 开发说明

### 添加新功能

1. **添加新的API接口**:
   - 在 `src/lib/api.ts` 中添加API方法
   - 在 `src/types/draft.ts` 中添加类型定义

2. **创建新组件**:
   - 在 `src/components/` 中创建组件文件
   - 使用 TypeScript 和 Material-UI

3. **添加新路由**:
   - 在 `src/app/` 中创建文件夹
   - 添加 `page.tsx` 文件

### 构建生产版本

```bash
npm run build
npm start
```

## 特性说明

### Monaco Editor 本地加载

本项目已配置 Monaco Editor 从本地加载,而不是从 CDN 加载,具有以下优势:

- ✅ **离线可用**: 无需网络连接即可使用代码编辑器
- ✅ **加载速度快**: 本地文件加载比网络请求快
- ✅ **稳定性高**: 不受网络波动影响

详细配置说明请参考:
- [Monaco Editor 本地加载配置](./MONACO_LOCAL_LOADING.md)
- [更改说明](./CHANGES_MONACO_LOCAL.md)
- [测试步骤](./TESTING_MONACO_LOCAL.md)

## 已知问题

1. **React 19 兼容性**: `react-timeline-editor` 官方不支持 React 19,已使用 `--legacy-peer-deps` 安装
2. **只读模式**: 当前仅支持查看,编辑功能开发中
3. **CORS**: 确保API服务端已配置CORS允许跨域请求

## 路线图

- [ ] 实现轨道编辑功能
- [ ] 支持拖拽调整片段位置
- [ ] 支持素材替换
- [ ] 添加导出功能
- [ ] 优化大文件加载性能
- [ ] 添加撤销/重做功能

## 贡献

欢迎提交 Issue 和 Pull Request!

## 许可证

与 pyJianYingDraft 保持一致

## 相关项目

- [pyJianYingDraft](https://github.com/JulyWitch/pyJianYingDraft) - Python 库
- [pyJianYingDraftServer](../pyJianYingDraftServer) - FastAPI 服务端
- [react-timeline-editor](https://github.com/xzdarcy/react-timeline-editor) - 时间轴组件
