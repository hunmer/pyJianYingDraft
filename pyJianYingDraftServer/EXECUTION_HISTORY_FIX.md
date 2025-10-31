# 工作流执行历史 API 修复说明

## 问题描述

原代码尝试调用 `workflows.runs.run_histories.list()` 方法获取执行历史列表，但 Coze SDK 并未提供此方法，导致以下错误：

```
'AsyncWorkflowsRunsRunHistoriesClient' object has no attribute 'list'
```

## 根本原因

通过分析 Coze SDK 源代码 (`coze-py-main/cozepy/workflows/runs/run_histories/__init__.py`)，发现：

1. **Coze SDK 只提供了 `retrieve` 方法**：用于获取单个执行记录的详细信息
2. **SDK 不提供 `list` 方法**：无法通过 SDK 直接获取执行历史列表
3. **需要直接调用 REST API**：使用 HTTP 客户端调用 `/v1/workflows/{workflow_id}/run_histories` 端点

## 解决方案

### 1. 修改 `get_execution_history()` 方法

**文件**: `app/services/coze_client.py:340`

**修改前**:
```python
response = await self.client.workflows.runs.run_histories.list(...)  # ❌ 方法不存在
```

**修改后**:
```python
# 直接调用 REST API
url = f"{self.config.base_url}/v1/workflows/{workflow_id}/run_histories"
async with httpx.AsyncClient() as http_client:
    response = await http_client.get(url, params=params, headers=headers)
```

### 2. 修正 `get_execution_detail()` 方法

**文件**: `app/services/coze_client.py:408`

**问题**: 使用了错误的字段名 (`input_data`, `output_data`)

**修改**: 根据 `WorkflowRunHistory` 模型定义修正字段：
- ✅ `output` (不是 `output_data`)
- ✅ 添加 `update_time`, `error_code`, `run_mode`, `bot_id` 等完整字段
- ❌ 删除不存在的 `input_data` 字段

### 3. 更新前端 API 客户端

**文件**: `pyjianyingdraft-web/src/lib/api.ts:864`

**新增方法**:
```typescript
async getExecutionDetail(
  workflowId: string,
  executeId: string,
  accountId: string = 'default'
): Promise<any> {
  const url = buildUrl(`/api/coze/workflows/${workflowId}/history/${executeId}`, {
    account_id: accountId,
  });
  const response = await fetch(url);
  return handleResponse<any>(response);
}
```

### 4. 添加路由端点

**文件**: `app/routers/coze.py:287`

**新增端点**:
```
GET /api/coze/workflows/{workflow_id}/history/{execute_id}
```

## API 端点说明

### 1. 获取执行历史列表

**端点**: `GET /api/coze/workflows/{workflow_id}/history`

**参数**:
- `workflow_id` (path): 工作流 ID
- `account_id` (query): 账号 ID，默认 "default"
- `page_size` (query): 每页数量，默认 20
- `page_index` (query): 页码（从 1 开始），默认 1

**响应**:
```json
{
  "success": true,
  "histories": [
    {
      "execute_id": "7xxx",
      "workflow_id": "xxx",
      "create_time": 1234567890,
      "execute_status": "Success",
      "error_message": null
    }
  ],
  "total": 100,
  "has_more": true
}
```

### 2. 获取单个执行记录详情

**端点**: `GET /api/coze/workflows/{workflow_id}/history/{execute_id}`

**参数**:
- `workflow_id` (path): 工作流 ID
- `execute_id` (path): 执行 ID
- `account_id` (query): 账号 ID，默认 "default"

**响应**:
```json
{
  "success": true,
  "execution": {
    "execute_id": "7xxx",
    "workflow_id": "xxx",
    "create_time": 1234567890,
    "update_time": 1234567900,
    "execute_status": "Success",
    "error_code": 0,
    "error_message": null,
    "output": "{\"result\": \"success\"}",
    "debug_url": "https://...",
    "run_mode": 0,
    "bot_id": "xxx",
    "connector_id": "xxx",
    "connector_uid": "xxx",
    "is_output_trimmed": false,
    "usage": {...},
    "node_execute_status": {...}
  }
}
```

## WorkflowRunHistory 模型字段

根据 Coze SDK 源代码，`WorkflowRunHistory` 包含以下字段：

| 字段 | 类型 | 说明 |
|-----|------|------|
| execute_id | str | 执行 ID |
| execute_status | WorkflowExecuteStatus | 执行状态 (Success/Running/Fail) |
| bot_id | str | Bot ID |
| connector_id | str | 连接器 ID |
| connector_uid | str | 用户 ID |
| run_mode | WorkflowRunMode | 运行模式 (0:同步/1:流式/2:异步) |
| logid | str | 日志 ID |
| create_time | int | 创建时间 (Unix 时间戳) |
| update_time | int | 更新时间 (Unix 时间戳) |
| output | str | 输出内容 (通常为 JSON 字符串) |
| error_code | int | 错误码 (0 表示成功) |
| error_message | str | 错误信息 |
| debug_url | str | 调试 URL |
| is_output_trimmed | bool | 输出是否被截断 |
| usage | ChatUsage | 资源使用情况 (Token 消耗等) |
| node_execute_status | dict | 节点执行状态 |

## 测试方法

### 1. 运行测试脚本

```bash
cd pyJianYingDraftServer
python test_execution_history.py
```

按提示输入工作流 ID，脚本会：
1. 获取执行历史列表
2. 显示每个执行记录的基本信息
3. 获取第一个执行记录的详细信息

### 2. 测试 REST API

**获取历史列表**:
```bash
curl "http://localhost:8000/api/coze/workflows/YOUR_WORKFLOW_ID/history?account_id=default&page_size=10&page_index=1"
```

**获取执行详情**:
```bash
curl "http://localhost:8000/api/coze/workflows/YOUR_WORKFLOW_ID/history/YOUR_EXECUTE_ID?account_id=default"
```

### 3. 前端调用示例

```typescript
import api from '@/lib/api';

// 获取历史列表
const history = await api.coze.getWorkflowHistory(workflowId, 'default', 20, 1);
console.log('历史列表:', history.histories);

// 获取执行详情
const detail = await api.coze.getExecutionDetail(workflowId, executeId, 'default');
console.log('输出内容:', detail.execution.output);
console.log('调试URL:', detail.execution.debug_url);
```

## 注意事项

1. **REST API 端点**: `/v1/workflows/{workflow_id}/run_histories` (列表) 和 `/v1/workflows/{workflow_id}/run_histories/{execute_id}` (详情)

2. **SDK 限制**: Coze SDK 目前不提供历史列表功能，只能获取单个执行记录

3. **分页参数**:
   - `page_num`: 页码从 1 开始
   - `page_size`: 每页数量

4. **输出字段**:
   - 使用 `output` 而不是 `output_data`
   - 无 `input_data` 字段

5. **状态枚举**:
   - `execute_status`: "Success", "Running", "Fail"
   - `run_mode`: 0 (同步), 1 (流式), 2 (异步)

## 相关文件

- `app/services/coze_client.py` - Coze 客户端封装
- `app/routers/coze.py` - Coze API 路由
- `pyjianyingdraft-web/src/lib/api.ts` - 前端 API 客户端
- `test_execution_history.py` - 测试脚本
- `coze-py-main/cozepy/workflows/runs/run_histories/__init__.py` - SDK 源代码
- `coze-py-main/tests/test_workflows_runs.py` - SDK 测试用例
- `coze-py-main/examples/workflow_run_history.py` - SDK 使用示例
