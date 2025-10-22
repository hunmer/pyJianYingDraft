# Python 后端打包说明

## 快速开始

```bash
# 安装依赖 (如果还没安装)
pip install -r requirements.txt

# 打包为单个可执行文件
python build_server.py
```

输出文件: `dist/pyJianYingDraftServer.exe`

## 文件说明

### `server.spec`
PyInstaller 配置文件,定义打包参数:
- **包含的文件**: 配置文件、app 模块、pyJianYingDraft 库
- **隐藏导入**: FastAPI, Uvicorn, Socket.IO 等动态导入模块
- **输出格式**: 单文件可执行程序 (`onefile`)

### `build_server.py`
自动化打包脚本:
1. 检查 PyInstaller 是否安装
2. 清理旧的构建文件
3. 执行 PyInstaller 打包
4. 验证输出并复制到 Electron 资源目录

### `run.py`
开发环境启动脚本 (支持热重载)

### `run_production.py`
生产环境启动脚本 (禁用热重载)

## 使用场景

### 场景 1: 独立运行后端服务

```bash
# 打包
python build_server.py

# 运行
cd dist
./pyJianYingDraftServer.exe
```

服务将在 `http://0.0.0.0:8000` 启动。

### 场景 2: 与 Electron 集成

打包后的 `.exe` 会自动复制到 `pyjianyingdraft-web/resources/`,Electron 应用会在启动时自动检测并运行后端服务。

## 配置修改

### 修改监听端口

编辑 `run_production.py`:

```python
uvicorn.run(
    "app.main:socket_app",
    host="0.0.0.0",
    port=8000,  # 修改端口
    reload=False,
    log_level="info"
)
```

### 添加新的依赖模块

如果运行时出现 `ModuleNotFoundError`,在 `server.spec` 的 `hiddenimports` 中添加:

```python
hiddenimports=[
    # ... 现有模块
    'your_new_module',
]
```

### 包含额外文件

在 `server.spec` 的 `datas` 中添加:

```python
datas=[
    # ... 现有文件
    ('path/to/file', 'destination'),
]
```

## 调试

### 查看详细打包日志

```bash
pyinstaller server.spec --clean --log-level DEBUG
```

### 测试打包后的可执行文件

```bash
cd dist
./pyJianYingDraftServer.exe
```

查看控制台输出,确认服务正常启动。

### 减小文件体积

1. 使用虚拟环境,只安装必要依赖
2. 启用 UPX 压缩 (已默认启用)
3. 排除不必要的模块

## 常见问题

**Q: 打包后文件很大 (>100MB)?**
A: 这是正常的,因为包含了完整的 Python 运行时和所有依赖库。可通过以下方式优化:
- 使用干净的虚拟环境
- 排除测试和文档模块
- 启用 UPX 压缩

**Q: 运行时提示找不到模块?**
A: 在 `server.spec` 的 `hiddenimports` 中添加缺失模块。

**Q: 配置文件未加载?**
A: 确认 `config.json` 在 `server.spec` 的 `datas` 中,且打包后与 `.exe` 同级。

## 相关文档

- 完整构建指南: [BUILD_GUIDE.md](../BUILD_GUIDE.md)
- PyInstaller 文档: https://pyinstaller.org/
