# Coze 剪映草稿插件节点

基于 `pyJianYingDraftServer` API 的 Coze 插件节点,用于在 Coze 工作流中处理剪映草稿数据。

## 📦 插件节点列表

### 1. 读取预设节点 (readPreset.ts)

**功能**: 校验并返回剪映草稿预设数据

**输入参数**:
- `preset_data` (必需): JSON 字符串,包含完整的 full-request.json 信息
- `api_base` (可选): API 服务器基础地址,默认 `http://localhost:8000`

**输出**:
- `valid`: 布尔值,是否通过校验
- `preset_data`: 原始数据(校验通过时返回)
- `api_base`: API 基础地址
- `stats`: 统计信息(规则数量、素材数量、轨道数量等)
- `message`: 结果消息
- `error`: 错误信息(校验失败时返回)

**数据校验项**:
- ✅ 必需字段检查: `ruleGroup`, `materials`, `testData`
- ✅ `ruleGroup` 结构: `id`, `title`, `rules` 数组
- ✅ `materials` 必须是数组
- ✅ `testData` 结构: `tracks` 和 `items` 数组
- ✅ `use_raw_segments` 模式校验
- ✅ `raw_segments` 和 `raw_materials` 结构校验
- ✅ 画布配置校验 (`draft_config`)

---

### 2. 保存草稿节点 (importDraft.ts)

**功能**: 调用 API 将预设数据保存为剪映草稿

**输入参数**:
- `preset_data` (必需): JSON 字符串,包含完整的 full-request.json 信息
- `draft_title` (可选): 自定义草稿标题,默认使用 `ruleGroup.title`
- `api_base` (可选): API 服务器基础地址,默认 `http://localhost:8000`

**输出**:
- `success`: 布尔值,是否成功保存
- `draft_path`: 保存的草稿路径
- `draft_name`: 草稿名称
- `message`: 结果消息
- `api_response`: 完整的 API 响应
- `error`: 错误信息(失败时返回)

**调用 API**: `POST /api/rules/test`

---

## 🚀 使用示例

### Coze 工作流配置

```
┌─────────────────┐
│   用户输入      │
│ (preset JSON)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 读取预设节点    │  ← 校验数据格式
│ (readPreset)    │
└────────┬────────┘
         │
         ├─ valid=false → 返回错误
         │
         └─ valid=true
                  │
                  ▼
         ┌─────────────────┐
         │ 保存草稿节点    │  ← 调用 API
         │ (importDraft)   │
         └────────┬────────┘
                  │
                  ├─ success=false → 返回错误
                  │
                  └─ success=true
                           │
                           ▼
                  ┌─────────────────┐
                  │  返回草稿路径   │
                  └─────────────────┘
```

### 输入数据示例

参考 `coze-plugin/full-request.json` 的完整结构。关键字段:

```json
{
  "ruleGroup": {
    "id": "group_xxx",
    "title": "竖屏人物图片",
    "rules": [
      {
        "type": "image",
        "title": "图片",
        "material_ids": ["material_id_1"]
      }
    ]
  },
  "materials": [
    {
      "id": "material_id_1",
      "type": "photo",
      "path": "path/to/image.png"
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
          "duration": 5.616
        }
      }
    ]
  },
  "use_raw_segments": true,
  "raw_segments": [...],
  "raw_materials": [...],
  "segment_styles": {...},
  "draft_config": {
    "canvas_config": {
      "canvas_width": 1440,
      "canvas_height": 2560
    },
    "fps": 30
  }
}
```

---

## ⚙️ 前置要求

### 1. 启动 pyJianYingDraftServer

确保 API 服务已启动:

```bash
cd pyJianYingDraftServer
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 配置草稿根目录

编辑 `pyJianYingDraftServer/config.json`:

```json
{
  "PYJY_DRAFT_ROOT": "G:/jianyin5.9_drafts/JianyingPro Drafts/"
}
```

或通过 API 设置:

```bash
curl -X POST "http://localhost:8000/api/draft/config/root" \
  -H "Content-Type: application/json" \
  -d '{"draft_root": "G:/jianyin5.9_drafts/JianyingPro Drafts/"}'
```

---

## 🔧 开发说明

### 文件结构

```
coze-plugin/
├── demo.ts                  # 模板文件
├── readPreset.ts            # 读取预设节点
├── importDraft.ts           # 保存草稿节点
├── full-request.json        # 完整请求数据示例
└── README.md                # 本文档
```

### 添加新节点

1. 复制 `demo.ts` 作为模板
2. 实现 `handler` 函数
3. 在 Coze 平台配置输入/输出参数元数据

### 调试技巧

- 使用 `logger.info()` 和 `logger.error()` 输出日志
- 在 Coze 工作流中查看节点执行日志
- 使用 Postman 测试 API 端点

---

## 📚 相关文档

- [pyJianYingDraft README](../CLAUDE.md)
- [pyJianYingDraftServer API 文档](../pyJianYingDraftServer/README.md)
- API 交互式文档: http://localhost:8000/docs

---

## 🐛 故障排除

### 问题 1: 无法连接到 API 服务器

**错误**: `无法连接到 API 服务器 (http://localhost:8000)`

**解决**:
1. 确认服务已启动: `http://localhost:8000/health`
2. 检查防火墙设置
3. 如果在远程服务器,使用完整 URL (如 `http://192.168.1.100:8000`)

### 问题 2: 草稿保存失败

**错误**: `API 错误: 未在 config.json 或环境变量 PYJY_DRAFT_ROOT 中配置草稿保存目录`

**解决**:
1. 配置草稿根目录 (参考上方配置说明)
2. 确认目录存在且有写入权限

### 问题 3: 数据校验失败

**错误**: `缺少必需字段: ruleGroup, materials, testData`

**解决**:
1. 检查输入数据格式是否符合 `full-request.json` 结构
2. 确保所有必需字段都已提供
3. 参考本文档中的输入数据示例

---
