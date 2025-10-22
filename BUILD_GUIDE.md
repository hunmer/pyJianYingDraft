# pyJianYingDraft 打包构建指南

本指南介绍如何将 Python 后端打包为单个可执行文件,并与 Electron 前端集成。

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron 桌面应用                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js Web 前端                          │  │
│  │         (localhost:3001 或静态文件)                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Electron 主进程 (main.js)                     │  │
│  │  • 检测后端服务是否运行                                  │  │
│  │  • 自动启动 Python 后端 (生产环境)                       │  │
│  │  • 记录后端输出到日志文件                                │  │
│  │  • 应用退出时停止后端服务                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   pyJianYingDraftServer.exe (打包的Python后端)         │  │
│  │   • FastAPI + Socket.IO 服务                           │  │
│  │   • 监听端口: 8000                                      │  │
│  │   • 提供 RESTful API 和 WebSocket                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 前置要求

### 后端打包依赖
- Python 3.8+ (推荐 3.11)
- PyInstaller (`pip install pyinstaller`)
- 项目依赖 (参见 `pyJianYingDraftServer/requirements.txt`)

### 前端打包依赖
- Node.js 16+
- npm 或 yarn

## 打包步骤

### 方式一:完整打包 (推荐)

在 `pyjianyingdraft-web` 目录下执行:

```bash
npm run build:all
```

这将自动执行:
1. 打包 Python 后端为单个 `.exe` 文件
2. 将后端可执行文件复制到 `resources/` 目录
3. 构建 Next.js 静态文件
4. 打包 Electron 应用 (包含后端可执行文件)

### 方式二:分步打包

#### 步骤 1: 打包 Python 后端

```bash
cd pyJianYingDraftServer
python build_server.py
```

**输出:**
- `dist/pyJianYingDraftServer.exe` - 单个可执行文件
- 自动复制到 `pyjianyingdraft-web/resources/pyJianYingDraftServer.exe`

**配置文件:**
- `server.spec` - PyInstaller 配置,定义打包内容和选项
- `build_server.py` - 自动化打包脚本,包含依赖检查和文件清理

#### 步骤 2: 打包 Electron 应用

```bash
cd pyjianyingdraft-web
npm run electron:build
```

**输出:**
- `dist/PyJianYingDraft Setup X.X.X.exe` - Windows 安装程序 (NSIS)

## 核心实现

### 1. Python 后端打包 (`server.spec`)

**关键配置:**

```python
datas=[
    ('config.json', '.'),              # 配置文件
    ('app', 'app'),                    # FastAPI 应用
    (str(ROOT_DIR / 'pyJianYingDraft'), 'pyJianYingDraft'),  # 核心库
],
hiddenimports=[
    'uvicorn.logging',
    'uvicorn.loops.auto',
    'fastapi',
    'socketio',
    'watchdog',
    # ... 其他隐藏导入
]
```

**说明:**
- `datas`: 包含需要打包的文件和目录
- `hiddenimports`: 解决动态导入的模块,防止运行时 ImportError
- `console=True`: 保留控制台窗口以便调试 (可改为 False)

### 2. Electron 后端服务管理 (`electron/main.js`)

**功能:**

1. **服务检测** (`checkBackendService`)
   - 向 `http://localhost:8000/health` 发送 HTTP 请求
   - 超时时间: 2 秒
   - 返回服务是否可用

2. **自动启动** (`startBackendService`)
   - 开发环境: 跳过,假设手动启动
   - 生产环境: 从 `process.resourcesPath` 加载 `.exe` 并启动
   - 使用 `child_process.spawn` 启动后端进程
   - 捕获 stdout/stderr 并记录到日志文件

3. **日志记录**
   - 位置: `%APPDATA%/PyJianYingDraft/logs/backend-{timestamp}.log`
   - 内容: 后端进程的所有输出和错误信息

4. **优雅退出** (`stopBackendService`)
   - 窗口关闭时自动调用
   - 应用退出前清理
   - 停止后端进程并关闭日志流

### 3. Electron Builder 配置 (`package.json`)

**关键配置:**

```json
"extraResources": [
  {
    "from": "resources/pyJianYingDraftServer.exe",
    "to": "pyJianYingDraftServer.exe",
    "filter": ["**/*"]
  }
]
```

**说明:**
- `extraResources`: 将后端可执行文件打包到 `app.asar.unpacked/resources/`
- 运行时通过 `process.resourcesPath` 访问

## 开发与测试

### 开发环境

**启动后端 (手动):**
```bash
cd pyJianYingDraftServer
python run.py
```

**启动前端:**
```bash
cd pyjianyingdraft-web
npm run dev
```

**启动 Electron (连接开发服务器):**
```bash
npm run electron:dev
```

### 生产环境测试

**手动测试后端可执行文件:**
```bash
cd pyJianYingDraftServer/dist
./pyJianYingDraftServer.exe
```

访问 `http://localhost:8000/docs` 查看 API 文档。

**测试 Electron 应用:**
```bash
cd pyjianyingdraft-web/dist
# 运行生成的安装程序
./PyJianYingDraft Setup X.X.X.exe
```

## 日志与调试

### 后端日志位置

**开发环境:**
- 控制台输出

**生产环境 (Electron 管理):**
- Windows: `%APPDATA%\PyJianYingDraft\logs\backend-{timestamp}.log`
- 包含 stdout, stderr, 错误信息和进程退出状态

### Electron 日志

**开发环境:**
- 控制台输出 (包含 `[Backend]` 前缀的日志)

**生产环境:**
- Electron 主进程日志: 查看任务管理器或使用 `console.log`

### 常见问题排查

**问题 1: 后端服务启动失败**
- 检查日志文件中的错误信息
- 确认端口 8000 未被占用: `netstat -ano | findstr :8000`
- 验证 `.exe` 文件是否存在: `process.resourcesPath/pyJianYingDraftServer.exe`

**问题 2: 打包后缺少依赖**
- 在 `server.spec` 的 `hiddenimports` 中添加缺失模块
- 使用 `pyinstaller --log-level DEBUG` 查看详细打包日志

**问题 3: 配置文件未找到**
- 确认 `config.json` 已添加到 `server.spec` 的 `datas`
- 打包后可执行文件会在临时目录解压,配置文件应与 `.exe` 同级

## 构建优化

### 减小可执行文件体积

1. **启用 UPX 压缩** (已默认启用):
   ```python
   upx=True
   ```

2. **排除不必要的模块**:
   ```python
   excludes=['test', 'unittest', 'pdb']
   ```

3. **使用虚拟环境**:
   - 只安装必要依赖
   - 避免打包开发工具

### 提升启动速度

1. **生产环境禁用热重载**:
   ```python
   uvicorn.run(..., reload=False)
   ```

2. **优化导入**:
   - 延迟导入非关键模块
   - 减少启动时的初始化操作

## 脚本说明

### `pyJianYingDraftServer/build_server.py`

**功能:**
- 检查并安装 PyInstaller
- 清理旧的构建文件
- 执行 `pyinstaller server.spec`
- 验证输出文件并自动复制到 Electron 资源目录

**用法:**
```bash
python build_server.py
```

### `pyjianyingdraft-web/package.json` 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run electron:dev` | 启动 Electron (开发模式) |
| `npm run build:backend` | 打包 Python 后端 |
| `npm run electron:build` | 打包 Electron 应用 |
| `npm run build:all` | 完整打包流程 (后端 + 前端) |

## 版本发布

### 发布检查清单

- [ ] 更新版本号 (`package.json`)
- [ ] 测试后端 API 功能
- [ ] 测试 Electron 应用 (开发和生产环境)
- [ ] 检查日志记录是否正常
- [ ] 验证安装程序可正常安装和卸载
- [ ] 测试后端服务自动启动和停止

### 发布流程

1. 更新版本号:
   ```bash
   cd pyjianyingdraft-web
   npm version patch  # 或 minor, major
   ```

2. 完整构建:
   ```bash
   npm run build:all
   ```

3. 测试安装程序:
   - 安装 `dist/PyJianYingDraft Setup X.X.X.exe`
   - 运行应用,验证功能
   - 卸载并检查清理

4. 分发:
   - 上传到 GitHub Releases
   - 提供 SHA256 校验和

## 技术栈

### 后端
- **框架**: FastAPI 0.104+
- **服务器**: Uvicorn (ASGI)
- **WebSocket**: Python Socket.IO
- **打包工具**: PyInstaller 6.0+

### 前端
- **框架**: Next.js 15.5+
- **UI 库**: Material-UI (MUI) 7.3+
- **桌面框架**: Electron (latest)
- **打包工具**: Electron Builder 26.0+

## 参考资料

- [PyInstaller 文档](https://pyinstaller.org/en/stable/)
- [Electron Builder 文档](https://www.electron.build/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Next.js 文档](https://nextjs.org/docs)

## 许可证

遵循项目主许可证。
