# n8n-nodes-jianying-draft 快速入门

## 📋 前置准备

### 1. 确保 pyJianYingDraftServer 正在运行

```bash
cd pyJianYingDraftServer
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

验证服务是否启动:
```bash
curl http://localhost:8000/health
```

### 2. 配置草稿保存目录

编辑 `pyJianYingDraftServer/config.json`:
```json
{
  "PYJY_DRAFT_ROOT": "你的剪映草稿目录路径"
}
```

例如 Windows:
```json
{
  "PYJY_DRAFT_ROOT": "G:/jianyin5.9_drafts/JianyingPro Drafts/"
}
```

## 🚀 在 n8n 中使用

### 步骤 1: 创建新工作流

1. 在 n8n 中点击 **New Workflow**
2. 添加一个 **Manual Trigger** 节点作为起点

### 步骤 2: 准备预设数据

添加一个 **Set** 节点来准备预设数据:

```json
{
  "preset_data": "{\"ruleGroup\":{\"id\":\"test_001\",\"title\":\"测试草稿\",\"rules\":[...]},\"materials\":[...],\"testData\":{\"tracks\":[...],\"items\":[...]}}"
}
```

### 步骤 3: 验证预设数据

添加 **Read Preset** 节点:
- 连接到 **Set** 节点
- 在 **Preset Data** 字段中输入: `{{ $json.preset_data }}`
- **API Base URL** 保持默认或填写你的服务器地址

### 步骤 4: 提交草稿任务

添加 **Import Draft** 节点:
- 连接到 **Read Preset** 节点
- 在 **Preset Data** 字段中输入: `{{ $json.preset_data }}`
- (可选) 在 **Draft Title** 填写自定义标题

### 步骤 5: 查询任务结果

添加 **Wait** 节点 (等待30秒)，然后添加 **Get Task Result** 节点:
- 在 **Task ID** 字段中输入: `{{ $json.task_id }}`

### 步骤 6: 处理结果

添加 **IF** 节点来判断任务状态:
- 条件: `{{ $json.status }} === 'completed'`
- True 分支: 添加成功处理逻辑
- False 分支: 添加失败处理逻辑

## 📝 完整工作流示例

```
Manual Trigger
    ↓
Set (准备预设数据)
    ↓
Read Preset (验证数据)
    ↓
Import Draft (提交任务)
    ↓
Wait (30秒)
    ↓
Get Task Result (查询结果)
    ↓
IF (判断状态)
    ├─ completed → 发送成功通知
    └─ failed/processing → 发送失败通知或继续等待
```

## 🔑 使用凭据 (推荐)

### 创建凭据

1. 在 n8n 中点击 **Credentials** > **New**
2. 搜索并选择 **Jianying Draft API**
3. 填写 API Base URL: `http://127.0.0.1:8000`
4. 点击 **Save**

### 在节点中使用凭据

所有剪映草稿节点都支持凭据:
- 在节点配置中,点击 **Credential to connect with**
- 选择刚才创建的凭据
- 这样就不需要在每个节点中重复填写 API Base URL

## 🎯 常用场景

### 场景 1: 批量生成草稿

```
Webhook (接收批量数据)
    ↓
Loop Over Items
    ↓
Read Preset
    ↓
Import Draft
    ↓
Aggregate Results
```

### 场景 2: 定时生成草稿

```
Schedule Trigger (每天早上9点)
    ↓
HTTP Request (获取预设数据)
    ↓
Read Preset
    ↓
Import Draft
    ↓
Email (发送结果通知)
```

### 场景 3: URL提交草稿

```
Manual Trigger
    ↓
Set (设置 JSON URL)
    ↓
Submit Draft With URL
    ↓
HTTP Request (使用返回的 api_url)
    ↓
Get Task Result
```

## 📚 数据格式参考

### 最小预设数据示例

```json
{
  "ruleGroup": {
    "id": "test_001",
    "title": "我的草稿",
    "rules": [
      {
        "type": "image",
        "title": "图片",
        "material_ids": ["material_1"]
      }
    ]
  },
  "materials": [
    {
      "id": "material_1",
      "type": "photo",
      "path": "/path/to/image.png"
    }
  ],
  "testData": {
    "tracks": [
      {
        "id": "1",
        "type": "video",
        "title": "视频"
      }
    ],
    "items": [
      {
        "type": "image",
        "data": {
          "track": "1",
          "start": 0,
          "duration": 5.0
        }
      }
    ]
  }
}
```

### 完整数据格式

参考 `coze-plugin/data/full-request.json` 获取完整的数据格式示例。

## ❓ 常见问题

### Q: 如何知道任务是否完成?

A: 使用 **Get Task Result** 节点查询,检查 `status` 字段:
- `pending`: 等待中
- `downloading`: 下载素材中
- `processing`: 处理中
- `completed`: 已完成
- `failed`: 失败
- `cancelled`: 已取消

### Q: 任务需要多久完成?

A: 取决于素材数量和大小,通常在30秒到5分钟之间。建议使用循环查询或webhook回调。

### Q: 如何处理失败的任务?

A: 检查 `error_message` 字段获取详细错误信息,常见错误包括:
- 素材路径不存在
- 素材格式不支持
- 草稿配置错误

### Q: 可以同时运行多个任务吗?

A: 可以,每个任务都有独立的 `task_id`,可以并行提交和查询。

## 🔗 更多资源

- [完整文档](./README.md)
- [API文档](http://localhost:8000/docs)
- [coze-plugin示例](../coze-plugin/doc/)
- [pyJianYingDraft文档](../CLAUDE.md)

---

开始使用愉快! 🎉
