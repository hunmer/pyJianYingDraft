# Coze 工作流示例

本文档展示如何在 Coze 平台上配置和使用剪映草稿插件节点。

## 📋 工作流场景

**目标**: 将用户提供的图片和文本自动生成为剪映视频草稿

**步骤**:
1. 用户提供图片 URL、文本内容、配音 URL
2. 读取预设节点校验数据格式
3. 保存草稿节点生成剪映草稿
4. 返回草稿路径给用户

---

## 🔧 节点配置

### 节点 1: 读取预设

**类型**: 工具节点 (readPreset)

**输入配置**:
```json
{
  "preset_data": {
    "ruleGroup": {
      "id": "{{workflow.input.group_id}}",
      "title": "{{workflow.input.title}}",
      "rules": [
        {
          "type": "image",
          "title": "图片",
          "material_ids": ["mat_image_001"]
        },
        {
          "type": "subtitle",
          "title": "字幕",
          "material_ids": ["mat_text_001"]
        },
        {
          "type": "vocal",
          "title": "配音",
          "material_ids": ["mat_audio_001"]
        }
      ]
    },
    "materials": [
      {
        "id": "mat_image_001",
        "type": "photo",
        "path": "{{workflow.input.image_url}}"
      },
      {
        "id": "mat_text_001",
        "type": "subtitle",
        "content": "{{workflow.input.text_content}}"
      },
      {
        "id": "mat_audio_001",
        "type": "extract_music",
        "path": "{{workflow.input.audio_url}}"
      }
    ],
    "testData": {
      "tracks": [
        {"id": "1", "type": "video", "title": "视频"},
        {"id": "2", "type": "text", "title": "字幕"},
        {"id": "3", "type": "audio", "title": "配音"}
      ],
      "items": [
        {
          "type": "image",
          "data": {
            "track": "1",
            "start": 0,
            "duration": "{{workflow.input.duration}}",
            "path": "{{workflow.input.image_url}}"
          }
        },
        {
          "type": "subtitle",
          "data": {
            "track": "2",
            "start": 0,
            "duration": "{{workflow.input.duration}}",
            "text": "{{workflow.input.text_content}}"
          }
        },
        {
          "type": "vocal",
          "data": {
            "track": "3",
            "start": 0,
            "duration": "{{workflow.input.duration}}",
            "text": "{{workflow.input.audio_url}}"
          }
        }
      ]
    },
    "draft_config": {
      "canvas_config": {
        "canvas_width": 1440,
        "canvas_height": 2560
      },
      "fps": 30
    }
  },
  "api_base": "{{workflow.config.api_base}}"
}
```

**输出变量**:
- `readPreset.valid` - 是否校验通过
- `readPreset.preset_data` - 校验后的数据
- `readPreset.error` - 错误信息

---

### 节点 2: 条件判断

**类型**: 条件节点

**条件**:
```
IF readPreset.valid == true
  THEN 进入 "保存草稿节点"
  ELSE 返回错误
```

---

### 节点 3: 保存草稿

**类型**: 工具节点 (importDraft)

**输入配置**:
```json
{
  "preset_data": "{{readPreset.preset_data}}",
  "draft_title": "{{workflow.input.custom_title}}",
  "api_base": "{{workflow.config.api_base}}"
}
```

**输出变量**:
- `importDraft.success` - 是否成功
- `importDraft.draft_path` - 草稿路径
- `importDraft.draft_name` - 草稿名称
- `importDraft.error` - 错误信息

---

### 节点 4: 返回结果

**类型**: 文本输出节点

**成功时**:
```
✅ 草稿已生成成功!

📁 草稿路径: {{importDraft.draft_path}}
📝 草稿名称: {{importDraft.draft_name}}

您可以在剪映中打开此草稿进行编辑。
```

**失败时**:
```
❌ 生成失败

错误原因: {{readPreset.error || importDraft.error}}
```

---

## 📥 工作流输入参数

配置工作流的输入变量:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|-------|------|------|------|------|
| `image_url` | String | 是 | 图片 URL 或本地路径 | `https://example.com/image.jpg` |
| `text_content` | String | 是 | 字幕文本内容 | `这是一段测试文字` |
| `audio_url` | String | 是 | 配音文件 URL 或路径 | `https://example.com/audio.mp3` |
| `duration` | Number | 是 | 视频时长(秒) | `5.0` |
| `title` | String | 否 | 规则组标题 | `竖屏人物图片` |
| `custom_title` | String | 否 | 自定义草稿标题 | `我的视频草稿` |
| `group_id` | String | 否 | 规则组 ID | `group_001` |

---

## ⚙️ 工作流配置

配置工作流的全局变量:

| 变量名 | 值 | 说明 |
|-------|---|------|
| `workflow.config.api_base` | `http://localhost:8000` | API 服务器地址 |

---

## 🧪 测试用例

### 测试用例 1: 基础图文视频

**输入**:
```json
{
  "image_url": "https://example.com/person.jpg",
  "text_content": "1971年 马斯克出生在南非比勒陀利亚。",
  "audio_url": "https://example.com/narration.mp3",
  "duration": 5.616,
  "title": "马斯克传记",
  "custom_title": "马斯克-出生篇"
}
```

**预期输出**:
```json
{
  "success": true,
  "draft_path": "G:/jianyin5.9_drafts/JianyingPro Drafts/马斯克-出生篇_20251022_120000",
  "draft_name": "马斯克-出生篇_20251022_120000",
  "message": "草稿保存成功"
}
```

---

### 测试用例 2: 使用原始片段模式

**输入** (使用 `full-request.json` 中的完整结构):
```json
{
  "preset_data": {
    // ... 完整的 full-request.json 内容
    "use_raw_segments": true,
    "raw_segments": [...],
    "raw_materials": [...]
  }
}
```

**预期输出**:
```json
{
  "success": true,
  "draft_path": "G:/jianyin5.9_drafts/JianyingPro Drafts/竖屏人物图片_20251022_120500",
  "draft_name": "竖屏人物图片_20251022_120500"
}
```

---

## 🎯 高级用法

### 1. 批量生成草稿

使用 Coze 的循环节点,批量处理多个数据:

```
用户输入(数组) → 循环节点 → 读取预设 → 保存草稿 → 收集结果
```

### 2. 动态调整画布尺寸

根据用户选择动态调整画布配置:

```json
{
  "draft_config": {
    "canvas_config": {
      "canvas_width": "{{workflow.input.format == '竖屏' ? 1440 : 1920}}",
      "canvas_height": "{{workflow.input.format == '竖屏' ? 2560 : 1080}}"
    },
    "fps": 30
  }
}
```

### 3. 集成文件上传

结合 Coze 的文件上传功能:

```
文件上传 → 获取文件 URL → 读取预设 → 保存草稿
```

---

## 📊 监控和日志

### 查看执行日志

在 Coze 工作流执行详情中可以查看:

1. **读取预设节点日志**:
   ```
   [INFO] 开始校验预设数据...
   [INFO] 预设数据校验通过 {
     rule_count: 3,
     material_count: 3,
     track_count: 3,
     item_count: 3,
     mode: 'normal'
   }
   ```

2. **保存草稿节点日志**:
   ```
   [INFO] 开始保存草稿... { api_base: 'http://localhost:8000' }
   [INFO] 调用 API: http://localhost:8000/api/rules/test
   [INFO] 草稿保存成功 {
     draft_path: 'G:/jianyin5.9_drafts/...',
     draft_name: '...'
   }
   ```

### API 服务器日志

在 `pyJianYingDraftServer` 终端可以看到:

```
INFO: 127.0.0.1:xxxxx - "POST /api/rules/test HTTP/1.1" 200 OK
[DEBUG] _build_raw_draft: raw_segments数量 = 4
[DEBUG] 创建新轨道: track_id=1, type=video
[DEBUG] 草稿保存成功: draft_path=...
```

---

## 💡 最佳实践

1. **错误处理**: 始终检查 `valid` 和 `success` 字段
2. **日志记录**: 在关键步骤使用 `logger.info()` 记录日志
3. **数据校验**: 在发送到 API 前先使用读取预设节点校验
4. **配置管理**: 使用工作流全局变量管理 API 地址
5. **测试优先**: 在生产环境使用前充分测试各种场景

---

## 🔗 相关资源

- [Coze 工作流文档](https://www.coze.com/docs)
- [pyJianYingDraft 项目](../CLAUDE.md)
- [API 接口文档](http://localhost:8000/docs)
