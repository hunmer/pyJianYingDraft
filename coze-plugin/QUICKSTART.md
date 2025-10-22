# 快速上手指南

5 分钟快速开始使用 Coze 剪映草稿插件!

## 🚀 快速开始

### 步骤 1: 启动 API 服务

```bash
cd pyJianYingDraftServer
python run.py
```

访问 http://localhost:8000/health 确认服务已启动。

### 步骤 2: 配置草稿根目录

通过 API 设置:

```bash
curl -X POST "http://localhost:8000/api/draft/config/root" \
  -H "Content-Type: application/json" \
  -d "{\"draft_root\": \"G:/jianyin5.9_drafts/JianyingPro Drafts/\"}"
```

或直接编辑 `pyJianYingDraftServer/config.json`:

```json
{
  "PYJY_DRAFT_ROOT": "G:/jianyin5.9_drafts/JianyingPro Drafts/"
}
```

### 步骤 3: 在 Coze 中配置插件节点

#### 3.1 添加读取预设节点

1. 在 Coze 工作流中添加**工具节点**
2. 选择 `readPreset` 插件
3. 配置输入:
   ```json
   {
     "preset_data": {
       // 你的预设数据
     }
   }
   ```

#### 3.2 添加保存草稿节点

1. 添加另一个**工具节点**
2. 选择 `importDraft` 插件
3. 配置输入:
   ```json
   {
     "preset_data": "{{readPreset.preset_data}}",
     "draft_title": "我的视频草稿"
   }
   ```

### 步骤 4: 运行测试

使用 `full-request.json` 作为测试数据:

```json
{
  "preset_data": {
    // 复制 full-request.json 的完整内容到这里
  }
}
```

---

## 📝 最简示例

### 输入数据 (最小化)

```json
{
  "ruleGroup": {
    "id": "test_001",
    "title": "测试视频",
    "rules": [
      {
        "type": "image",
        "title": "图片",
        "material_ids": ["img_001"]
      }
    ]
  },
  "materials": [
    {
      "id": "img_001",
      "type": "photo",
      "path": "https://example.com/test.jpg"
    }
  ],
  "testData": {
    "tracks": [
      {
        "id": "1",
        "type": "video",
        "title": "视频轨道"
      }
    ],
    "items": [
      {
        "type": "image",
        "data": {
          "track": "1",
          "start": 0,
          "duration": 5,
          "path": "https://example.com/test.jpg"
        }
      }
    ]
  },
  "draft_config": {
    "canvas_config": {
      "canvas_width": 1920,
      "canvas_height": 1080
    },
    "fps": 30
  }
}
```

### 工作流配置

```
输入节点 → readPreset → importDraft → 输出节点
```

### 预期输出

```json
{
  "success": true,
  "draft_path": "G:/jianyin5.9_drafts/JianyingPro Drafts/测试视频_20251022_150000",
  "draft_name": "测试视频_20251022_150000",
  "message": "草稿保存成功"
}
```

---

## 🔍 常见问题

### Q1: 如何验证 API 是否正常?

访问 http://localhost:8000/docs 查看交互式 API 文档。

### Q2: 如何使用本地文件路径?

将网络 URL 替换为本地绝对路径:

```json
{
  "path": "D:/videos/test.mp4"
}
```

### Q3: 如何调整视频尺寸?

修改 `draft_config`:

```json
{
  "draft_config": {
    "canvas_config": {
      "canvas_width": 1440,  // 竖屏
      "canvas_height": 2560
    }
  }
}
```

常用尺寸:
- 横屏: 1920x1080
- 竖屏: 1440x2560
- 方形: 1080x1080

---

## 📚 下一步

- 阅读完整文档: [README.md](./README.md)
- 查看工作流示例: [example-workflow.md](./example-workflow.md)
- 了解 API 接口: [pyJianYingDraftServer README](../pyJianYingDraftServer/README.md)

---

## 💬 获取帮助

遇到问题?

1. 检查 API 服务日志
2. 查看 Coze 工作流执行日志
3. 参考 [故障排除](./README.md#🐛-故障排除) 章节
