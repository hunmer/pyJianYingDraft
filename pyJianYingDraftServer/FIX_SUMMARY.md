# 数据持久化问题修复总结

## 问题描述

**原始问题**：`get_aria2_groups` 下载组数据没有持久化保存，重启服务器后会丢失。

## 根本原因

1. **数据库模型字段缺失**：`TaskModel` 缺少 `rule_group` 等关键字段
2. **无数据库集成**：`TaskQueue` 完全没有与数据库集成，任务只存在内存中
3. **缺少依赖库**：缺少 `greenlet` 异步数据库依赖

## 修复内容

### 1. 数据库模型增强 (`app/db.py`)

**新增字段**：
- `rule_group` (Text): 完整的规则组对象（**核心修复**）
- `segment_styles` (Text): 片段样式配置
- `use_raw_segments` (Integer): 是否使用原始片段
- `raw_segments` (Text): 原始片段数据
- `raw_materials` (Text): 原始素材数据

**修改位置**：
```python
# app/db.py:35-44
rule_group_id = Column(String, nullable=True)
rule_group = Column(Text, nullable=True)              # 新增
draft_config = Column(Text, nullable=True)
materials = Column(Text, nullable=True)
test_data = Column(Text, nullable=True)
segment_styles = Column(Text, nullable=True)          # 新增
use_raw_segments = Column(Integer, default=0)         # 新增
raw_segments = Column(Text, nullable=True)            # 新增
raw_materials = Column(Text, nullable=True)           # 新增
```

### 2. 序列化/反序列化更新

**`to_download_task()` 方法** (app/db.py:61-99)：
- 添加新字段的反序列化逻辑
- 正确解析 JSON 字段

**`from_download_task()` 方法** (app/db.py:101-139)：
- 添加新字段的序列化逻辑
- 使用 `ensure_ascii=False` 保证中文正确存储

### 3. TaskQueue 数据库集成 (`app/services/task_queue.py`)

**新增数据库实例** (task_queue.py:61-62)：
```python
# 数据库实例（延迟初始化，在start()中设置）
self.db = None
```

**新增数据库加载方法** (task_queue.py:94-114)：
```python
async def load_tasks_from_db(self) -> None:
    """从数据库加载所有任务到内存"""
    from app.db import get_database
    self.db = await get_database()
    tasks = await self.db.load_all_tasks()
    for task in tasks:
        self.tasks[task.task_id] = task
    # 恢复GID到路径的映射
    if self.aria2_client:
        self._restore_gid_path_mappings()
```

**任务创建时保存** (task_queue.py:227-239)：
```python
# 保存任务到数据库
try:
    # 确保数据库已初始化
    if not self.db:
        from app.db import get_database
        self.db = await get_database()

    await self.db.save_task(task)
    self._log(f"✓ 任务已保存到数据库: {task_id}")
except Exception as e:
    self._log(f"⚠ 保存任务到数据库失败: {e}")
```

**状态更新时同步** (task_queue.py:709-711)：
```python
# 保存到数据库
if self.db:
    asyncio.create_task(self._save_task_to_db(task))
```

**新增保存辅助方法** (task_queue.py:722-738)：
```python
async def _save_task_to_db(self, task: DownloadTask) -> None:
    """保存任务到数据库"""
    try:
        if not self.db:
            from app.db import get_database
            self.db = await get_database()
        await self.db.save_task(task)
    except Exception as e:
        self._log(f"⚠ 保存任务到数据库失败: {e}")
```

### 4. 启动流程调整 (`app/main.py`)

**调整初始化顺序** (main.py:68-100)：
```python
# 先初始化数据库
from app.db import get_database
await get_database()

# 再启动任务队列
queue = get_task_queue()
queue.sio = sio
queue.start()

# 从数据库加载历史任务 (新增)
await queue.load_tasks_from_db()

# 启动进度监控
await queue.start_progress_monitor()
```

### 5. 依赖库更新

**新增依赖**：
```bash
pip install greenlet
```

该库是 SQLAlchemy 异步引擎所需的依赖。

## 验证方法

### 1. 运行数据库测试

```bash
cd pyJianYingDraftServer
python test_database.py
```

**预期输出**：
```
✓ 数据库已初始化
✓ 测试任务已创建
✓ 任务已保存到数据库
✓ 任务加载成功
  - 规则组标题: 测试规则组
  - 规则组规则数: 1
✓ 状态更新验证成功
✅ 数据库测试完成！
```

### 2. 检查数据库文件

```bash
ls -lh pyJianYingDraftServer/tasks.db
sqlite3 tasks.db "SELECT task_id, status, rule_group_id FROM download_tasks;"
```

### 3. 重启测试

1. 启动服务器并创建任务
2. 检查日志：`✓ 任务已保存到数据库`
3. 重启服务器
4. 检查日志：`✓ 从数据库加载了 X 个任务`
5. 调用 `/api/tasks` API 查看任务列表
6. 使用 WebSocket 的 `get_aria2_groups` 事件获取下载组

## 关键修复点

### 问题 1：数据库未初始化
**原因**：`self.db` 在任务创建时可能为 `None`
**修复**：在所有数据库操作前检查并初始化

```python
if not self.db:
    from app.db import get_database
    self.db = await get_database()
```

### 问题 2：字段缺失
**原因**：数据库表缺少 `rule_group` 等字段
**修复**：添加完整字段定义并更新序列化逻辑

### 问题 3：启动顺序
**原因**：数据库加载在任务队列启动之后
**修复**：调整启动顺序，确保数据库先初始化

## 数据库位置

- **开发环境**：`pyJianYingDraftServer/tasks.db`
- **打包环境**：`<exe目录>/tasks.db`

## 数据库表结构

```sql
CREATE TABLE download_tasks (
    task_id VARCHAR PRIMARY KEY,
    status VARCHAR NOT NULL,
    batch_id VARCHAR,
    rule_group_id VARCHAR,
    rule_group TEXT,              -- 新增
    draft_config TEXT,
    materials TEXT,
    test_data TEXT,
    segment_styles TEXT,          -- 新增
    use_raw_segments INTEGER,     -- 新增
    raw_segments TEXT,            -- 新增
    raw_materials TEXT,           -- 新增
    gid_to_path_map TEXT,
    progress_json TEXT,
    draft_path VARCHAR,
    error_message TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    completed_at DATETIME
);
```

## 已测试功能

- ✅ 任务创建并保存到数据库
- ✅ 任务状态更新同步到数据库
- ✅ 服务器重启后从数据库加载任务
- ✅ rule_group 完整对象正确保存和加载
- ✅ segment_styles 等其他字段正确保存
- ✅ GID 到路径映射恢复
- ✅ 进度信息持久化

## 注意事项

1. **数据库备份**：建议定期备份 `tasks.db` 文件
2. **旧数据迁移**：如有旧数据库，需手动添加新字段（参见 `DATABASE_MIGRATION_GUIDE.md`）
3. **磁盘空间**：长时间运行会积累任务数据，系统会自动清理 7 天前的已完成任务
4. **中文支持**：所有 JSON 字段使用 `ensure_ascii=False` 确保中文正确存储

## 相关文件

- `app/db.py` - 数据库模型和操作
- `app/services/task_queue.py` - 任务队列管理
- `app/models/download_models.py` - 任务数据模型
- `app/main.py` - 应用启动流程
- `test_database.py` - 数据库测试脚本
- `DATABASE_MIGRATION_GUIDE.md` - 详细迁移指南

## 修复时间

2025-01-27

## 版本

修复后版本支持完整的任务持久化，服务器重启后所有任务信息（包括下载组数据）都会正确恢复。
