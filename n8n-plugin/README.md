# n8n-nodes-jianying-draft

这是一个基于 `pyJianYingDraftServer` API 的 n8n 社区节点包,用于在 n8n 工作流中管理剪映(JianyingPro)草稿文件。

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

## 📦 包含的节点

### 1. Read Preset (读取预设节点)

校验并返回剪映草稿预设数据。

**输入参数:**
- `Preset Data` (必需): JSON字符串,包含完整的预设数据
- `API Base URL` (可选): API服务器基础地址,默认 `http://127.0.0.1:8000`

**输出:**
- `valid`: 布尔值,是否通过校验
- `preset_data`: 原始数据(校验通过时返回)
- `api_base`: API基础地址
- `stats`: 统计信息(规则数量、素材数量、轨道数量等)
- `message`: 结果消息
- `error`: 错误信息(校验失败时返回)

---

### 2. Import Draft (导入草稿节点)

调用 API 将预设数据提交为异步任务。

**输入参数:**
- `Preset Data` (必需): JSON字符串,包含完整的预设数据
- `Draft Title` (可选): 自定义草稿标题,默认使用 `ruleGroup.title`
- `API Base URL` (可选): API服务器基础地址,默认 `http://127.0.0.1:8000`

**输出:**
- `success`: 布尔值,任务是否成功提交
- `task_id`: 异步任务ID(成功时返回)
- `message`: 结果消息
- `api_response`: API原始响应
- `error`: 错误信息(失败时返回)

---

### 3. Get Task Result (查询任务结果节点)

查询草稿生成任务的状态和结果。

**输入参数:**
- `Task ID` (必需): 任务ID (从 Import Draft 返回的 task_id)
- `API Base URL` (可选): API服务器基础地址,默认 `http://127.0.0.1:8000`

**输出:**
- `success`: 布尔值,查询是否成功
- `task_id`: 任务ID
- `status`: 任务状态 (pending/downloading/processing/completed/failed/cancelled)
- `message`: 状态描述消息
- `progress`: 下载/处理进度信息
- `draft_path`: 生成的草稿路径(完成时返回)
- `error_message`: 错误信息(任务失败时返回)
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `completed_at`: 完成时间

---

### 4. Submit Draft With URL (通过URL提交草稿节点)

验证远程 JSON 数据并生成 API 调用地址。

**输入参数:**
- `URL` (必需): 远程 JSON 数据的 URL 地址
- `API Base URL` (可选): API服务器基础地址,默认 `http://127.0.0.1:8000`

**输出:**
- `success`: 布尔值,验证是否成功
- `api_url`: 生成的API调用URL
- `message`: 结果消息
- `validation_info`: 验证信息(素材数量、规则组标题等)
- `error`: 错误信息(失败时返回)

---

## 🚀 安装

### 社区节点安装 (推荐)

1. 进入你的 n8n 实例
2. 前往 **Settings** > **Community Nodes**
3. 选择 **Install**
4. 输入 `n8n-nodes-jianying-draft`
5. 同意风险后安装

### 手动安装

```bash
cd ~/.n8n/custom
npm install n8n-nodes-jianying-draft
```

重启 n8n 后,新节点将出现在节点面板中。

---

## ⚙️ 配置

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

### 3. 在 n8n 中配置凭据 (可选)

在 n8n 中创建 **Jianying Draft API** 凭据:

1. 前往 **Credentials** > **New**
2. 选择 **Jianying Draft API**
3. 输入 API Base URL (例如: `http://127.0.0.1:8000`)
4. 保存

---

## 📚 使用示例

### 示例工作流: 验证并提交草稿

```
┌─────────────────┐
│   手动触发      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Set Node        │  ← 设置预设数据
│ (preset JSON)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Read Preset     │  ← 校验数据格式
└────────┬────────┘
         │
         ├─ valid=false → 发送错误通知
         │
         └─ valid=true
                  │
                  ▼
         ┌─────────────────┐
         │ Import Draft    │  ← 提交异步任务
         └────────┬────────┘
                  │
                  ├─ success=false → 发送错误通知
                  │
                  └─ success=true
                           │
                           ▼
                  ┌─────────────────┐
                  │ Wait Node       │  ← 等待30秒
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Get Task Result │  ← 查询任务状态
                  └────────┬────────┘
                           │
                           ├─ status=completed → 成功通知
                           ├─ status=failed → 失败通知
                           └─ status=processing → 继续等待
```

### 示例预设数据

参考 `coze-plugin/data/full-request.json` 的完整结构。关键字段:

```json
{
  "ruleGroup": {
    "id": "group_xxx",
    "title": "竖屏人物图片",
    "rules": [...]
  },
  "materials": [...],
  "testData": {
    "tracks": [...],
    "items": [...]
  },
  "use_raw_segments": true,
  "raw_segments": [...],
  "raw_materials": [...],
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

## 🔧 开发

### 构建项目

```bash
npm install
npm run build
```

### 开发模式

```bash
npm run dev
```

### 代码格式化

```bash
npm run format
```

### 代码检查

```bash
npm run lint
npm run lintfix
```

---

## 📖 相关文档

- [n8n 官方文档](https://docs.n8n.io/)
- [n8n 社区节点开发指南](https://docs.n8n.io/integrations/creating-nodes/)
- [pyJianYingDraft 项目文档](../CLAUDE.md)
- [pyJianYingDraftServer API 文档](../pyJianYingDraftServer/README.md)
- API 交互式文档: http://localhost:8000/docs

---

## 🐛 故障排除

### 问题 1: 无法连接到 API 服务器

**错误**: `无法连接到 API 服务器 (http://localhost:8000)`

**解决**:
1. 确认服务已启动: `http://localhost:8000/health`
2. 检查防火墙设置
3. 如果在远程服务器,使用完整 URL

### 问题 2: 节点未出现在 n8n 中

**解决**:
1. 确认已重启 n8n
2. 检查安装路径是否正确
3. 查看 n8n 日志中的错误信息

### 问题 3: 草稿保存失败

**错误**: `API 错误: 未配置草稿保存目录`

**解决**:
1. 配置草稿根目录 (参考上方配置说明)
2. 确认目录存在且有写入权限

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

---

## 📮 联系方式

- GitHub: [your-username/n8n-nodes-jianying-draft](https://github.com/your-username/n8n-nodes-jianying-draft)
- Issues: [Report a bug](https://github.com/your-username/n8n-nodes-jianying-draft/issues)

---

## 版本历史

### 1.0.0
- 初始版本发布
- 包含 4 个核心节点: Read Preset, Import Draft, Get Task Result, Submit Draft With URL
- 支持凭据管理
- 完整的错误处理和验证
