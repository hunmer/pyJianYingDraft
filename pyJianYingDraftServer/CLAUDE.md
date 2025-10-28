# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**pyJianYingDraftServer** 是基于 FastAPI 的剪映草稿 API 服务器,提供:
- ✅ REST API: 解析和操作剪映草稿文件
- ✅ WebSocket: 实时任务进度推送和文件版本监控
- ✅ 异步下载: 基于 Aria2 的高性能下载系统
- ✅ 草稿生成: 通过规则组批量生成剪映草稿
- ✅ 跨平台打包: PyInstaller 单文件可执行程序

**依赖关系**:
- 依赖于父项目 `pyJianYingDraft` (剪映草稿文件 Python 库)
- 该服务器作为 Electron 应用 `pyjianyingdraft-web` 的后端

## 开发环境

### 快速启动
```bash
# 开发模式 (支持热重载)
python run.py

# 或使用 uvicorn
uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000

# 生产模式 (禁用热重载)
python run_production.py
```

**重要**: 开发模式下必须禁用热重载 (`--reload=False`),否则会导致多个 Aria2 进程冲突。

### 测试
```bash
# 端到端测试
python test_e2e.py

# 数据库测试
python test_database.py

# 规则组测试
python test_groups.py
```

### 打包
```bash
# 打包为单个可执行文件
python build_server.py

# 输出: dist/pyJianYingDraftServer.exe
# 自动复制到: ../pyjianyingdraft-web/resources/
```

## 架构设计

### 核心层次

```
┌─────────────────────────────────────────┐
│      FastAPI + Socket.IO (app/main.py)  │
│  - 路由注册                              │
│  - WebSocket 事件处理                    │
│  - 生命周期管理 (startup/shutdown)       │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│          路由层 (app/routers/)           │
│  - draft.py: 草稿基础信息                │
│  - subdrafts.py: 复合片段                │
│  - materials.py: 素材管理                │
│  - tracks.py: 轨道管理                   │
│  - rules.py: 规则测试                    │
│  - tasks.py: 异步任务提交                │
│  - aria2.py: Aria2 下载管理              │
│  - file_watch.py: 文件版本监控           │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│        服务层 (app/services/)            │
│  - draft_service.py: 草稿解析            │
│  - rule_test_service.py: 规则执行        │
│  - task_queue.py: 任务队列管理           │
│  - aria2_manager.py: Aria2 进程管理      │
│  - aria2_client.py: Aria2 RPC 客户端     │
│  - file_watch_service.py: 文件版本管理   │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│        数据模型 (app/models/)            │
│  - draft_models.py: 草稿数据结构         │
│  - rule_models.py: 规则和测试数据        │
│  - download_models.py: 下载任务模型      │
│  - file_watch_models.py: 文件版本模型    │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│       持久化层 (app/db.py)               │
│  - SQLite 异步数据库                     │
│  - 任务持久化                            │
└─────────────────────────────────────────┘
```

### 异步下载系统架构

**核心流程**: HTTP 任务提交 → TaskQueue 异步处理 → Aria2 批量下载 → 进度监控 → WebSocket 推送 → 草稿生成

**关键组件**:

1. **Aria2ProcessManager** (`aria2_manager.py`)
   - 单例模式,全局唯一 Aria2 进程
   - 自动查找 aria2c 可执行文件 (支持打包环境)
   - 生成配置文件 (`aria2.conf`)
   - 健康检查和自动重启

2. **Aria2Client** (`aria2_client.py`)
   - 封装 aria2p 库的 RPC 调用
   - 批量下载接口: `add_batch_downloads(urls_with_paths)`
   - 进度查询: `get_batch_progress(batch_id)`
   - 失败重试机制 (最多 3 次,指数退避)

3. **TaskQueue** (`task_queue.py`)
   - 任务 CRUD 和状态管理
   - 异步任务处理流程: `PENDING → DOWNLOADING → PROCESSING → COMPLETED/FAILED`
   - 后台进度监控 (每 1 秒轮询)
   - WebSocket 订阅管理

4. **Database** (`db.py`)
   - SQLite + SQLAlchemy 异步 ORM
   - 任务持久化 (支持服务器重启后恢复)
   - 自动清理旧任务 (默认保留 30 天)

**详细文档**: 参见 `ASYNC_DOWNLOAD_SYSTEM.md` 和 `ARIA2_ARCHITECTURE.md`

## 关键概念

### 规则组 (Rule Group)
规则组定义了如何将素材组合成剪映草稿。每个规则指定一种素材类型 (如图片、字幕、音频) 和对应的素材 ID。

**规则类型映射**:
- `image`, `video` → 视频轨道
- `audio`, `music`, `sound`, `extract_music` → 音频轨道
- `text`, `subtitle` → 文本轨道
- `video_effect` → 特效轨道

### 测试数据 (Test Data)
测试数据描述草稿的时间轴结构,包含:
- `tracks`: 轨道列表 (每个轨道包含多个片段)
- `segments`: 片段时间范围 (`target_timerange`)
- `styles`: 片段样式 (关键帧、动画、特效等)

### 原始片段模式 (Raw Segments)
允许直接控制草稿的底层结构,用于高级用户和模板替换场景。启用方式:
```json
{
  "use_raw_segments": true,
  "raw_segments": [...]
}
```

### 文件版本管理
自动备份并追踪文件的修改历史,支持:
- 版本列表查询
- 历史版本内容查看
- 最大保留 10 个版本
- 通过 WebSocket 实时推送更新

## 配置管理

### config.json 关键配置
```json
{
  "PYJY_DRAFT_ROOT": "剪映草稿文件夹路径",
  "ARIA2_PATH": "aria2c 可执行文件路径 (可选)",
  "PYJY_RULE_GROUPS": [规则组数组]
}
```

**路径自动发现顺序**:
1. `config.json` 中指定的路径
2. 打包资源目录 (`resources/aria2c.exe`)
3. 系统 PATH 中的 `aria2c`

### 环境变量
- `PYTHONUNBUFFERED=1`: 强制日志实时输出 (已在 `run.py` 中设置)

## 常见开发任务

### 添加新的 API 端点

1. 在 `app/models/` 定义请求/响应模型
2. 在 `app/services/` 实现业务逻辑
3. 在 `app/routers/` 创建路由
4. 在 `app/main.py` 注册路由

**示例**:
```python
# app/routers/custom.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/custom")
async def custom_endpoint():
    return {"message": "Custom endpoint"}

# app/main.py
from app.routers import custom
app.include_router(custom.router, prefix="/api/custom", tags=["自定义"])
```

### 添加 WebSocket 事件

在 `app/main.py` 中使用 `@sio.event` 装饰器:
```python
@sio.event
async def my_event(sid, data):
    # 处理逻辑
    await sio.emit('response_event', result, room=sid)
```

### 调试 Aria2 下载问题

1. 检查 Aria2 进程状态:
   ```bash
   # Windows
   tasklist | findstr aria2c
   # Linux/Mac
   ps aux | grep aria2c
   ```

2. 查看 Aria2 日志:
   - 配置文件: `pyJianYingDraftServer/aria2.conf`
   - 日志位置: `pyJianYingDraftServer/aria2.log`

3. 手动清理 Aria2 进程:
   ```bash
   python cleanup_aria2.py
   ```

4. 使用 Aria2 示例脚本测试:
   ```bash
   python example_aria2_usage.py
   ```

**详细排障指南**: 参见 `ARIA2_FIX_GUIDE.md` 和 `ARIA2_RETRY_GUIDE.md`

### 修改草稿生成逻辑

核心逻辑在 `app/services/rule_test_service.py` 的 `RuleTestService.run_test()` 方法。

**关键流程**:
1. 解析 `RuleGroupTestRequest` 获取规则组、素材、测试数据
2. 创建草稿: `DraftFolder.create_draft()`
3. 构建片段计划: `_build_segment_plans()`
4. 添加轨道和片段
5. 保存草稿: `script.dump()`

**注意事项**:
- 主视频轨道片段必须从 0 秒开始
- 轨道层级通过 `relative_index` 或 `absolute_index` 控制
- 时间单位统一为微秒 (使用 `draft.trange()` 辅助函数)

## 重要约定

### 路径处理
- 始终使用 `os.path.join()` 构建跨平台路径
- 支持绝对路径和相对路径
- Windows 路径使用 `Path` 或原始字符串 `r"path\to\file"`

### 时间单位
- 内部统一使用**微秒** (1 秒 = 1,000,000 微秒)
- API 响应同时提供微秒和秒两种格式
- 使用 `pyJianYingDraft.tim()` 和 `trange()` 转换

### 错误处理
- 使用 FastAPI 的 `HTTPException` 返回标准错误
- 异步操作使用 try-except 捕获异常
- 记录详细错误日志便于调试

### 日志规范
- 避免修改根日志配置 (防止与 uvicorn 冲突)
- 使用 `print()` 输出关键事件 (启动、关闭、错误)
- 立即调用 `sys.stdout.flush()` 刷新缓冲区

## 版本兼容性

| 功能 | 剪映版本 | 说明 |
|-----|---------|------|
| 草稿解析 | 5.x ~ 7.x | ✅ 全版本支持 |
| 草稿生成 | 5.x ~ 7.x | ✅ 全版本支持 |
| 模板模式 | ≤ 5.9 | ⚠️ 6+ 版本文件加密 |

## 平台兼容性

- **Windows**: 全功能支持 + 自动导出 (剪映 ≤6.x)
- **Linux/MacOS**: 支持 API 服务和草稿生成

## 典型工作流

### 1. 提交异步任务
```bash
curl -X POST http://localhost:8000/api/tasks/submit \
  -H "Content-Type: application/json" \
  -d @task_payload.json
```

### 2. WebSocket 订阅进度
```javascript
socket.emit('subscribe_task', { task_id: 'xxx' });
socket.on('task_progress', (data) => console.log(data));
```

### 3. 查询任务状态
```bash
curl http://localhost:8000/api/tasks/{task_id}
```

### 4. 获取生成的草稿
任务完成后,`draft_path` 字段包含草稿文件路径。

## 常见陷阱

1. **Aria2 多进程问题**: 启用热重载会创建多个 Aria2 进程,必须禁用 `--reload`
2. **GID 映射丢失**: 服务器重启后 Aria2 的 GID 会改变,需从数据库恢复 `download_files`
3. **下载失败重试**: 默认最多重试 3 次,可在 `aria2_client.py` 的 `MAX_RETRY_COUNT` 修改
4. **草稿路径配置**: 必须在 `config.json` 设置正确的 `PYJY_DRAFT_ROOT`
5. **跨平台路径**: 避免硬编码 Windows 路径,使用 `Path` 和 `os.path.join()`
6. **日志递归**: 不要配置根日志记录器,会与 uvicorn 冲突导致递归错误
7. **时间轴对齐**: 主视频轨道片段不从 0s 开始会导致剪映强制对齐

## API 文档

启动服务后访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 相关文档

- `ASYNC_DOWNLOAD_SYSTEM.md`: 异步下载系统详细设计
- `ARIA2_ARCHITECTURE.md`: Aria2 架构和单例设计
- `PROJECT_STRUCTURE.md`: 完整目录结构说明
- `README_BUILD.md`: 打包说明
- `GID_PATH_MAPPING.md`: GID 与文件路径映射机制
