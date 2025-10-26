# Aria2 客户端重试功能指南

## 概述

Aria2Client 现在支持完善的自动重试机制,可以有效应对以下场景:

1. **网络连接中断** - 自动重试连接
2. **下载失败** - 自动重启失败的任务
3. **Aria2 服务断开** - 智能检测并提示

## 新增功能

### 1. 自动重试机制

当遇到连接错误时,客户端会自动重试,使用**指数退避策略**避免频繁请求:

```python
from app.services.aria2_client import Aria2Client

client = Aria2Client(
    rpc_url="http://localhost:6800/jsonrpc",
    max_retries=3,        # 最大重试次数
    retry_delay=1.0,      # 基础延迟(秒)
    auto_restart_failed=True  # 自动重启失败的下载
)
```

**重试延迟策略:**
- 第1次重试: 1秒
- 第2次重试: 2秒
- 第3次重试: 4秒
- ...以此类推(指数增长)

### 2. 失败任务自动重启

当下载任务进入 `error` 状态时,客户端会自动重启该任务:

```python
# 添加下载
gid = await client.add_download("http://example.com/file.zip", "/tmp/file.zip")

# 获取进度时自动检测并重启失败任务
progress = client.get_progress(gid)
# 如果任务失败,会自动在后台重启

# 或手动重启所有失败任务
restarted_count = await client.restart_all_failed_downloads()
print(f"已重启 {restarted_count} 个失败任务")
```

### 3. 重试信息查询

可以查询任务的重试历史:

```python
retry_info = client.get_retry_info(gid)
# {
#     "gid": "abc123...",
#     "retry_count": 2,
#     "max_retries": 3,
#     "can_retry": True,
#     "url": "http://example.com/file.zip",
#     "options": {...}
# }
```

## 使用示例

### 基本用法

```python
import asyncio
from app.services.aria2_client import Aria2Client

async def main():
    # 创建客户端(启用自动重试)
    client = Aria2Client(
        rpc_url="http://localhost:6800/jsonrpc",
        max_retries=3,
        retry_delay=1.0,
        auto_restart_failed=True,
        verbose=True  # 显示详细日志
    )

    # 添加下载
    gid = await client.add_download(
        url="http://example.com/large-file.zip",
        save_path="/tmp/large-file.zip"
    )

    # 监控进度
    while True:
        await asyncio.sleep(2)
        progress = client.get_progress(gid)

        if progress:
            print(f"进度: {progress.progress_percent:.1f}%")
            print(f"状态: {progress.status}")

            # 如果失败,会自动重启
            if progress.status == "error":
                retry_info = client.get_retry_info(gid)
                print(f"重试次数: {retry_info['retry_count']}/{retry_info['max_retries']}")

            if progress.status == "complete":
                print("下载完成!")
                break

asyncio.run(main())
```

### 批量下载场景

```python
async def batch_download_with_retry():
    client = Aria2Client(
        max_retries=5,  # 批量下载建议更高的重试次数
        auto_restart_failed=True
    )

    urls_with_paths = [
        ("http://cdn1.com/file1.zip", "/tmp/file1.zip"),
        ("http://cdn2.com/file2.zip", "/tmp/file2.zip"),
        ("http://cdn3.com/file3.zip", "/tmp/file3.zip"),
    ]

    batch_id = await client.add_batch_downloads(urls_with_paths)

    # 持续监控直到完成
    while True:
        await asyncio.sleep(5)
        batch_progress = client.get_batch_progress(batch_id)

        if batch_progress:
            print(f"总进度: {batch_progress.progress_percent:.1f}%")
            print(f"成功: {batch_progress.completed_count}")
            print(f"失败: {batch_progress.failed_count}")
            print(f"活跃: {batch_progress.active_count}")

            # 主动重启失败任务
            if batch_progress.failed_count > 0:
                await client.restart_all_failed_downloads()

            if batch_progress.is_completed:
                break
```

### 禁用自动重启

如果需要手动控制重试:

```python
client = Aria2Client(
    auto_restart_failed=False  # 禁用自动重启
)

# 手动检查并重启
progress = client.get_progress(gid, auto_restart=False)
if progress and progress.status == "error":
    # 根据错误码决定是否重启
    if progress.error_code == "1":  # 网络错误
        await client._restart_failed_download(gid)
```

## 错误处理建议

### 1. 连接错误处理

```python
try:
    gid = await client.add_download(url, path)
except Exception as e:
    if "connection" in str(e).lower():
        print("❌ 无法连接到 Aria2 服务,请检查:")
        print("  1. aria2c 是否正在运行")
        print("  2. RPC 端口是否正确 (默认 6800)")
        print("  3. 防火墙设置")
    else:
        print(f"❌ 下载失败: {e}")
```

### 2. 重试次数耗尽处理

```python
progress = client.get_progress(gid)
retry_info = client.get_retry_info(gid)

if progress and progress.status == "error":
    if not retry_info['can_retry']:
        print(f"❌ 任务已达最大重试次数 ({retry_info['max_retries']})")
        print(f"URL: {retry_info['url']}")
        print(f"错误: {progress.error_message}")
        # 发送通知或记录日志
```

## 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_retries` | int | 3 | 网络请求和任务重启的最大重试次数 |
| `retry_delay` | float | 1.0 | 基础重试延迟(秒),实际延迟使用指数退避 |
| `auto_restart_failed` | bool | True | 是否在 `get_progress()` 时自动重启失败任务 |
| `verbose` | bool | True | 是否显示详细日志 |

## 日志输出示例

启用 `verbose=True` 后,会看到如下日志:

```
[Aria2Client 16:13:41] ⚠️  连接失败 (尝试 1/3): Connection refused
[Aria2Client 16:13:41] 等待 1.0 秒后重试...
[Aria2Client 16:13:42] ⚠️  连接失败 (尝试 2/3): Connection refused
[Aria2Client 16:13:42] 等待 2.0 秒后重试...
[Aria2Client 16:13:44] ✓ 添加下载任务: http://example.com/file.zip -> GID: abc123

[Aria2Client 16:15:30] ⚠️  检测到失败任务 (GID: abc123), 准备重启...
[Aria2Client 16:15:30] 🔄 重启失败的下载任务 (尝试 1/3): http://example.com/file.zip
[Aria2Client 16:15:31] ✓ 添加下载任务: http://example.com/file.zip -> GID: def456
```

## 常见问题

### Q: 为什么下载失败后没有自动重启?

A: 检查以下几点:
1. `auto_restart_failed=True` 是否已设置
2. 是否调用了 `get_progress()` 或 `get_batch_progress()` 触发检测
3. 任务是否已达最大重试次数

### Q: 如何调整重试策略?

A: 根据网络环境调整:
```python
# 网络不稳定 - 更多重试,更长延迟
client = Aria2Client(max_retries=5, retry_delay=2.0)

# 快速失败 - 减少重试
client = Aria2Client(max_retries=1, retry_delay=0.5)
```

### Q: 重启任务会重新下载整个文件吗?

A: 不会。Aria2 会保留断点信息,重启后从断点继续下载。

## 测试

运行测试脚本验证功能:

```bash
cd pyJianYingDraftServer
python test_aria2_retry.py
```

确保 aria2c 服务已启动:

```bash
# 启动 aria2c RPC 服务
aria2c --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800
```

## 性能建议

1. **批量下载**: 设置更高的 `max_retries` (5-10)
2. **大文件下载**: 使用较长的 `retry_delay` (2-5秒)
3. **高并发**: 禁用 `auto_restart_failed`,手动批量重启
4. **生产环境**: 结合日志监控和告警系统

## 更新日志

**v1.1.0** (2025-01-26)
- ✨ 新增自动重试机制
- ✨ 新增失败任务自动重启
- ✨ 新增重试信息查询
- ✨ 新增指数退避策略
- 🐛 修复连接中断导致进度查询失败的问题
- 📝 完善错误日志提示
