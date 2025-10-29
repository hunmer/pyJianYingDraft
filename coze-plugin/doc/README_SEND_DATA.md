# Coze数据投递节点 (sendData)

## 概述

`sendData.ts` 是一个Coze插件节点，用于向指定的客户端投递数据。该节点通过HTTP POST请求将数据发送到Coze插件的API端点。

## 功能特性

- ✅ 支持自定义API基础地址
- ✅ 支持客户端ID标识
- ✅ 支持任意数据对象投递
- ✅ 完整的错误处理和日志记录
- ✅ TypeScript类型安全
- ✅ 详细的响应信息返回

## 输入参数

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `api_base` | string | ✅ | Coze插件的API基础地址，支持http/https协议 |
| `client_id` | string | ✅ | 客户端唯一标识，用于路由数据到正确的客户端 |
| `data` | object | ✅ | 要发送的数据对象，必须包含`type`和`data`字段 |

### data对象结构

```typescript
{
  type: string,    // 数据类型标识
  data: any        // 实际数据内容
}
```

## 输出参数

| 参数名 | 类型 | 描述 |
|--------|------|------|
| `success` | boolean | 操作是否成功 |
| `message` | string | 结果消息 |
| `status_code` | number | HTTP状态码 |
| `response_data` | any | 服务器响应数据 |
| `request_info` | object | 请求信息（成功时返回） |
| `error` | string | 错误信息（失败时返回） |

## 使用示例

### 基础用法

```typescript
// 输入参数
{
  "api_base": "http://127.0.0.1:8000",
  "client_id": "client_001",
  "data": {
    "type": "text_message",
    "data": {
      "content": "Hello World!",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 视频处理任务

```typescript
{
  "api_base": "https://your-coze-api.com",
  "client_id": "video_processor",
  "data": {
    "type": "video_processing",
    "data": {
      "task_id": "task_12345",
      "video_url": "https://example.com/video.mp4",
      "processing_options": {
        "resolution": "1080p",
        "format": "mp4",
        "quality": "high"
      }
    }
  }
}
```

### 草稿数据更新

```typescript
{
  "api_base": "http://localhost:8000",
  "client_id": "draft_manager",
  "data": {
    "type": "draft_update",
    "data": {
      "draft_id": "draft_67890",
      "changes": {
        "add_track": {
          "type": "video",
          "duration": 5000000
        }
      }
    }
  }
}
```

## 成功响应示例

```json
{
  "success": true,
  "message": "数据发送成功",
  "status_code": 200,
  "response_data": {
    "message": "Data received successfully",
    "client_id": "client_001"
  },
  "request_info": {
    "api_url": "http://127.0.0.1:8000/send-data",
    "client_id": "client_001",
    "data_type": "text_message"
  }
}
```

## 错误响应示例

### 参数缺失
```json
{
  "success": false,
  "error": "api_base 参数不能为空"
}
```

### 网络错误
```json
{
  "success": false,
  "error": "网络请求失败: ECONNREFUSED"
}
```

### 服务器错误
```json
{
  "success": false,
  "error": "服务器返回错误: Internal server error",
  "status_code": 500,
  "response_data": {
    "detail": "Database connection failed"
  }
}
```

## API端点要求

目标API端点需要满足以下要求：

1. **端点路径**: `{api_base}/send-data`
2. **HTTP方法**: POST
3. **Content-Type**: application/json
4. **请求体格式**:
   ```json
   {
     "api_base": "string",
     "client_id": "string",
     "data": {
       "type": "string",
       "data": "any"
     }
   }
   ```

## 演示节点

项目还包含一个演示节点 `sendData_demo.ts`，展示了如何使用数据投递节点发送不同类型的数据：

- `basic`: 基础文本消息
- `video_task`: 视频处理任务
- `draft_data`: 草稿更新数据

使用演示节点：
```typescript
{
  "demo_type": "video_task",
  "api_base": "http://127.0.0.1:8000",
  "client_id": "demo_client"
}
```

## 注意事项

1. **URL格式**: `api_base` 支持带或不带协议前缀，自动补充 `https://`
2. **客户端ID**: 确保客户端ID唯一，用于正确路由数据
3. **数据格式**: `data` 对象必须包含 `type` 字段用于标识数据类型
4. **错误处理**: 节点会捕获所有类型的错误并返回详细的错误信息
5. **网络超时**: 建议API端点有合理的超时设置

## 故障排除

### 常见问题

1. **连接超时**
   - 检查 `api_base` 地址是否正确
   - 确认目标服务器是否运行

2. **认证失败**
   - 检查是否需要API密钥或认证头
   - 确认客户端ID是否有权限

3. **数据格式错误**
   - 确保 `data` 对象包含 `type` 字段
   - 检查数据是否符合API端点期望格式

4. **CORS错误**
   - 确认API端点支持跨域请求
   - 检查预检请求配置

## 更新日志

- **v1.0.0** (2024-01-01)
  - 初始版本发布
  - 支持基础数据投递功能
  - 完整的错误处理机制