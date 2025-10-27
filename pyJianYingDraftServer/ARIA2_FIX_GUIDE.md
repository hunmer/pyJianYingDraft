# Aria2 多进程问题修复指南

## 🐛 问题描述

运行服务器时,会创建多个 `aria2c.exe` 进程,导致端口冲突和资源浪费。

## 🔍 根本原因

**uvicorn 热重载** (`reload=True`) 导致每次代码变化时重启应用,但旧的 aria2c 进程未被清理。

## ✅ 解决方案

### 1. 立即清理现有进程

```bash
# Windows
python cleanup_aria2.py

# 或手动
taskkill //F //IM aria2c.exe
```

### 2. 重启服务器

**重要**: 必须完全停止并重启服务器才能应用 `reload=False` 修复。

```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
python run.py
```

### 3. 验证修复

```bash
# Windows - 检查aria2c进程数量
tasklist | findstr aria2c

# 应该只看到 1 个进程 (或 0 个如果未启动)
```

## 📝 修改说明

### 关键修改

**1. `run.py` - 禁用热重载**
```python
uvicorn.run(
    "app.main:socket_app",
    reload=False,  # ⚠️ 禁用热重载
    ...
)
```

**2. `run.py` - 启动前清理**
```python
# 启动前清理所有 aria2c 进程
from cleanup_aria2 import cleanup_aria2
cleanup_aria2()
```

**3. 新增文件**
- `cleanup_aria2.py` - 清理脚本
- `app/services/aria2_singleton.py` - 文件锁守护者
- `app/services/aria2_controller.py` - 轻量级控制器
- `ARIA2_ARCHITECTURE.md` - 架构文档

### 架构改进

```
应用层 (路由/WebSocket)
    ↓
Aria2Controller (单例门面)
    ↓
Aria2ProcessManager (私有管理器)
    ↓
Aria2Singleton (文件锁守护)
    ↓
aria2c.exe (唯一进程)
```

## 🚨 注意事项

### 开发环境

- ⚠️ **热重载已禁用**: 修改代码后需要手动重启服务器
- 如需开启热重载 (不推荐): 设置 `reload=True`,但会有多进程风险

### 生产环境

- ✅ **保持 `reload=False`**: 生产环境不应使用热重载
- ✅ **使用进程管理器**: 如 supervisor, systemd, PM2

## 🧪 测试步骤

### 1. 清理环境

```bash
python cleanup_aria2.py
```

### 2. 启动服务器

```bash
python run.py
```

### 3. 验证进程数量

```bash
# 等待 5 秒后检查
timeout 5
tasklist | findstr aria2c

# 应该只有 1 个进程
```

### 4. 并发测试

打开浏览器,快速刷新页面 10 次,再次检查:

```bash
tasklist | findstr aria2c

# 仍应该只有 1 个进程
```

## 📚 相关文件

- `run.py` - 启动脚本 (已修改)
- `cleanup_aria2.py` - 清理脚本 (新增)
- `app/services/aria2_manager.py` - 进程管理器 (强化)
- `app/services/aria2_controller.py` - 控制器 (新增)
- `app/services/aria2_singleton.py` - 单例守护 (新增)
- `ARIA2_ARCHITECTURE.md` - 完整架构文档

## ❓ 常见问题

### Q: 为什么禁用热重载?

A: 热重载会重启应用但不清理子进程,导致 aria2c 越来越多。生产环境从不使用热重载。

### Q: 开发时如何快速重启?

A: 使用 `Ctrl+C` 停止,然后 `python run.py` 重启。或使用 `nodemon` 等工具。

### Q: 还是有多个进程怎么办?

A:
1. 确认已完全停止旧服务器
2. 运行 `python cleanup_aria2.py`
3. 检查 `run.py` 中 `reload=False`
4. 重新启动服务器

### Q: 如何在不重启服务器的情况下开发?

A: 只修改前端代码,或使用 FastAPI 的代码注入功能(但不推荐用于生产)。

## 🎯 验收标准

✅ 运行 `tasklist | findstr aria2c` 只显示 **1 个进程**
✅ 重启服务器后仍然只有 **1 个进程**
✅ 并发访问后仍然只有 **1 个进程**
✅ 服务器关闭后 aria2c 也被清理

---

**最后更新**: 2025-01-27
**状态**: ✅ 已修复
