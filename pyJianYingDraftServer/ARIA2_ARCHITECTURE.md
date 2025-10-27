# Aria2 架构设计文档

## 📋 概述

本文档说明了 Aria2 进程管理的架构设计,解决了**多实例并发创建**导致的多个 aria2c 进程问题。

## 🎯 设计目标

1. **确保单例**: 全局只创建一个 `Aria2ProcessManager` 实例
2. **线程安全**: 支持并发请求下的安全启动
3. **职责分离**: 信息查询与进程管理分离
4. **易于使用**: 提供清晰的 API 接口

## 🏗️ 架构设计

### 层次结构

```
┌─────────────────────────────────────────────────┐
│              应用层 (路由/WebSocket)              │
│   aria2.py, main.py, task_queue.py             │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│          Aria2Controller (单例控制器)            │
│  - 轻量级信息查询 (端口/路径/配置)                │
│  - 状态检查 (is_running/get_pid)                │
│  - 进程控制代理 (start/stop/restart)             │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│       Aria2ProcessManager (私有进程管理器)        │
│  - 进程生命周期管理 (启动/停止/重启)               │
│  - 配置文件生成                                   │
│  - 健康检查                                       │
│  - 多实例检测与警告                               │
└─────────────────────────────────────────────────┘
```

## 📦 核心组件

### 1. Aria2ProcessManager (内部类)

**文件**: `app/services/aria2_manager.py`

**职责**:
- aria2c 进程的启动、停止、重启
- 自动查找 aria2c 可执行文件
- 生成配置文件
- 健康检查和自动恢复

**特性**:
- ⚠️ **不应直接实例化**, 通过 `get_aria2_manager()` 访问
- 实例计数器检测多实例创建并发出警告
- 线程安全的启动机制 (双重检查锁定)
- 全局进程跟踪字典 (`_global_aria2_processes`)

**关键方法**:
```python
def start(enable_debug_output: bool = False) -> bool
def stop() -> bool
def restart() -> bool
def is_running() -> bool
def start_health_check(interval: int = 30) -> None
def stop_health_check() -> None
```

### 2. Aria2Controller (单例门面)

**文件**: `app/services/aria2_controller.py`

**职责**:
- 提供统一的 Aria2 访问接口
- 轻量级信息查询 (不触发进程创建)
- 代理进程控制操作到 ProcessManager

**特性**:
- 单例模式 (通过 `__new__` 实现)
- 延迟初始化 (首次访问时才创建 ProcessManager)
- 只读属性访问 (避免误修改)

**推荐API**:
```python
from app.services.aria2_controller import get_aria2_controller

controller = get_aria2_controller()

# 信息查询 (轻量级)
config = controller.get_config()
port = controller.rpc_port
download_dir = controller.download_dir
is_running = controller.is_running()

# 进程控制 (仅管理员使用)
controller.start()
controller.stop()
controller.restart()
```

### 3. 单例访问函数

**`get_aria2_manager()`** - 获取 ProcessManager 单例
- 仅在启动时 (`main.py:lifespan`) 调用一次
- 其他代码应使用 `get_aria2_controller()`

**`get_aria2_controller()`** - 获取 Controller 单例 ✅ **推荐**
- 用于所有信息查询和状态检查
- 用于进程控制操作

## 🔒 线程安全机制

### 1. 全局锁 (端口级别)

每个端口有独立的锁,防止同一端口被多次启动:

```python
_global_aria2_locks = {}  # {rpc_port: threading.Lock}
_global_lock = threading.Lock()  # 保护字典本身的锁
```

### 2. 双重检查锁定 (Double-Checked Locking)

```python
def start(self):
    with self._start_lock:
        if self._is_starting:
            # 等待其他线程完成启动
            wait_for_startup_completion()
            return reuse_existing_process()

        self._is_starting = True
        try:
            # 实际启动逻辑
            ...
        finally:
            self._is_starting = False
```

### 3. 全局进程跟踪

```python
_global_aria2_processes = {port: pid}
```

- 跨实例共享的进程记录
- 启动前检查端口是否已被占用
- 避免重复启动

## 📝 使用规范

### ✅ 正确用法

```python
# 1. 信息查询 (推荐)
from app.services.aria2_controller import get_aria2_controller

controller = get_aria2_controller()
download_dir = controller.download_dir
rpc_port = controller.rpc_port

# 2. 进程控制
controller.start()
controller.restart()

# 3. 状态检查
if controller.is_running():
    print(f"Aria2 running on PID: {controller.get_process_pid()}")
```

### ❌ 错误用法

```python
# ❌ 直接实例化 ProcessManager (会触发警告)
from app.services.aria2_manager import Aria2ProcessManager
manager = Aria2ProcessManager()  # RuntimeWarning!

# ❌ 多次调用 get_aria2_manager() 获取配置
from app.services.aria2_manager import get_aria2_manager
manager = get_aria2_manager()  # 只应在启动时调用一次
```

## 🚀 启动流程

### 服务器启动 (`main.py`)

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动阶段
    from app.services.aria2_manager import get_aria2_manager
    manager = get_aria2_manager()  # 唯一调用点

    if manager.start():
        manager.start_health_check(interval=30)

    yield

    # 关闭阶段
    manager.stop_health_check()
    manager.stop()
```

### 路由处理 (`aria2.py`, WebSocket 事件)

```python
from app.services.aria2_controller import get_aria2_controller

@router.get("/config")
async def get_aria2_config():
    controller = get_aria2_controller()  # 复用单例
    return controller.get_config()
```

## 🔍 多实例检测

当检测到创建了多个 `Aria2ProcessManager` 实例时:

```python
RuntimeWarning: 检测到创建了第 2 个 Aria2ProcessManager 实例!
这可能导致多个 aria2c 进程同时运行。
请使用 get_aria2_manager() 获取单例,或使用 Aria2Controller 进行信息查询。
```

**调试方法**:
1. 查看警告的 `stacklevel=2` 调用栈
2. 检查是否直接 `new Aria2ProcessManager()`
3. 确保使用 `get_aria2_controller()` 而非 `get_aria2_manager()`

## 📊 性能优化

1. **延迟初始化**: Controller 仅在首次访问时创建 ProcessManager
2. **只读属性**: 避免不必要的对象复制
3. **端口复用**: 检测到已有进程时直接复用,不重复启动
4. **并发等待**: 多个线程同时启动时,后续线程等待首个完成

## 🧪 测试建议

### 单元测试

```python
def test_singleton():
    """测试单例模式"""
    controller1 = get_aria2_controller()
    controller2 = get_aria2_controller()
    assert controller1 is controller2

def test_concurrent_start():
    """测试并发启动"""
    threads = [Thread(target=lambda: get_aria2_controller().start())
               for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()

    # 验证只有一个 aria2c 进程
    assert count_aria2_processes() == 1
```

### 集成测试

1. 启动服务器
2. 并发发送 10 个配置查询请求
3. 检查系统中 aria2c 进程数量 = 1

## 📚 相关文件

- `app/services/aria2_manager.py` - 进程管理器
- `app/services/aria2_controller.py` - 控制器门面 ✨
- `app/routers/aria2.py` - HTTP 路由
- `app/main.py` - WebSocket 事件和启动逻辑
- `test_aria2_concurrent.py` - 并发测试脚本

## 🔄 迁移指南

### 从旧代码迁移

**替换规则**:

| 旧代码 | 新代码 |
|--------|--------|
| `from app.services.aria2_manager import get_aria2_manager` | `from app.services.aria2_controller import get_aria2_controller` |
| `manager = get_aria2_manager()` | `controller = get_aria2_controller()` |
| `manager.rpc_port` | `controller.rpc_port` |
| `manager.download_dir` | `controller.download_dir` |
| `manager.start()` | `controller.start()` |

**例外**: `main.py:lifespan` 中保留 `get_aria2_manager()`,因为这是全局唯一的启动点。

## ⚠️ 注意事项

1. **不要**直接实例化 `Aria2ProcessManager`
2. **不要**在多处调用 `get_aria2_manager()`
3. **始终**使用 `get_aria2_controller()` 进行查询和控制
4. **启动时**只在 `main.py:lifespan` 调用 `manager.start()`
5. **运行时**通过 controller 检查状态,不要重复启动

## 🎉 总结

新架构通过以下机制**彻底解决多实例问题**:

1. ✅ **单例模式**: Controller 和 Manager 都是单例
2. ✅ **线程安全**: 端口级锁 + 双重检查锁定
3. ✅ **职责分离**: 查询用 Controller, 管理用 Manager
4. ✅ **多实例检测**: 自动警告非法实例化
5. ✅ **全局跟踪**: 共享进程字典避免重复启动

**关键原则**: "查询用 Controller, 启动在 main.py, 永远不要 new Manager"
