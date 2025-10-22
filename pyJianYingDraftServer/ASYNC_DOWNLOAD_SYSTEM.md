# 异步下载进度系统实现文档

## 📋 系统概述

本系统实现了基于Aria2c的异步下载进度监控系统，支持：
- ✅ HTTP异步任务提交
- ✅ WebSocket实时进度推送
- ✅ Aria2c RPC高性能下载
- ✅ SQLite任务持久化
- ✅ 自动Aria2进程管理

## 🏗️ 架构设计

```
前端 (React/Next.js)
  ↓ HTTP POST /api/tasks/submit
后端 FastAPI
  ↓ TaskQueue.create_task()
异步任务处理
  ├─ Aria2Manager: 确保aria2c运行
  ├─ Aria2Client: 提交批量下载
  ├─ 进度监控: 定期轮询进度
  ├─ WebSocket: 推送进度给前端
  └─ 草稿生成: 下载完成后调用pyJianYingDraft
```

## 📁 核心模块

### 1. Aria2进程管理器
**文件**: `app/services/aria2_manager.py`

**功能**:
- 自动查找aria2c可执行文件（支持打包和系统安装）
- 生成默认配置文件（aria2.conf）
- 启动/停止/重启进程
- 健康检查和自动恢复

**使用方法**:
```python
from app.services.aria2_manager import get_aria2_manager

manager = get_aria2_manager()
manager.start()  # 启动aria2c
print(f"RPC URL: {manager.get_rpc_url()}")
print(f"RPC Secret: {manager.get_rpc_secret()}")
```

### 2. Aria2 RPC客户端
**文件**: `app/services/aria2_client.py`

**功能**:
- 封装aria2p库的RPC调用
- 批量下载接口
- 进度查询（单个/批量）
- 任务暂停/恢复/取消

**使用方法**:
```python
from app.services.aria2_client import get_aria2_client

client = get_aria2_client(
    rpc_url="http://localhost:6800/jsonrpc",
    rpc_secret="your_secret"
)

# 批量下载
urls_with_paths = [
    ("http://example.com/video.mp4", "/path/to/save/video.mp4"),
    ("http://example.com/audio.mp3", "/path/to/save/audio.mp3")
]
batch_id = await client.add_batch_downloads(urls_with_paths)

# 查询进度
progress = client.get_batch_progress(batch_id)
print(f"进度: {progress.progress_percent}%")
print(f"速度: {progress.total_speed / 1024 / 1024:.2f} MB/s")
```

### 3. 任务队列管理器
**文件**: `app/services/task_queue.py`

**功能**:
- 任务CRUD（创建/查询/更新/删除）
- 自动下载流程编排
- 进度监控后台任务
- WebSocket订阅管理

**使用方法**:
```python
from app.services.task_queue import get_task_queue
from app.models.download_models import TaskSubmitRequest

queue = get_task_queue()

# 创建任务
request = TaskSubmitRequest(
    ruleGroup={"id": "test", "title": "测试"},
    materials={"videos": [], "audios": []},
    draft_config={"canvas_width": 1920, "canvas_height": 1080}
)
task_id = await queue.create_task(request)

# 查询任务
task = queue.get_task(task_id)
print(f"状态: {task.status}")
if task.progress:
    print(f"进度: {task.progress.progress_percent}%")
```

### 4. 数据库持久化
**文件**: `app/db.py`

**功能**:
- SQLite异步数据库
- 任务自动保存/加载
- 旧任务清理

**使用方法**:
```python
from app.db import get_database

db = await get_database()

# 保存任务
await db.save_task(task)

# 加载任务
task = await db.load_task(task_id)

# 清理7天前的旧任务
deleted_count = await db.cleanup_old_tasks(days=7)
```

### 5. HTTP接口
**文件**: `app/routers/tasks.py`

**端点**:
- `POST /api/tasks/submit` - 提交任务
- `GET /api/tasks/{task_id}` - 查询任务
- `GET /api/tasks` - 列出任务
- `POST /api/tasks/{task_id}/cancel` - 取消任务

## 🔧 集成步骤

### Step 1: 安装依赖
```bash
cd pyJianYingDraftServer
pip install -r requirements.txt
```

### Step 2: 安装Aria2c

**Windows (Scoop)**:
```powershell
scoop install aria2
```

**Linux**:
```bash
sudo apt install aria2
```

**或直接使用项目打包的aria2c**:
- 将aria2c可执行文件放到 `pyJianYingDraftServer/resources/` 目录

### Step 3: 注册路由到main.py

在 `app/main.py` 中添加:
```python
from app.routers import tasks

app.include_router(tasks.router)
```

### Step 4: 启动Aria2和TaskQueue

在 `app/main.py` 的启动事件中添加:
```python
from app.services.aria2_manager import get_aria2_manager
from app.services.task_queue import get_task_queue

@app.on_event("startup")
async def startup():
    # 启动Aria2
    manager = get_aria2_manager()
    manager.start()
    manager.start_health_check()

    # 启动任务队列进度监控
    queue = get_task_queue()
    await queue.start_progress_monitor()

@app.on_event("shutdown")
async def shutdown():
    # 停止Aria2
    manager = get_aria2_manager()
    manager.stop_health_check()
    manager.stop()

    # 停止任务队列
    queue = get_task_queue()
    await queue.stop_progress_monitor()
```

### Step 5: WebSocket事件（待实现）

需要在 `app/main.py` 中扩展Socket.IO事件:
```python
@sio.on("subscribe_task")
async def subscribe_task(sid, data):
    task_id = data.get("task_id")
    queue = get_task_queue()
    queue.subscribe(task_id, sid)
    await sio.emit("subscribed", {"task_id": task_id}, room=sid)

@sio.on("unsubscribe_task")
async def unsubscribe_task(sid, data):
    task_id = data.get("task_id")
    queue = get_task_queue()
    queue.unsubscribe(task_id, sid)
```

## 🔄 数据流程

### 1. 任务提交流程
```
1. 前端: POST /api/tasks/submit
   ↓
2. TaskQueue.create_task()
   - 生成task_id
   - 保存到内存和数据库
   ↓
3. 返回task_id给前端
   ↓
4. 后台启动_process_task()异步处理
```

### 2. 下载流程
```
1. _process_task()
   ↓
2. 提取所有HTTP URL
   ↓
3. Aria2Manager.ensure_running()
   ↓
4. Aria2Client.add_batch_downloads()
   - 返回batch_id
   ↓
5. 等待下载完成
   - 定期查询进度
   - 更新task.progress
   ↓
6. 下载完成
```

### 3. 草稿生成流程
```
1. _generate_draft()
   ↓
2. 调用RuleTestService.run_test()
   ↓
3. pyJianYingDraft生成草稿
   ↓
4. 更新task.status = COMPLETED
   ↓
5. 设置task.draft_path
```

### 4. 进度推送流程
```
1. 前端: socket.emit("subscribe_task", {task_id})
   ↓
2. TaskQueue.subscribe(task_id, sid)
   ↓
3. 后台任务每1秒:
   - 获取所有DOWNLOADING任务
   - 调用Aria2Client.get_batch_progress()
   - 更新task.progress
   ↓
4. WebSocket推送 (需实现):
   socket.emit("task_progress", progress, room=sid)
```

## 📊 数据模型

### TaskStatus 枚举
```python
PENDING = "pending"        # 等待中
DOWNLOADING = "downloading"  # 下载中
PROCESSING = "processing"   # 生成草稿中
COMPLETED = "completed"     # 已完成
FAILED = "failed"          # 失败
CANCELLED = "cancelled"    # 已取消
```

### DownloadProgressInfo
```python
{
    "total_files": 10,
    "completed_files": 3,
    "failed_files": 0,
    "total_size": 104857600,    # 字节
    "downloaded_size": 31457280, # 字节
    "progress_percent": 30.0,    # 0-100
    "download_speed": 1048576,   # 字节/秒
    "eta_seconds": 70            # 预计剩余秒数
}
```

## 🧪 测试

### 测试任务提交
```bash
curl -X POST http://localhost:8000/api/tasks/submit \
  -H "Content-Type: application/json" \
  -d '{
    "ruleGroup": {"id": "test", "title": "测试"},
    "materials": {"videos": [], "audios": []},
    "draft_config": {
      "canvas_config": {"canvas_width": 1920, "canvas_height": 1080},
      "fps": 30
    }
  }'
```

### 查询任务状态
```bash
curl http://localhost:8000/api/tasks/{task_id}
```

### 列出所有任务
```bash
curl http://localhost:8000/api/tasks?status=downloading&limit=20
```

## ⚠️ 注意事项

1. **Aria2c路径**: 如果自动查找失败，在config.json中指定:
   ```json
   {
     "aria2c_path": "C:/path/to/aria2c.exe"
   }
   ```

2. **下载目录**: 默认为 `pyJianYingDraftServer/downloads/`，可配置

3. **RPC密钥**: 自动生成，通过 `manager.get_rpc_secret()` 获取

4. **数据库文件**: 默认为 `pyJianYingDraftServer/tasks.db`

5. **并发限制**:
   - 最大并发下载数: 50 (可在aria2.conf中配置)
   - 最大活跃任务数: 10 (TaskQueue配置)

## 🔜 待实现功能

- [ ] WebSocket进度推送的完整实现
- [ ] 前端React组件 (useTaskProgress Hook + ProgressBar)
- [ ] Timeline.tsx集成异步任务提交
- [ ] 任务失败重试机制
- [ ] 下载速度限制配置
- [ ] 任务优先级队列

## 📝 更新日志

### 2025-10-22
- ✅ 创建Aria2进程管理器
- ✅ 创建Aria2 RPC客户端
- ✅ 创建任务队列管理器
- ✅ 实现SQLite持久化
- ✅ 创建HTTP接口
- ✅ 集成草稿生成逻辑

## 📚 参考文档

- [Aria2 Manual](https://aria2.github.io/manual/en/html/)
- [aria2p Documentation](https://aria2p.readthedocs.io/)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
