# 快速开始 - 通过 URL 提交草稿

## 🚀 功能概览

通过提供一个包含草稿数据的 JSON URL，直接提交草稿生成任务，无需手动传递大量数据。

## 📋 前置要求

1. **Python 后端服务已启动**
2. **已安装 httpx 依赖**: `pip install httpx==0.25.0`

## ⚡ 快速使用

### 方式 1: 直接 API 调用

```bash
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=YOUR_JSON_URL"
```

**示例:**
```bash
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=https://example.com/draft-data.json"
```

### 方式 2: 在 Coze 中使用

1. 添加 `submitDraftWithUrl` 节点
2. 输入参数:
   - `url`: 你的 JSON 数据 URL
   - `base_url`: (可选) 默认 `http://127.0.0.1:8000`
3. 节点返回验证结果和 API URL
4. 使用 HTTP 请求节点调用返回的 API URL

## 📝 JSON 数据格式

你的 JSON URL 必须返回以下格式的数据:

```json
{
  "ruleGroup": {
    "id": "group_123",
    "title": "我的草稿"
  },
  "materials": [
    {
      "id": "mat_1",
      "type": "video",
      "path": "https://example.com/video.mp4"
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

**必需字段:** `ruleGroup`, `materials`, `testData`

## 🧪 本地测试

### 使用提供的测试脚本

```bash
# 在 coze-plugin 目录下
python test_submit_with_url.py
```

这个脚本会:
1. ✅ 创建测试 JSON 数据
2. ✅ 启动本地 HTTP 服务器
3. ✅ 测试 API 端点
4. ✅ 查询任务状态

### 手动测试

**1. 创建测试数据文件 `test.json`:**
```json
{
  "ruleGroup": {"id": "test", "title": "测试"},
  "materials": [],
  "testData": {}
}
```

**2. 启动简单 HTTP 服务器:**
```bash
python -m http.server 8080
```

**3. 提交任务:**
```bash
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=http://localhost:8080/test.json"
```

**4. 查询任务状态:**
```bash
curl "http://127.0.0.1:8000/api/tasks/{返回的task_id}"
```

## 📂 文件结构

```
coze-plugin/
├── submitDraftWithUrl.ts              # Coze 节点实现
├── typings/
│   └── submitDraftWithUrl/
│       └── submitDraftWithUrl.d.ts    # TypeScript 类型定义
├── test_submit_with_url.py            # 测试脚本
├── README_SUBMIT_WITH_URL.md          # 详细文档
└── QUICK_START_URL_SUBMIT.md          # 本文件

pyJianYingDraftServer/
├── app/
│   └── routers/
│       └── tasks.py                   # API 实现 (包含 submit_with_url 端点)
└── requirements.txt                   # 依赖 (已添加 httpx)
```

## ❓ 常见问题

### Q: 提示 "url 必须是有效的 HTTP/HTTPS 地址"
**A:** 确保 URL 以 `http://` 或 `https://` 开头

### Q: 提示 "无法连接到 API 服务器"
**A:** 检查 Python 后端是否已启动: `cd pyJianYingDraftServer && python run.py`

### Q: 提示 "JSON 数据缺少必需字段"
**A:** 确保 JSON 包含 `ruleGroup`、`materials`、`testData` 三个字段

### Q: 如何托管 JSON 数据?
**A:** 可以使用:
- GitHub Gist (推荐用于测试)
- 云存储服务 (S3, OSS 等)
- 自己的 Web 服务器
- 本地测试: `python -m http.server`

## 🔗 相关链接

- **详细文档**: [README_SUBMIT_WITH_URL.md](./README_SUBMIT_WITH_URL.md)
- **API 路由代码**: [tasks.py](../pyJianYingDraftServer/app/routers/tasks.py)
- **Coze 节点代码**: [submitDraftWithUrl.ts](./submitDraftWithUrl.ts)

## 💡 提示

1. **URL 可访问性**: 确保提供的 URL 可以从服务器访问
2. **超时设置**: HTTP 请求超时为 30 秒
3. **数据大小**: 建议 JSON 数据不要太大，避免超时
4. **HTTPS 推荐**: 生产环境使用 HTTPS URL

## 📞 需要帮助?

查看详细文档: [README_SUBMIT_WITH_URL.md](./README_SUBMIT_WITH_URL.md)
