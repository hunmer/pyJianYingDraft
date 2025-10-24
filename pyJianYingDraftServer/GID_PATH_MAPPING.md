# GID到文件路径映射功能

## 概述

在Aria2下载系统中，每个下载任务都有一个唯一的GID（全局标识符）。为了能够在下载完成后获取到真实的文件路径，我们实现了GID到文件路径的映射机制。

## 实现原理

### 1. 数据流程

```
添加下载任务
    ↓
保存 GID → 文件路径 映射到 Aria2Client
    ↓
保存映射到 DownloadTask.gid_to_path_map
    ↓
持久化到数据库 (TaskModel.gid_to_path_map)
    ↓
查询下载进度时返回文件路径
```

### 2. 核心组件

#### Aria2Client (aria2_client.py)

- **gid_to_path**: 内存中的映射表 `Dict[str, str]`
- **add_download()**: 添加下载时保存映射
- **get_progress()**: 查询进度时返回文件路径
- **get_file_path()**: 根据GID获取文件路径
- **get_all_file_paths()**: 获取所有映射

#### DownloadTask (download_models.py)

- **gid_to_path_map**: 任务级别的映射存储 `Optional[Dict[str, str]]`

#### TaskModel (db.py)

- **gid_to_path_map**: 数据库字段，JSON格式存储

#### TaskQueue (task_queue.py)

- **_process_task()**: 下载完成后保存映射到任务
- **_restore_gid_path_mappings()**: 启动时从任务恢复映射

## 使用示例

### 添加下载并保存路径

```python
from app.services.aria2_client import get_aria2_client

client = get_aria2_client()

# 添加下载（自动保存GID→路径映射）
gid = await client.add_download(
    url="https://example.com/video.mp4",
    save_path="/downloads/task_123/video.mp4"
)

# 查询文件路径
file_path = client.get_file_path(gid)
print(f"文件将保存到: {file_path}")
```

### 查询下载进度（包含文件路径）

```python
# 获取单个下载进度
progress = client.get_progress(gid)
print(f"GID: {progress.gid}")
print(f"状态: {progress.status}")
print(f"文件路径: {progress.file_path}")

# 获取批次进度
batch_progress = client.get_batch_progress(batch_id)
for download in batch_progress.downloads:
    print(f"文件: {download.file_path}, 进度: {download.progress_percent}%")
```

### WebSocket返回文件路径

在 `get_group_downloads` WebSocket事件中，返回的下载信息包含文件路径：

```json
{
  "groupId": "task_123",
  "downloads": [
    {
      "gid": "abc123",
      "status": "complete",
      "totalLength": 1048576,
      "completedLength": 1048576,
      "files": [
        {
          "path": "/downloads/task_123/video.mp4",
          "length": 1048576,
          "completedLength": 1048576,
          "selected": "true"
        }
      ]
    }
  ]
}
```

## 数据持久化

### 数据库表结构

```sql
CREATE TABLE download_tasks (
    task_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    batch_id TEXT,
    gid_to_path_map TEXT,  -- JSON: {"gid1": "/path/to/file1", "gid2": "/path/to/file2"}
    ...
);
```

### 保存到数据库

```python
from app.db import get_database

db = await get_database()

# 任务对象包含映射
task.gid_to_path_map = {
    "abc123": "/downloads/task_123/video.mp4",
    "def456": "/downloads/task_123/audio.mp3"
}

# 保存到数据库
await db.save_task(task)
```

### 从数据库恢复

```python
# 加载任务
task = await db.load_task(task_id)

# 恢复映射到Aria2Client
if task.gid_to_path_map:
    for gid, path in task.gid_to_path_map.items():
        client.gid_to_path[gid] = path
```

## 服务器重启恢复

当服务器重启时，TaskQueue会自动从内存中的任务恢复GID映射：

```python
# 在 TaskQueue.start() 中
def start(self) -> bool:
    success = self._ensure_aria2_running()
    
    # 恢复GID到路径的映射
    if success and self.aria2_client:
        self._restore_gid_path_mappings()
    
    return success

def _restore_gid_path_mappings(self) -> None:
    """从内存中的任务恢复GID到路径的映射"""
    restored_count = 0
    for task in self.tasks.values():
        if task.gid_to_path_map:
            for gid, path in task.gid_to_path_map.items():
                self.aria2_client.gid_to_path[gid] = path
                restored_count += 1
    
    if restored_count > 0:
        self._log(f"✓ 已恢复 {restored_count} 个GID→路径映射")
```

## 前端使用

在前端组件中，可以直接从下载信息中获取文件路径：

```typescript
// Aria2DownloadManager.tsx
const filePath = download.files && download.files.length > 0
  ? download.files[0].path
  : '';

// 使用文件路径
if (filePath) {
  // 打开文件
  await window.electron.fs.openFile(filePath);
  
  // 打开文件所在文件夹
  await window.electron.fs.showInFolder(filePath);
}
```

## 注意事项

1. **映射仅在内存中**: `Aria2Client.gid_to_path` 是内存映射，服务器重启后需要从数据库恢复
2. **任务级别存储**: 每个任务的映射存储在 `DownloadTask.gid_to_path_map` 中
3. **数据库持久化**: 映射会随任务一起保存到数据库
4. **自动恢复**: 服务器启动时会自动恢复所有任务的映射

## 相关文件

- `pyJianYingDraftServer/app/services/aria2_client.py` - Aria2客户端，管理GID映射
- `pyJianYingDraftServer/app/services/task_queue.py` - 任务队列，保存和恢复映射
- `pyJianYingDraftServer/app/models/download_models.py` - 数据模型
- `pyJianYingDraftServer/app/db.py` - 数据库模型
- `pyJianYingDraftServer/app/main.py` - WebSocket事件处理
- `pyjianyingdraft-web/src/components/Aria2DownloadManager.tsx` - 前端组件

