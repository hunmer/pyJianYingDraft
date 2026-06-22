# Coze 剪映草稿插件完整指南

基于 `pyJianYingDraftServer` API 的 Coze 插件节点集合，用于在 Coze 工作流中生成、提交、投递剪映草稿数据。

## 目录

- [一、快速开始](#一快速开始)
- [二、插件节点详解](#二插件节点详解)
  - [1. readPreset — 读取预设](#1-readpreset--读取预设)
  - [2. importDraft — 保存草稿](#2-importdraft--保存草稿)
  - [3. submitDraftWithUrl — URL 提交](#3-submitdraftwithurl--url-提交)
  - [4. sendData — 数据投递](#4-senddata--数据投递)
- [三、JSON 数据格式规范](#三json-数据格式规范)
- [四、Web 状态页面](#四web-状态页面)
- [五、工作流示例](#五工作流示例)
- [六、故障排除](#六故障排除)

---

## 一、快速开始

5 分钟跑通「提交 JSON → 生成剪映草稿」完整流程。

### 1. 启动 API 服务

```bash
cd pyJianYingDraftServer
python run.py
```

访问 http://localhost:8000/health 确认服务已启动。交互式 API 文档见 http://localhost:8000/docs。

### 2. 配置草稿根目录

**方式 A：直接编辑 `pyJianYingDraftServer/config.json`**

```json
{
  "PYJY_DRAFT_ROOT": "G:/jianyin5.9_drafts/JianyingPro Drafts/"
}
```

**方式 B：通过 API 设置**

```bash
curl -X POST "http://localhost:8000/api/draft/config/root" \
  -H "Content-Type: application/json" \
  -d '{"draft_root": "G:/jianyin5.9_drafts/JianyingPro Drafts/"}'
```

### 3. 在 Coze 中配置插件节点

```
输入节点 → readPreset → importDraft → 输出节点
```

1. 添加**工具节点**，选择 `readPreset`，校验数据格式。
2. 再添加**工具节点**，选择 `importDraft`，引用上一步输出：

   ```json
   {
     "preset_data": "{{readPreset.preset_data}}",
     "draft_title": "我的视频草稿"
   }
   ```

### 4. 最简输入示例

```json
{
  "ruleGroup": {
    "id": "test_001",
    "title": "测试视频",
    "rules": [
      { "type": "image", "title": "图片", "material_ids": ["img_001"] }
    ]
  },
  "materials": [
    { "id": "img_001", "type": "photo", "path": "https://example.com/test.jpg" }
  ],
  "testData": {
    "tracks": [{ "id": "1", "type": "video", "title": "视频轨道" }],
    "items": [
      {
        "type": "image",
        "data": { "track": "1", "start": 0, "duration": 5, "path": "https://example.com/test.jpg" }
      }
    ]
  },
  "draft_config": {
    "canvas_config": { "canvas_width": 1920, "canvas_height": 1080 },
    "fps": 30
  }
}
```

**预期输出：**

```json
{
  "success": true,
  "draft_path": "G:/jianyin5.9_drafts/JianyingPro Drafts/测试视频_20251022_150000",
  "draft_name": "测试视频_20251022_150000",
  "message": "草稿保存成功"
}
```

### 常用画布尺寸

| 场景 | 尺寸 |
|------|------|
| 横屏 | 1920 × 1080 |
| 竖屏 | 1440 × 2560 |
| 方形 | 1080 × 1080 |

> **本地路径**：把网络 URL 换成本地绝对路径即可，如 `"path": "D:/videos/test.mp4"`。

---

## 二、插件节点详解

### 1. readPreset — 读取预设

**文件**：`coze-plugin/readPreset.ts`
**作用**：校验并返回剪映草稿预设数据。

**输入参数**

| 参数 | 必需 | 说明 |
|------|------|------|
| `preset_data` | ✅ | JSON 字符串，包含完整的 full-request.json 信息 |
| `api_base` | ❌ | API 基础地址，默认 `http://localhost:8000` |

**输出**：`valid`、`preset_data`、`api_base`、`stats`（规则/素材/轨道数量等）、`message`、`error`。

**校验项**

- 必需字段：`ruleGroup`、`materials`、`testData`
- `ruleGroup` 结构：`id`、`title`、`rules` 数组
- `materials` 必须是数组
- `testData` 结构：`tracks` 和 `items` 数组
- `use_raw_segments` 模式校验
- `raw_segments` / `raw_materials` 结构校验
- 画布配置校验（`draft_config`）

---

### 2. importDraft — 保存草稿

**文件**：`coze-plugin/importDraft.ts`
**作用**：调用 API 将预设数据保存为剪映草稿。
**调用 API**：`POST /api/rules/test`

**输入参数**

| 参数 | 必需 | 说明 |
|------|------|------|
| `preset_data` | ✅ | JSON 字符串，完整的 full-request.json 信息 |
| `draft_title` | ❌ | 自定义草稿标题，默认使用 `ruleGroup.title` |
| `api_base` | ❌ | API 基础地址，默认 `http://localhost:8000` |

**输出**：`success`、`draft_path`、`draft_name`、`message`、`api_response`、`error`。

---

### 3. submitDraftWithUrl — URL 提交

**文件**：`coze-plugin/submitDraftWithUrl.ts`
**作用**：通过一个包含草稿数据的 JSON URL 提交任务，无需手动传递大量数据。
**后端端点**：`POST /api/tasks/submit_with?url=<JSON_URL>`（也支持 GET）

**工作流程**

```
用户提供 URL → Coze 节点验证 → 生成 API 调用 URL → Python 后端获取并验证 JSON → 提交任务
```

**Coze 节点输入**

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | ✅ | - | 远程 JSON 数据的 URL 地址 |
| `base_url` | ❌ | `http://127.0.0.1:8000` | API 服务器基础地址 |

**节点输出（成功）**

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

> 节点只做 URL 校验并返回 API 调用地址，实际任务提交需用 HTTP 请求节点调用返回的 `api_url`。

**后端响应（TaskResponse）**

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "任务等待中",
  "created_at": "2025-10-25T10:00:00Z",
  "updated_at": "2025-10-25T10:00:00Z"
}
```

**错误状态码**

| 状态码 | 原因 |
|--------|------|
| 400 | URL 格式无效 / 无法获取 URL 内容 / JSON 格式错误 / 缺少必需字段 / 字段类型不正确 |
| 500 | 服务器内部错误 |

**依赖安装**：后端需 `httpx` —— `pip install httpx==0.25.0` 或 `pip install -r requirements.txt`。

**本地测试**

```bash
# 1. 创建 test.json（见「三、JSON 数据格式规范」）
# 2. 启动静态服务器托管 JSON
python -m http.server 8080
# 3. 提交任务
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=http://localhost:8080/test.json"
# 4. 查询任务状态
curl "http://127.0.0.1:8000/api/tasks/{返回的task_id}"
```

也可使用仓库脚本：`cd coze-plugin && python test_submit_with_url.py`（自动建数据 + 起服务器 + 测端点 + 查状态），或 `python test_web_submit.py`（自动打开浏览器）。

**JSON 数据托管方式**：GitHub Gist（测试推荐）、S3/OSS 等云存储、自建 Web 服务器、本地 `python -m http.server`。

> **安全提示**：确保 URL 可被服务器访问；后端仅校验格式不校验业务逻辑；HTTP 请求超时 30 秒；生产环境建议 HTTPS。

---

### 4. sendData — 数据投递

**文件**：`coze-plugin/sendData.ts`（演示节点 `sendData_demo.ts`）
**作用**：通过 HTTP POST 向指定客户端投递数据，请求 `{api_base}/send-data`。

**输入参数**

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `api_base` | string | ✅ | API 基础地址，支持 http/https（缺协议自动补 `https://`） |
| `client_id` | string | ✅ | 客户端唯一标识，用于路由数据 |
| `data` | object | ✅ | 数据对象，必须含 `type` 和 `data` 字段 |

`data` 结构：

```typescript
{ type: string, data: any }
```

**输出参数**：`success`、`message`、`status_code`、`response_data`、`request_info`（成功时）、`error`（失败时）。

**使用示例**

```typescript
// 基础文本消息
{
  "api_base": "http://127.0.0.1:8000",
  "client_id": "client_001",
  "data": {
    "type": "text_message",
    "data": { "content": "Hello World!", "timestamp": "2024-01-01T00:00:00Z" }
  }
}

// 草稿数据更新
{
  "api_base": "http://localhost:8000",
  "client_id": "draft_manager",
  "data": {
    "type": "draft_update",
    "data": {
      "draft_id": "draft_67890",
      "changes": { "add_track": { "type": "video", "duration": 5000000 } }
    }
  }
}
```

**成功响应**

```json
{
  "success": true,
  "message": "数据发送成功",
  "status_code": 200,
  "response_data": { "message": "Data received successfully", "client_id": "client_001" },
  "request_info": {
    "api_url": "http://127.0.0.1:8000/send-data",
    "client_id": "client_001",
    "data_type": "text_message"
  }
}
```

**API 端点要求**：`POST {api_base}/send-data`，`Content-Type: application/json`。

**演示节点** `sendData_demo.ts` 内置三种类型：`basic`、`video_task`、`draft_data`。

---

## 三、JSON 数据格式规范

`preset_data` / 远程 JSON URL 返回的数据，统一遵循以下结构：

```json
{
  "ruleGroup": {
    "id": "group_123",
    "title": "我的草稿",
    "rules": [
      { "type": "image", "title": "图片", "material_ids": ["material_id_1"] }
    ]
  },
  "materials": [
    { "id": "material_id_1", "type": "photo", "path": "path/to/image.png" }
  ],
  "testData": {
    "tracks": [{ "id": "1", "type": "video", "title": "视频" }],
    "items": [
      { "type": "image", "data": { "track": "1", "start": 0, "duration": 5.616 } }
    ]
  },
  "use_raw_segments": true,
  "raw_segments": [],
  "raw_materials": [],
  "segment_styles": {},
  "draft_config": {
    "canvas_config": { "canvas_width": 1440, "canvas_height": 2560 },
    "fps": 30
  }
}
```

**必需字段**

- ✅ `ruleGroup`（对象）— 规则组配置：`id`、`title`、`rules` 数组
- ✅ `materials`（数组）— 素材列表
- ✅ `testData`（对象）— 测试数据：`tracks` 和 `items` 数组

**可选字段**

- `segment_styles`（对象）— 片段样式映射
- `use_raw_segments`（布尔）— 是否使用原始片段模式
- `raw_segments`（数组）— 原始片段数据
- `raw_materials`（数组）— 原始素材数据
- `draft_config`（对象）— 草稿配置（画布 `canvas_config`、`fps`）

完整结构参考 `coze-plugin/full-request.json`。

---

## 四、Web 状态页面

通过 URL 提交草稿后，系统会自动重定向到精美的 Web 页面，实时展示任务状态和进度，无需手动轮询。

**访问方式**：在浏览器打开

```
http://127.0.0.1:8000/api/tasks/submit_with_url?url=YOUR_JSON_URL
```

页面会自动重定向到 `/static/task_status.html?task_id=xxx`，每 2 秒刷新一次任务状态。

### 主要特性

- **自动重定向**：提交后跳转状态页
- **实时刷新**：每 2 秒更新
- **进度可视化**：进度条、文件数、下载大小、速度、剩余时间
- **响应式设计**：适配桌面和移动端

### 状态说明

| 状态 | 颜色 | 说明 |
|------|------|------|
| 等待中 | 黄色 | 任务已提交，等待处理 |
| 下载中 | 蓝色 | 正在下载远程素材 |
| 处理中 | 青色 | 正在生成草稿文件 |
| 已完成 | 绿色 | 任务完成，显示草稿路径 |
| 失败 | 红色 | 任务失败，显示错误信息 |
| 已取消 | 灰色 | 任务被用户取消 |

### 页面操作

- 🔄 立即刷新：手动刷新状态
- ❌ 取消任务：取消正在执行的任务

### 技术实现

- **前端**：纯 HTML/CSS/JavaScript（Fetch API + setInterval），无框架
- **后端**：FastAPI（RedirectResponse + StaticFiles）

```
pyJianYingDraftServer/
├── app/
│   ├── static/task_status.html   # 任务状态页面
│   ├── routers/tasks.py          # API 路由
│   └── main.py                   # 静态文件配置
```

### 高级用法

- **自定义刷新间隔**：修改 `task_status.html` 中 `setInterval` 的毫秒数（默认 2000）
- **禁用自动刷新**：在 `window.onload` 中注释掉 `startAutoRefresh()`
- **自定义样式**：修改 CSS 变量（背景/进度条渐变色）

---

## 五、工作流示例

**目标**：将用户提供的图片、字幕、配音自动生成为竖屏剪映视频草稿。

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   用户输入      │ ──▶ │  读取预设节点   │ ──▶ │  保存草稿节点   │ ──▶ │   返回草稿路径  │
│ (image/text/    │     │  (readPreset)   │     │ (importDraft)   │     │                 │
│  audio/duration)│     │  校验 valid     │     │  调用 API       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 工作流输入参数

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|-------|------|------|------|------|
| `image_url` | String | 是 | 图片 URL 或本地路径 | `https://example.com/image.jpg` |
| `text_content` | String | 是 | 字幕文本内容 | `这是一段测试文字` |
| `audio_url` | String | 是 | 配音文件 URL 或路径 | `https://example.com/audio.mp3` |
| `duration` | Number | 是 | 视频时长（秒） | `5.0` |
| `title` | String | 否 | 规则组标题 | `竖屏人物图片` |
| `custom_title` | String | 否 | 自定义草稿标题 | `我的视频草稿` |
| `group_id` | String | 否 | 规则组 ID | `group_001` |

### 节点 1：读取预设 (readPreset)

```json
{
  "preset_data": {
    "ruleGroup": {
      "id": "{{workflow.input.group_id}}",
      "title": "{{workflow.input.title}}",
      "rules": [
        { "type": "image",   "title": "图片", "material_ids": ["mat_image_001"] },
        { "type": "subtitle", "title": "字幕", "material_ids": ["mat_text_001"] },
        { "type": "vocal",   "title": "配音", "material_ids": ["mat_audio_001"] }
      ]
    },
    "materials": [
      { "id": "mat_image_001", "type": "photo",          "path": "{{workflow.input.image_url}}" },
      { "id": "mat_text_001",  "type": "subtitle",       "content": "{{workflow.input.text_content}}" },
      { "id": "mat_audio_001", "type": "extract_music",  "path": "{{workflow.input.audio_url}}" }
    ],
    "testData": {
      "tracks": [
        { "id": "1", "type": "video", "title": "视频" },
        { "id": "2", "type": "text",  "title": "字幕" },
        { "id": "3", "type": "audio", "title": "配音" }
      ],
      "items": [
        { "type": "image",    "data": { "track": "1", "start": 0, "duration": "{{workflow.input.duration}}", "path": "{{workflow.input.image_url}}" } },
        { "type": "subtitle", "data": { "track": "2", "start": 0, "duration": "{{workflow.input.duration}}", "text": "{{workflow.input.text_content}}" } },
        { "type": "vocal",    "data": { "track": "3", "start": 0, "duration": "{{workflow.input.duration}}", "text": "{{workflow.input.audio_url}}" } }
      ]
    },
    "draft_config": {
      "canvas_config": { "canvas_width": 1440, "canvas_height": 2560 },
      "fps": 30
    }
  },
  "api_base": "{{workflow.config.api_base}}"
}
```

输出变量：`readPreset.valid`、`readPreset.preset_data`、`readPreset.error`。

### 节点 2：条件判断

```
IF readPreset.valid == true  THEN 进入「保存草稿节点」
ELSE 返回错误
```

### 节点 3：保存草稿 (importDraft)

```json
{
  "preset_data": "{{readPreset.preset_data}}",
  "draft_title": "{{workflow.input.custom_title}}",
  "api_base": "{{workflow.config.api_base}}"
}
```

输出变量：`importDraft.success`、`importDraft.draft_path`、`importDraft.draft_name`、`importDraft.error`。

### 节点 4：返回结果

**成功**：

```
✅ 草稿已生成成功!
📁 草稿路径: {{importDraft.draft_path}}
📝 草稿名称: {{importDraft.draft_name}}
您可以在剪映中打开此草稿进行编辑。
```

**失败**：

```
❌ 生成失败
错误原因: {{readPreset.error || importDraft.error}}
```

### 全局变量配置

| 变量名 | 值 | 说明 |
|-------|---|------|
| `workflow.config.api_base` | `http://localhost:8000` | API 服务器地址 |

### 高级用法

1. **批量生成**：用循环节点处理数组 → `用户输入(数组) → 循环节点 → 读取预设 → 保存草稿 → 收集结果`
2. **动态画布**：根据 `format` 选择横竖屏尺寸
3. **集成文件上传**：`文件上传 → 获取文件 URL → 读取预设 → 保存草稿`

### 日志参考

执行日志可在 Coze 工作流详情中查看：

```
[INFO] 预设数据校验通过 { rule_count: 3, material_count: 3, track_count: 3, item_count: 3, mode: 'normal' }
[INFO] 调用 API: http://localhost:8000/api/rules/test
[INFO] 草稿保存成功 { draft_path: 'G:/jianyin5.9_drafts/...', draft_name: '...' }
```

后端终端日志：

```
INFO: 127.0.0.1:xxxxx - "POST /api/rules/test HTTP/1.1" 200 OK
[DEBUG] _build_raw_draft: raw_segments数量 = 4
[DEBUG] 创建新轨道: track_id=1, type=video
```

### 最佳实践

1. 始终检查 `valid` 和 `success` 字段
2. 关键步骤用 `logger.info()` 记录日志
3. 发送到 API 前先用 readPreset 校验
4. 用工作流全局变量统一管理 API 地址
5. 生产前充分测试各场景

---

## 六、故障排除

### 通用问题

**Q：如何验证 API 是否正常？**
访问 http://localhost:8000/docs 查看交互式 API 文档。

**Q：无法连接到 API 服务器 (`http://localhost:8000`)**
1. 确认服务已启动：`http://localhost:8000/health`
2. 检查防火墙设置
3. 远程服务器需使用完整 URL（如 `http://192.168.1.100:8000`）

### readPreset / importDraft

**草稿保存失败：`未在 config.json 或环境变量 PYJY_DRAFT_ROOT 中配置草稿保存目录`**
1. 配置草稿根目录（见「一、快速开始」第 2 步）
2. 确认目录存在且有写入权限

**数据校验失败：`缺少必需字段: ruleGroup, materials, testData`**
1. 检查输入数据是否符合 `full-request.json` 结构
2. 确保所有必需字段已提供（见「三、JSON 数据格式规范」）

### submitDraftWithUrl（URL 提交）

**`url 必须是有效的 HTTP/HTTPS 地址`**
确保 URL 以 `http://` 或 `https://` 开头。

**`无法获取 URL 内容`**
- 检查 URL 是否正确
- 确认服务器可访问该 URL（网络/防火墙）

**`URL 返回的内容不是有效的 JSON`**
检查返回的 `Content-Type` 是否为 `application/json`，并校验 JSON 格式。

**`JSON 数据缺少必需字段`**
确保 JSON 包含 `ruleGroup`、`materials`、`testData`。

### Web 状态页面

**页面显示「任务不存在」**
检查 URL 中的 `task_id` 参数是否正确。

**页面一直显示「加载中」**
1. 检查后端服务是否启动
2. 确认后端地址为 `http://127.0.0.1:8000`
3. 查看浏览器控制台错误

**提交后 404 错误**
1. 确认 `pyJianYingDraftServer/app/static/` 目录存在
2. 确认 `task_status.html` 存在
3. 重启后端服务

**进度条不更新**
1. 手动点击「立即刷新」
2. 检查浏览器控制台
3. 确认 `/api/tasks/{task_id}` 可访问

### sendData（数据投递）

**连接超时**
检查 `api_base` 是否正确，确认目标服务器运行中。

**认证失败**
检查是否需要 API 密钥/认证头，确认 `client_id` 有权限。

**数据格式错误**
确保 `data` 对象包含 `type` 字段。

**CORS 错误**
确认 API 端点支持跨域请求及预检请求配置。

---

## 📁 插件文件结构

```
coze-plugin/
├── demo.ts                       # 模板文件
├── readPreset.ts                 # 读取预设节点
├── importDraft.ts                # 保存草稿节点
├── submitDraftWithUrl.ts         # URL 提交节点
├── typings/submitDraftWithUrl/   # submitDraftWithUrl 类型定义
├── sendData.ts                   # 数据投递节点
├── sendData_demo.ts              # 数据投递演示节点
├── full-request.json             # 完整请求数据示例
├── test_submit_with_url.py       # URL 提交测试脚本
├── test_web_submit.py            # Web 提交测试脚本
└── doc/README.md                 # 本文档
```

## 🔧 开发说明

**添加新节点**

1. 复制 `demo.ts` 作为模板
2. 实现 `handler` 函数
3. 在 Coze 平台配置输入/输出参数元数据

**调试技巧**

- 使用 `logger.info()` / `logger.error()` 输出日志
- 在 Coze 工作流中查看节点执行日志
- 用 Postman 测试 API 端点

## 📚 相关资源

- [pyJianYingDraft 项目说明](../../CLAUDE.md)
- [pyJianYingDraftServer API 文档](../../pyJianYingDraftServer/README.md)
- API 交互式文档：http://localhost:8000/docs
- [Coze 工作流文档](https://www.coze.com/docs)

## 📜 版本历史

- **submitDraftWithUrl v1.0.0** (2025-10-25)：初始版本，Coze 节点 + Python API 端点，含完整数据验证和错误处理
- **sendData v1.0.0** (2024-01-01)：基础数据投递功能，完整错误处理机制
