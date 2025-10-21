# 文件版本比较工具使用说明

## 功能概述

这是一个集成在 pyJianYingDraft Web 应用中的文件版本管理和比较工具，支持：

- ✅ 监控文件变化并自动保存版本
- ✅ 查看文件的所有历史版本
- ✅ 双面板 Diff 比较任意两个版本
- ✅ 实时监控开关控制
- ✅ 版本元数据（时间戳、文件大小、哈希值）

## 架构设计

### 后端 (FastAPI + Watchdog)

**核心模块:**

1. **文件监控服务** (`app/services/file_watch_service.py`)
   - `FileVersionManager`: 文件版本管理器
   - `FileChangeHandler`: 文件变化事件处理器
   - 使用 `watchdog` 库监控文件系统变化
   - 自动保存文件副本并生成版本号

2. **数据模型** (`app/models/file_watch_models.py`)
   - `WatchedFileInfo`: 监控文件信息
   - `FileVersionInfo`: 文件版本信息
   - `FileContentResponse`: 文件内容响应

3. **API路由** (`app/routers/file_watch.py`)
   - `POST /api/file-watch/watch`: 添加文件监控
   - `DELETE /api/file-watch/watch`: 移除文件监控
   - `GET /api/file-watch/watch/list`: 获取监控文件列表
   - `POST /api/file-watch/watch/start`: 开始监控
   - `POST /api/file-watch/watch/stop`: 停止监控
   - `GET /api/file-watch/versions`: 获取版本列表
   - `GET /api/file-watch/version/content`: 获取版本内容

**存储结构:**

```
.file_versions/
├── metadata.json              # 监控文件元数据
├── <hash1>/                   # 文件1的版本目录（使用路径MD5哈希）
│   ├── v1_filename.json       # 版本1
│   ├── v2_filename.json       # 版本2
│   └── ...
└── <hash2>/                   # 文件2的版本目录
    └── ...
```

### 前端 (React + MUI + react-diff-view)

**核心组件:**

1. **FileVersionList** (`src/components/FileVersionList.tsx`)
   - 显示所有监控文件列表
   - 支持添加/删除监控文件
   - 监控开关控制（开始/停止）
   - 显示版本统计信息
   - 轮询更新（可选）

2. **FileDiffViewer** (`src/components/FileDiffViewer.tsx`)
   - 双面板 Diff 视图
   - 版本选择器
   - 使用 `react-diff-view` 库渲染差异
   - 支持 unified 和 split 视图模式
   - 显示版本元数据（时间、大小）

3. **主页面集成** (`src/app/page.tsx`)
   - 左侧栏 Tabs 切换（草稿列表 / 文件版本）
   - 动态切换视图内容

**API客户端** (`src/lib/api.ts`)
   - `fileWatchApi`: 封装所有文件监控相关的 HTTP 请求

## 使用方法

### 1. 启动服务

**后端服务器:**
```bash
cd pyJianYingDraftServer
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**前端服务器:**
```bash
cd pyjianyingdraft-web
npm install
npm run dev
```

### 2. 添加监控文件

1. 打开浏览器访问 `http://localhost:3000`
2. 点击左侧栏的 **"文件版本"** Tab
3. 点击右上角的 **"+"** 按钮
4. 输入要监控的文件路径（例如: `D:\test\draft_content.json`）
5. 可选：输入一个便于识别的监控名称
6. 点击 **"添加"**

### 3. 开始监控

在文件列表中，点击文件右侧的 **播放按钮** 开始监控。
- 绿色图标表示正在监控
- 灰色图标表示未监控

### 4. 查看版本历史

1. 在文件列表中点击要查看的文件
2. 右侧会显示该文件的所有版本
3. 默认选择最新的两个版本进行比较

### 5. 比较版本

1. 在 **"版本 1 (旧版本)"** 下拉框中选择旧版本
2. 在 **"版本 2 (新版本)"** 下拉框中选择新版本
3. Diff 视图会自动更新显示差异
   - 红色背景：删除的内容
   - 绿色背景：新增的内容
   - 分栏视图：左右对比

### 6. 停止监控

点击文件右侧的 **停止按钮** 停止监控（不会删除已保存的版本）。

### 7. 删除监控

点击文件右侧的 **垃圾桶图标** 删除监控（不会删除已保存的版本文件）。

## API 接口示例

### 添加监控

```bash
curl -X POST "http://localhost:8000/api/file-watch/watch" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "D:\\test\\file.json",
    "watch_name": "测试文件"
  }'
```

### 开始监控

```bash
curl -X POST "http://localhost:8000/api/file-watch/watch/start?file_path=D%3A%5Ctest%5Cfile.json"
```

### 获取版本列表

```bash
curl "http://localhost:8000/api/file-watch/versions?file_path=D%3A%5Ctest%5Cfile.json"
```

### 获取版本内容

```bash
curl "http://localhost:8000/api/file-watch/version/content?file_path=D%3A%5Ctest%5Cfile.json&version=1"
```

## 技术栈

### 后端

- **FastAPI**: 现代高性能 Web 框架
- **Watchdog**: 文件系统监控库
- **Pydantic**: 数据验证和序列化

### 前端

- **Next.js 15**: React 框架
- **React 19**: UI 库
- **MUI (Material-UI)**: 组件库
- **react-diff-view**: Diff 视图组件
- **diff**: 文本差异算法
- **unidiff**: Unified diff 格式化

## 注意事项

1. **文件路径**:
   - Windows 系统使用反斜杠 `\` 或双反斜杠 `\\`
   - 建议使用绝对路径

2. **监控性能**:
   - 大文件会影响版本保存速度
   - 频繁修改的文件会生成大量版本
   - 建议定期清理旧版本

3. **存储空间**:
   - 每个版本都是完整的文件副本
   - 监控大型文件会占用较多磁盘空间

4. **并发限制**:
   - watchdog 监控是基于文件系统事件
   - 同时监控过多文件可能影响性能

5. **版本持久化**:
   - 版本数据存储在 `.file_versions/` 目录
   - 元数据保存在 `metadata.json`
   - 删除此目录会丢失所有版本历史

## 故障排查

### 后端无法启动

```bash
# 检查依赖是否安装
pip install watchdog==3.0.0

# 检查端口占用
netstat -ano | findstr :8000
```

### 前端编译错误

```bash
# 清理缓存
rm -rf .next node_modules
npm install --legacy-peer-deps
```

### 文件监控不工作

1. 检查文件路径是否正确
2. 确认文件存在且可读
3. 查看后端日志是否有错误
4. 确认已点击"开始监控"按钮

### Diff 视图显示异常

1. 确认选择了两个不同的版本
2. 检查浏览器控制台是否有错误
3. 刷新页面重新加载

## 未来改进

- [ ] 支持版本标签和备注
- [ ] 版本自动清理策略
- [ ] 支持目录监控
- [ ] 版本回滚功能
- [ ] 导出版本历史
- [ ] 语法高亮支持
- [ ] WebSocket 实时推送版本更新
- [ ] 版本压缩存储
- [ ] 增量diff存储（节省空间）

## 开发者指南

### 添加新的API端点

1. 在 `app/models/file_watch_models.py` 添加数据模型
2. 在 `app/services/file_watch_service.py` 实现业务逻辑
3. 在 `app/routers/file_watch.py` 添加路由
4. 在前端 `src/lib/api.ts` 添加API客户端方法

### 自定义Diff视图样式

编辑 `src/components/FileDiffViewer.tsx`，修改样式对象：

```tsx
sx={{
  '& .diff-code-insert': {
    backgroundColor: '#your-color',
  },
  '& .diff-code-delete': {
    backgroundColor: '#your-color',
  },
}}
```

## 许可证

本功能作为 pyJianYingDraft 项目的一部分，遵循相同的许可证。

## 贡献

欢迎提交 Issue 和 Pull Request！
