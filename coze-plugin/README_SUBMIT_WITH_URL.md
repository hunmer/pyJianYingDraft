# 通过 URL 提交草稿 - 使用指南

## 概述

这个功能允许通过提供一个包含草稿数据的 JSON URL 来直接提交草稿生成任务，简化了数据传递流程。

## 工作流程

```
用户提供 URL → Coze 节点验证 → 生成 API 调用 URL → Python 后端获取并验证 JSON → 提交任务
```

## Coze 节点：submitDraftWithUrl

### 功能说明

- **节点文件**: `coze-plugin/submitDraftWithUrl.ts`
- **作用**: 验证远程 JSON URL 并生成后端 API 调用地址

### 输入参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | string | ✅ | - | 远程 JSON 数据的 URL 地址 |
| `base_url` | string | ❌ | `http://127.0.0.1:8000` | API 服务器基础地址 |

### 输出结果

**成功时返回:**
```typescript
{
  success: true,
  api_url: "http://127.0.0.1:8000/api/tasks/submit_with_url?url=...",
  message: "URL 验证成功,已生成 API 调用地址",
  validation_info: {
    url: "原始URL",
    has_required_fields: true,
    materials_count: 10,
    rule_group_title: "我的草稿"
  }
}
```

**失败时返回:**
```typescript
{
  success: false,
  error: "错误信息"
}
```

### 验证规则

节点会检查远程 JSON 数据是否包含以下必需字段:

1. **ruleGroup** (对象) - 规则组配置
2. **materials** (数组) - 素材列表
3. **testData** (对象) - 测试数据

## Python 后端接口：/api/tasks/submit_with_url

### 端点信息

- **路径**: `POST /api/tasks/submit_with_url`
- **参数**: `url` (查询参数)
- **返回**: `TaskResponse` (任务信息)

### 功能说明

1. 从指定 URL 获取 JSON 数据
2. 验证数据格式和必需字段
3. 创建草稿生成任务
4. 返回任务 ID 供后续查询

### 请求示例

```bash
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=https://example.com/draft-data.json"
```

### 响应示例

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "任务等待中",
  "created_at": "2025-10-25T10:00:00Z",
  "updated_at": "2025-10-25T10:00:00Z"
}
```

### 错误处理

| 状态码 | 错误原因 |
|--------|---------|
| 400 | URL 格式无效 |
| 400 | 无法获取 URL 内容 |
| 400 | JSON 格式错误 |
| 400 | 缺少必需字段 |
| 400 | 字段类型不正确 |
| 500 | 服务器内部错误 |

## JSON 数据格式要求

远程 URL 返回的 JSON 必须符合以下格式:

```json
{
  "ruleGroup": {
    "id": "group_123",
    "title": "我的草稿",
    "rules": [...]
  },
  "materials": [
    {
      "id": "material_1",
      "name": "video.mp4",
      "type": "video",
      "path": "https://example.com/video.mp4"
    }
  ],
  "testData": {
    "tracks": [...],
    "items": [...]
  },
  "segment_styles": {},
  "use_raw_segments": true,
  "raw_segments": [],
  "raw_materials": [],
  "draft_config": {
    "canvas_width": 1920,
    "canvas_height": 1080,
    "fps": 30
  }
}
```

### 必需字段

- ✅ `ruleGroup` (对象)
- ✅ `materials` (数组)
- ✅ `testData` (对象)

### 可选字段

- `segment_styles` (对象) - 片段样式映射
- `use_raw_segments` (布尔值) - 是否使用原始片段模式
- `raw_segments` (数组) - 原始片段数据
- `raw_materials` (数组) - 原始素材数据
- `draft_config` (对象) - 草稿配置

## 使用场景

### 场景 1: Coze 工作流

1. 用户在 Coze 中输入 JSON 数据的 URL
2. `submitDraftWithUrl` 节点验证 URL 并返回 API 调用地址
3. 使用 HTTP 请求节点调用返回的 API URL
4. 获取任务 ID 并轮询任务状态

### 场景 2: 直接 API 调用

```bash
# 直接调用后端 API
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=https://example.com/data.json"

# 查询任务状态
curl "http://127.0.0.1:8000/api/tasks/{task_id}"
```

### 场景 3: 远程数据托管

1. 将草稿数据 JSON 托管在云存储服务 (如 S3, GitHub Gist)
2. 提供公开访问的 URL
3. 通过 URL 提交任务，无需手动传递大量数据

## 依赖安装

Python 后端需要安装 `httpx` 库:

```bash
cd pyJianYingDraftServer
pip install httpx==0.25.0
# 或者
pip install -r requirements.txt
```

## 安全注意事项

⚠️ **重要提示**:

1. **URL 访问控制**: 确保提供的 URL 可以被服务器访问
2. **数据验证**: 后端会验证 JSON 数据格式，但不会验证业务逻辑
3. **超时设置**: HTTP 请求超时设置为 30 秒
4. **HTTPS 推荐**: 生产环境建议使用 HTTPS URL

## 测试示例

### 创建测试数据文件

创建一个 `test-draft-data.json` 文件:

```json
{
  "ruleGroup": {
    "id": "test_group_001",
    "title": "测试草稿",
    "rules": []
  },
  "materials": [
    {
      "id": "mat_1",
      "name": "test.mp4",
      "type": "video",
      "path": "https://example.com/test.mp4"
    }
  ],
  "testData": {
    "tracks": [],
    "items": []
  },
  "draft_config": {
    "canvas_width": 1920,
    "canvas_height": 1080,
    "fps": 30
  }
}
```

### 托管测试数据

使用 Python 简单 HTTP 服务器:

```bash
# 在数据文件所在目录
python -m http.server 8080
```

### 提交任务

```bash
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=http://localhost:8080/test-draft-data.json"
```

## 故障排查

### 问题 1: "url 必须是有效的 HTTP/HTTPS 地址"

**原因**: URL 格式不正确
**解决**: 确保 URL 以 `http://` 或 `https://` 开头

### 问题 2: "无法获取 URL 内容"

**原因**: URL 无法访问或返回错误状态码
**解决**:
- 检查 URL 是否正确
- 确认服务器可以访问该 URL
- 检查网络连接和防火墙设置

### 问题 3: "URL 返回的内容不是有效的 JSON"

**原因**: 返回的内容不是 JSON 格式
**解决**:
- 检查 URL 返回的 Content-Type 是否为 `application/json`
- 验证 JSON 格式是否正确

### 问题 4: "JSON 数据缺少必需字段"

**原因**: JSON 数据缺少 `ruleGroup`、`materials` 或 `testData` 字段
**解决**: 确保 JSON 数据包含所有必需字段

## 相关文件

- Coze 节点: `coze-plugin/submitDraftWithUrl.ts`
- 类型定义: `coze-plugin/typings/submitDraftWithUrl/submitDraftWithUrl.d.ts`
- Python 路由: `pyJianYingDraftServer/app/routers/tasks.py`
- 依赖配置: `pyJianYingDraftServer/requirements.txt`

## 版本历史

- **v1.0.0** (2025-10-25): 初始版本
  - 添加 Coze 节点 `submitDraftWithUrl`
  - 添加 Python API 端点 `/api/tasks/submit_with_url`
  - 完整的数据验证和错误处理
