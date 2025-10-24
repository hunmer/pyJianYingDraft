# 远程素材下载功能迁移指南

## 重要变更

从 v0.2.6 开始，`pyJianYingDraft` 已移除内置的远程素材下载功能（基于 aiohttp）。

**原因：**
- 内置下载功能功能有限，不支持断点续传、速度限制等高级特性
- aria2 是更专业的下载工具，支持多线程、断点续传、速度控制等
- 统一使用 aria2 可以简化代码维护

## 迁移方案

### 旧方式（已废弃）

```python
import pyJianYingDraft as draft

script = draft.DraftFolder("草稿路径").load_template("模板名称")

# 添加远程素材
script.imported_materials["videos"] = [
    {
        "id": "video-1",
        "path": "https://example.com/video.mp4",
        "material_name": "视频",
        "duration": 5000000,
        "width": 1920,
        "height": 1080,
        "material_type": "video"
    }
]

# ❌ 这些参数已废弃
script.save(
    download_remote=True,
    max_concurrent=50,
    proxy="http://127.0.0.1:7890"
)
```

### 新方式（推荐）

使用 `pyJianYingDraftServer` 提供的 aria2 下载服务：

#### 方式1: 使用 Web 界面（最简单）

1. 启动服务器：
```bash
cd pyJianYingDraftServer
python run.py
```

2. 打开浏览器访问 `http://localhost:3000`

3. 在 Web 界面中：
   - 配置规则组和素材
   - 点击"异步提交"按钮
   - 系统会自动使用 aria2 下载远程素材
   - 在"下载管理"页面查看实时进度

#### 方式2: 使用 API（编程方式）

```python
import requests

# 1. 提交任务
response = requests.post("http://localhost:8000/api/tasks/submit", json={
    "ruleGroup": {
        "id": "rule-group-1",
        "name": "测试规则组",
        "rules": [...]
    },
    "materials": [
        {
            "id": "video-1",
            "url": "https://example.com/video.mp4",  # 远程URL
            "type": "video",
            "name": "视频"
        }
    ],
    "testData": {...},
    "draft_config": {
        "canvas_config": {
            "canvas_width": 1920,
            "canvas_height": 1080
        },
        "fps": 30
    }
})

task_id = response.json()["task_id"]
print(f"任务ID: {task_id}")

# 2. 查询进度
import time
while True:
    progress = requests.get(f"http://localhost:8000/api/tasks/{task_id}/progress")
    data = progress.json()
    
    print(f"状态: {data['status']}")
    print(f"进度: {data['download_progress']['completed_count']}/{data['download_progress']['total_count']}")
    
    if data["status"] in ["COMPLETED", "FAILED"]:
        break
    
    time.sleep(1)

# 3. 获取结果
result = requests.get(f"http://localhost:8000/api/tasks/{task_id}")
print(f"草稿路径: {result.json()['draft_path']}")
```

#### 方式3: 直接使用 aria2 客户端

```python
from pyJianYingDraftServer.app.services.aria2_client import get_aria2_client
from pyJianYingDraftServer.app.services.aria2_manager import get_aria2_manager

# 1. 启动 aria2
manager = get_aria2_manager()
manager.start()

# 2. 创建客户端
client = get_aria2_client(
    rpc_url=manager.get_rpc_url(),
    rpc_secret=manager.get_rpc_secret()
)

# 3. 添加下载任务
import asyncio

async def download():
    # 批量下载
    urls_with_paths = [
        ("https://example.com/video1.mp4", "/path/to/save/video1.mp4"),
        ("https://example.com/video2.mp4", "/path/to/save/video2.mp4"),
    ]
    
    batch_id = await client.add_batch_downloads(urls_with_paths)
    
    # 等待完成
    while True:
        progress = client.get_batch_progress(batch_id)
        print(f"进度: {progress.completed_count}/{progress.total_count}")
        
        if progress.is_completed:
            break
        
        await asyncio.sleep(1)
    
    print("下载完成!")

asyncio.run(download())
```

## 功能对比

| 功能 | 旧方式 (aiohttp) | 新方式 (aria2) |
|-----|-----------------|---------------|
| 并发下载 | ✅ | ✅ |
| 断点续传 | ❌ | ✅ |
| 速度限制 | ❌ | ✅ |
| 实时进度 | ❌ | ✅ |
| 代理支持 | ✅ | ✅ |
| 多线程下载 | ❌ | ✅ |
| 任务队列 | ❌ | ✅ |
| Web 界面 | ❌ | ✅ |

## 常见问题

### Q: 我的旧代码会报错吗？

A: 不会报错，但会显示废弃警告。`download_remote`、`max_concurrent`、`proxy` 等参数会被忽略。

### Q: 我必须使用 pyJianYingDraftServer 吗？

A: 如果你需要下载远程素材，是的。如果你只使用本地素材，可以继续使用 `pyJianYingDraft`。

### Q: 如何配置 aria2 代理？

A: 编辑 `pyJianYingDraftServer/config.json`：
```json
{
  "ARIA2_PROXY": "http://127.0.0.1:7890"
}
```

### Q: aria2 下载速度慢怎么办？

A: 调整 aria2 配置：
```json
{
  "ARIA2_MAX_CONCURRENT_DOWNLOADS": 16,
  "ARIA2_MAX_CONNECTION_PER_SERVER": 16,
  "ARIA2_MIN_SPLIT_SIZE": "1M"
}
```

## 更多信息

- [Aria2 下载系统文档](pyJianYingDraftServer/ASYNC_DOWNLOAD_SYSTEM.md)
- [服务器 API 文档](pyJianYingDraftServer/README.md)
- [Web 界面使用指南](pyjianyingdraft-web/README.md)

## 技术支持

如有问题，请提交 Issue：https://github.com/GuanYixuan/pyJianYingDraft/issues

