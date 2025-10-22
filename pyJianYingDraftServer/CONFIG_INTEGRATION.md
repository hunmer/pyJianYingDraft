# Aria2c配置集成说明

## 📋 概述

Aria2进程管理器现已支持从 `config.json` 中读取 `ARIA2_PATH` 配置,提供了更灵活的部署方式。

## 🔧 配置方式

### 在 config.json 中配置 ARIA2_PATH

```json
{
  "ARIA2_PATH": "D:/programming/pyJianYingDraft/pyJianYingDraftServer/aria2",
  "PYJY_DRAFT_ROOT": "G:/jianyin5.9_drafts/JianyingPro Drafts/",
  ...
}
```

**说明:**
- `ARIA2_PATH` 指向 aria2c 可执行文件所在的目录
- 目录中应该包含:
  - `aria2c.exe` (Windows) 或 `aria2c` (Linux/MacOS)
  - `aria2.conf` (可选,如果不存在会自动生成)

## 🔍 Aria2c 查找顺序

系统会按以下优先级查找 aria2c:

1. ✅ **config.json 中的 ARIA2_PATH** (最高优先级)
   ```
   读取 config.json -> ARIA2_PATH/aria2c.exe (Windows)
                      或 ARIA2_PATH/aria2c (Linux/MacOS)
   ```

2. **项目 resources 目录**
   ```
   resources/aria2c.exe (Windows)
   resources/aria2c (Linux/MacOS)
   ```

3. **系统 PATH 环境变量**
   ```
   使用 shutil.which("aria2c") 查找
   ```

4. **常见安装路径** (仅 Windows)
   ```
   C:\Program Files\aria2\aria2c.exe
   C:\Program Files (x86)\aria2\aria2c.exe
   %LOCALAPPDATA%\aria2\aria2c.exe
   ```

## 📁 项目中的 aria2 目录结构

```
pyJianYingDraftServer/aria2/
├── aria2c.exe              # Aria2c 可执行文件
├── aria2.conf              # Aria2c 配置文件(可选)
├── console.html            # Web 控制台(可选)
└── 点击启动aria2c.bat       # 快速启动脚本(可选)
```

## 🚀 使用示例

### 1. 初始化 Aria2 管理器

```python
from app.services.aria2_manager import get_aria2_manager

# 自动从 config.json 读取 ARIA2_PATH
manager = get_aria2_manager()

# 启动 Aria2 进程
if manager.start():
    print(f"Aria2 启动成功!")
    print(f"RPC URL: {manager.get_rpc_url()}")
    print(f"RPC 密钥: {manager.get_rpc_secret()}")
```

### 2. 手动指定路径 (可选)

```python
# 如果不想使用 config.json,可以手动指定
manager = get_aria2_manager(
    aria2c_path="D:/path/to/aria2c.exe"
)
```

## ⚙️ 配置文件自动生成

如果 `aria2.conf` 不存在,系统会自动生成默认配置:

```bash
# 配置文件位置
pyJianYingDraftServer/aria2.conf
```

**默认配置包括:**
- RPC 端口: 6800
- RPC 密钥: 自动生成(32位随机密钥)
- 下载目录: `pyJianYingDraftServer/downloads/`
- 最大并发下载: 50
- 每个服务器最大连接数: 16
- 分片大小: 1MB
- 分片线程数: 16

## 📝 日志输出

启动时会看到如下日志:

```
[Aria2Manager 10:30:45] 从config.json找到aria2c: D:\programming\pyJianYingDraft\pyJianYingDraftServer\aria2\aria2c.exe
[Aria2Manager 10:30:45] 使用aria2c: D:\programming\pyJianYingDraft\pyJianYingDraftServer\aria2\aria2c.exe
[Aria2Manager 10:30:46] 已生成配置文件: D:\programming\pyJianYingDraft\pyJianYingDraftServer\aria2.conf
[Aria2Manager 10:30:46] ✓ Aria2进程启动成功 (PID: 12345, RPC端口: 6800)
```

## 🔗 相关文件

- `app/services/aria2_manager.py` - Aria2 进程管理器
- `app/services/aria2_client.py` - Aria2 RPC 客户端
- `config.json` - 项目配置文件
- `aria2/aria2c.exe` - Aria2c 可执行文件
- `aria2/aria2.conf` - Aria2c 配置文件

## ✅ 验证配置

运行以下命令验证配置是否正确:

```bash
# 检查 aria2c.exe 是否存在
ls -la D:/programming/pyJianYingDraft/pyJianYingDraftServer/aria2/aria2c.exe

# 检查 config.json 中的 ARIA2_PATH
grep -A1 "ARIA2_PATH" D:/programming/pyJianYingDraft/pyJianYingDraftServer/config.json
```

## 🐛 故障排除

### 1. 未找到 aria2c 可执行文件

**错误信息:**
```
FileNotFoundError: 未找到aria2c可执行文件。请安装aria2c或指定aria2c_path参数。
```

**解决方案:**
- 确认 `config.json` 中的 `ARIA2_PATH` 指向正确的目录
- 确认目录中存在 `aria2c.exe` (Windows) 或 `aria2c` (Linux/MacOS)
- 检查路径是否存在空格,如有需要用引号包裹

### 2. RPC 连接失败

**解决方案:**
- 确认端口 6800 未被占用
- 检查防火墙设置
- 查看 Aria2 日志文件

### 3. 下载目录权限问题

**解决方案:**
- 确保用户对 `downloads` 目录有写权限
- 检查磁盘空间是否充足

## 📌 注意事项

1. **Windows 路径:** 使用正斜杠 `/` 或双反斜杠 `\\`
2. **配置优先级:** `config.json` > 其他方式,不要同时指定多个路径
3. **后台进程:** Aria2 进程会在后台运行,不会显示窗口
4. **自动恢复:** 如果进程异常退出,系统会自动重启(30秒检查一次)

---

最后更新: 2025-10-22
