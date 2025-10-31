# Coze API 配置和测试指南

## 📋 快速开始

Coze API 已成功迁移到后端！请按照以下步骤配置和测试。

---

## 1️⃣ 获取 Coze API Token

### 步骤 1：访问 Coze 平台

- **中国区**: https://www.coze.cn/open/oauth/pats
- **国际版**: https://www.coze.com/open/oauth/pats

### 步骤 2：创建 Personal Access Token

1. 点击 "创建令牌" 或 "Create Token"
2. 填写令牌信息：
   - **名称**: 例如 "pyJianYingDraft"
   - **过期时间**: 根据需要选择（推荐 Never 或较长期限）
   - **权限范围**: 勾选以下权限
     - ✅ `workspace.read` - 读取工作空间
     - ✅ `workflow.read` - 读取工作流
     - ✅ `workflow.run` - 执行工作流
     - ✅ （其他根据实际需求选择）
3. 点击 "确定" 创建
4. **重要**: 复制生成的 Token，稍后关闭对话框后将无法再次查看

---

## 2️⃣ 配置后端服务

### 方式 A：使用配置文件（推荐）

编辑 `pyJianYingDraftServer/config.json`：

```json
{
  "PYJY_DRAFT_ROOT": "你的剪映草稿文件夹路径",
  "ARIA2_PATH": "aria2c 可执行文件路径",
  "PYJY_RULE_GROUPS": [...],

  "COZE_API": {
    "api_token": "pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "base_url": "https://api.coze.cn",
    "timeout": 600,
    "max_retries": 3
  }
}
```

**字段说明**:
- `api_token`: 你的 Personal Access Token（必填）
- `base_url`: API 基础 URL
  - 中国区: `https://api.coze.cn` （默认）
  - 国际版: `https://api.coze.com`
- `timeout`: 请求超时时间（秒）
- `max_retries`: 失败重试次数

### 方式 B：使用环境变量

Windows (PowerShell):
```powershell
$env:COZE_API_TOKEN="pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:COZE_API_BASE="https://api.coze.cn"
```

Windows (CMD):
```cmd
set COZE_API_TOKEN=pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
set COZE_API_BASE=https://api.coze.cn
```

Linux/macOS:
```bash
export COZE_API_TOKEN="pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export COZE_API_BASE="https://api.coze.cn"
```

---

## 3️⃣ 启动后端服务

### 开发模式

```bash
cd pyJianYingDraftServer
python run.py
```

成功启动后，你应该看到：

```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 生产模式

```bash
cd pyJianYingDraftServer
python run_production.py
```

---

## 4️⃣ 测试后端 API

### 方式 A：使用 Swagger UI（推荐）

1. 打开浏览器访问：http://localhost:8000/docs
2. 找到 "coze" 标签下的接口
3. 测试以下端点：

#### 测试 1：健康检查

- 端点：`GET /api/coze/health`
- 点击 "Try it out" → "Execute"
- 预期响应：
```json
{
  "status": "healthy",
  "service": "coze",
  "stats": {...}
}
```

#### 测试 2：获取工作空间列表

- 端点：`GET /api/coze/workspaces`
- 参数：`account_id = default`
- 点击 "Try it out" → "Execute"
- 预期响应：
```json
{
  "success": true,
  "workspaces": [
    {
      "id": "workspace_id",
      "name": "我的工作空间",
      "description": "...",
      ...
    }
  ],
  "count": 1
}
```

#### 测试 3：执行工作流任务

1. 先在 Coze 平台创建一个简单的测试工作流
2. 复制工作流 ID（从 URL 中获取）
3. 使用端点：`POST /api/coze/tasks/execute`
4. 请求体示例：
```json
{
  "workflow_id": "你的工作流ID",
  "input_parameters": {
    "input_key": "input_value"
  },
  "save_as_task": true,
  "task_name": "测试任务",
  "task_description": "这是一个测试任务"
}
```
5. 预期响应：
```json
{
  "task_id": "task_xxx",
  "execution_id": "execution_xxx",
  "status": "success",
  "message": "任务执行完成"
}
```

#### 测试 4：查询任务

- 端点：`GET /api/coze/tasks/{task_id}`
- 使用上一步返回的 `task_id`
- 预期响应：
```json
{
  "id": "task_xxx",
  "name": "测试任务",
  "status": "completed",
  "execution_status": "success",
  "workflow_id": "...",
  "output_data": {...},
  ...
}
```

### 方式 B：使用 curl 命令

#### 健康检查
```bash
curl http://localhost:8000/api/coze/health
```

#### 获取工作空间
```bash
curl "http://localhost:8000/api/coze/workspaces?account_id=default"
```

#### 执行任务
```bash
curl -X POST http://localhost:8000/api/coze/tasks/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "你的工作流ID",
    "input_parameters": {},
    "save_as_task": true,
    "task_name": "测试任务"
  }'
```

---

## 5️⃣ 前端测试

### 启动前端

```bash
cd pyjianyingdraft-web
npm install
npm run dev
```

访问：http://localhost:3000

### 测试 CozeZone 功能

1. 在前端界面找到 CozeZone 标签页
2. 尝试以下操作：
   - 查看工作空间列表
   - 选择工作流
   - 创建并执行任务
   - 查看任务执行状态

### 前端 API 调用示例

前端现在使用后端 API，代码示例：

```typescript
import api from '@/lib/api';

// 获取工作空间
const workspaces = await api.coze.getWorkspaces();

// 执行任务
const result = await api.coze.executeTask({
  workflowId: 'workflow_123',
  inputParameters: { key: 'value' },
  saveAsTask: true,
  taskName: '我的任务'
});

// 查询任务状态
const task = await api.coze.getTask(result.taskId);
```

---

## ⚠️ 常见问题

### Q1: 提示 "无法获取 Coze 客户端，请检查配置"

**原因**: API Token 未配置或配置错误

**解决方案**:
1. 检查 `config.json` 中 `COZE_API.api_token` 是否正确
2. 或确认环境变量 `COZE_API_TOKEN` 已设置
3. 重启后端服务

### Q2: 执行工作流失败，提示权限不足

**原因**: Token 权限不足

**解决方案**:
1. 返回 Coze 平台检查 Token 权限
2. 确保勾选了 `workflow.run` 权限
3. 重新生成 Token 并更新配置

### Q3: 提示连接超时

**原因**: 网络问题或 base_url 配置错误

**解决方案**:
1. 检查网络连接
2. 确认 `base_url` 配置正确
   - 中国区: `https://api.coze.cn`
   - 国际版: `https://api.coze.com`
3. 尝试在浏览器中访问 `{base_url}/open/api` 验证可达性

### Q4: 前端显示 CORS 错误

**原因**: 后端 CORS 配置问题

**解决方案**:
1. 确认后端服务正在运行
2. 检查 FastAPI CORS 中间件配置
3. 确保 `http://localhost:3000` 在允许列表中

### Q5: 任务状态一直是 EXECUTING

**原因**: 工作流执行超时或失败

**解决方案**:
1. 查看后端日志查找错误信息
2. 使用 Swagger UI 查看任务详情
3. 检查工作流配置是否正确
4. 尝试在 Coze 平台手动执行工作流验证

---

## 📊 日志和调试

### 后端日志

后端日志会输出到控制台，包括：
- ✅ Coze API 配置加载成功
- 🚀 工作流执行开始
- ⚠️ API 调用错误
- ✅ 任务状态更新

示例日志：
```
✅ 任务创建成功: task_1_1234567890 - 测试任务
🚀 开始执行工作流: workflow_123
✅ 任务更新成功: task_1_1234567890
```

### 查看 API 文档

访问 http://localhost:8000/docs 可以查看完整的 API 文档和接口测试。

---

## 🎯 下一步

配置完成后，你可以：

1. **集成到现有工作流**: 在你的剪映草稿生成流程中调用 Coze 工作流
2. **自动化任务**: 创建定时任务自动执行工作流
3. **扩展功能**: 基于 Coze API 开发更多自定义功能

---

## 📚 相关文档

- **Coze 官方文档**: https://www.coze.cn/docs
- **cozepy SDK 文档**: https://github.com/coze-dev/coze-py
- **迁移指南**: `pyjianyingdraft-web/MIGRATION_COZE.md`
- **后端架构**: `pyJianYingDraftServer/CLAUDE.md`
- **前端架构**: `pyjianyingdraft-web/CLAUDE.md`

---

## 💡 技术支持

如果遇到问题：
1. 查看上述常见问题
2. 检查后端日志
3. 使用 Swagger UI 测试 API
4. 参考 GitHub Issues

**祝你使用愉快！** 🎉
