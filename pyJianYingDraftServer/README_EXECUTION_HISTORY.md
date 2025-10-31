# 工作流执行历史本地存储功能

## 功能概述

工作流执行历史功能已改为使用本地 JSON 文件存储，不再依赖 Coze API。每个工作流的所有执行记录都存储在独立的 JSON 文件中，支持完整的 CRUD 操作。

## 文件结构

```
data/execution_history/
├── {workflow_id}.json          # 每个工作流一个文件
└── ...
```

## 主要特性

### 1. 自动记录执行历史
- **开始执行时**: 自动创建执行记录，包含输入参数、工作流ID、时间戳等信息
- **执行完成后**: 自动更新执行记录，包含输出结果、执行状态、错误信息等

### 2. 支持的执行状态
- `running`: 执行中
- `success`: 执行成功
- `failed`: 执行失败
- `interrupted`: 执行中断

### 3. 数据存储格式
每个执行记录包含以下字段：
```json
{
  "execute_id": "UUID",
  "workflow_id": "工作流ID",
  "create_time": 1761901941289,
  "update_time": 1761901941290,
  "execute_status": "success",
  "error_code": null,
  "error_message": null,
  "output": {"result": "执行结果"},
  "input_parameters": {"param1": "value1"},
  "bot_id": "机器人ID",
  "conversation_id": "会话ID",
  "debug_url": null,
  "run_mode": 1,
  "usage": {"tokens": 100},
  "metadata": {}
}
```

## API 接口

### 1. 获取工作流执行历史列表
```
GET /coze/workflows/{workflow_id}/history
```

**参数:**
- `workflow_id`: 工作流ID
- `page_size`: 每页数量 (1-100)
- `page_index`: 页码 (从1开始)

**响应:**
```json
{
  "success": true,
  "histories": [...],
  "total": 10,
  "has_more": true
}
```

### 2. 获取单个执行记录详情
```
GET /coze/workflows/{workflow_id}/history/{execute_id}
```

**参数:**
- `workflow_id`: 工作流ID
- `execute_id`: 执行ID

**响应:**
```json
{
  "success": true,
  "execution": {
    "execute_id": "...",
    "workflow_id": "...",
    // 完整的执行记录
  }
}
```

## 服务接口

### ExecutionHistoryService

#### 主要方法：

1. **创建执行记录**
```python
await service.create_execution_record(
    workflow_id="workflow_123",
    parameters={"input": "value"},
    bot_id="bot_123",
    conversation_id="conv_123"
)
```

2. **更新执行记录**
```python
await service.update_execution_record(
    workflow_id="workflow_123",
    execute_id="execute_id",
    execute_status="success",
    output={"result": "success"},
    usage={"tokens": 100}
)
```

3. **获取执行历史**
```python
history = await service.get_execution_history(
    workflow_id="workflow_123",
    page_size=20,
    page_index=1
)
```

4. **获取执行详情**
```python
detail = await service.get_execution_detail(
    workflow_id="workflow_123",
    execute_id="execute_id"
)
```

## 集成点

### 1. execute_workflow 方法
- 工作流开始时：调用 `create_execution_record`
- 工作流完成时：调用 `update_execution_record`

### 2. stream_run_workflow 路由
- 工作流开始时：调用 `create_execution_record`
- 执行过程中：收集输出和错误信息
- 流结束时：调用 `update_execution_record`

### 3. API 路由
- `get_workflow_history`: 从本地存储读取历史列表
- `get_execution_detail`: 从本地存储读取执行详情

## 数据持久化

### 文件存储策略
- 每个工作流一个独立的 JSON 文件
- 文件按工作流 ID 命名：`{workflow_id}.json`
- 数据自动按创建时间倒序排序
- 支持并发访问（使用线程锁）

### 数据备份
建议定期备份 `data/execution_history/` 目录以防止数据丢失。

### 清理策略
可以通过以下方法清理数据：
```python
# 清空单个工作流的历史
await service.clear_workflow_history("workflow_id")

# 删除单个执行记录
await service.delete_execution_record("workflow_id", "execute_id")
```

## 性能考虑

1. **内存使用**: 每次操作都会加载和保存整个 JSON 文件
2. **并发安全**: 使用线程锁保护文件操作
3. **存储效率**: JSON 格式易于阅读和调试，但文件大小可能较大

## 测试

运行测试脚本验证功能：
```bash
python test_execution_history_simple.py
```

测试覆盖：
- 创建执行记录
- 更新执行记录
- 获取历史列表（分页）
- 获取执行详情
- 文件存储验证
- 数据清理

## 与 Coze API 的差异

| 功能 | 原版本 | 新版本 |
|------|--------|--------|
| 数据来源 | Coze API | 本地 JSON |
| 查询速度 | 依赖网络 | 本地访问 |
| 数据持久性 | 依赖 Coze | 本地存储 |
| 离线访问 | 不可用 | 支持 |
| 数据量限制 | Coze 限制 | 磁盘空间 |

## 注意事项

1. **磁盘空间**: 长期运行会积累大量执行记录，需要定期清理
2. **文件备份**: 建议配置自动备份策略
3. **数据同步**: 如需与其他系统同步，需要开发额外的同步机制
4. **安全性**: 确保存储目录有适当的访问权限

## 故障排查

### 常见问题：

1. **文件���限错误**
   - 确保应用有读写 `data/execution_history/` 目录的权限

2. **JSON 解析错误**
   - 检查文件是否损坏，可以删除损坏的文件重新开始

3. **磁盘空间不足**
   - 清理旧的执行记录或扩展磁盘空间

4. **并发冲突**
   - 服务已内置线程锁，但高并发时仍需监控性能