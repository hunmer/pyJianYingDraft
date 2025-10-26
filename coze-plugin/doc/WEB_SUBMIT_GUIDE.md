# Web 页面提交草稿 - 使用指南

## 🎯 功能概述

通过 URL 提交草稿数据后,系统会自动重定向到一个精美的 Web 页面,实时展示任务状态和进度,无需手动轮询 API。

## ✨ 主要特性

- **自动重定向**: 提交后自动跳转到状态页面
- **实时刷新**: 每 2 秒自动更新任务状态
- **进度可视化**: 美观的进度条和数据展示
- **状态提示**: 清晰的成功/失败提示
- **响应式设计**: 支持桌面和移动端浏览器

## 🚀 快速开始

### 方法 1: 浏览器直接访问

1. **启动后端服务**
   ```bash
   cd pyJianYingDraftServer
   python run.py
   ```

2. **准备 JSON 数据URL**
   - 确保你的 JSON 数据可以通过 HTTP/HTTPS 访问
   - 数据格式参考下文"JSON 数据格式"

3. **在浏览器中打开**
   ```
   http://127.0.0.1:8000/api/tasks/submit_with_url?url=YOUR_JSON_URL
   ```

4. **自动跳转到状态页面**
   - 页面会自动重定向到任务状态展示页面
   - 实时显示任务进度

### 方法 2: 使用测试脚本

```bash
cd coze-plugin
python test_web_submit.py
```

这个脚本会:
1. ✅ 创建测试 JSON 数据
2. ✅ 启动本地 HTTP 服务器
3. ✅ 自动在浏览器中打开提交 URL
4. ✅ 展示实时任务状态页面

### 方法 3: cURL 命令

```bash
# POST 请求
curl -X POST "http://127.0.0.1:8000/api/tasks/submit_with_url?url=YOUR_JSON_URL"

# GET 请求 (也支持)
curl "http://127.0.0.1:8000/api/tasks/submit_with_url?url=YOUR_JSON_URL"
```

## 📱 Web 状态页面功能

### 页面元素

1. **任务信息卡片**
   - 任务 ID
   - 当前状态(等待中/下载中/处理中/已完成/失败)
   - 状态消息
   - 创建时间和更新时间

2. **下载进度区域** (下载中时显示)
   - 可视化进度条
   - 已完成/总文件数
   - 已下载大小
   - 下载速度
   - 预计剩余时间

3. **操作按钮**
   - 🔄 立即刷新: 手动刷新状态
   - ❌ 取消任务: 取消正在执行的任务

4. **自动刷新指示器**
   - 显示最后更新时间
   - 自动刷新动画提示

### 状态说明

| 状态 | 颜色 | 说明 |
|------|------|------|
| **等待中** | 黄色 | 任务已提交,等待处理 |
| **下载中** | 蓝色 | 正在下载远程素材 |
| **处理中** | 青色 | 正在生成草稿文件 |
| **已完成** | 绿色 | 任务完成,显示草稿路径 |
| **失败** | 红色 | 任务失败,显示错误信息 |
| **已取消** | 灰色 | 任务被用户取消 |

## 🎨 页面设计特点

### 视觉设计
- **渐变背景**: 紫色渐变背景,现代化视觉效果
- **卡片布局**: 白色卡片,清晰层次感
- **圆角设计**: 柔和的圆角,友好的视觉体验
- **状态徽章**: 彩色状态标签,一目了然

### 交互设计
- **加载动画**: 旋转图标表示正在处理
- **平滑过渡**: 进度条变化流畅自然
- **实时更新**: 数据变化即时反映
- **响应式**: 自动适配不同屏幕尺寸

### 用户体验
- **自动刷新**: 无需手动刷新页面
- **完成提示**: 成功/失败清晰提示
- **操作引导**: 明确的操作按钮
- **错误处理**: 友好的错误消息

## 📊 数据流程

```
1. 用户提交 URL
   ↓
2. 后端验证并创建任务
   ↓
3. 重定向到状态页面 (/static/task_status.html?task_id=xxx)
   ↓
4. JavaScript 开始轮询 /api/tasks/{task_id}
   ↓
5. 每 2 秒更新一次页面数据
   ↓
6. 任务完成后停止轮询,显示结果
```

## 🛠️ 技术实现

### 前端技术
- **纯 HTML/CSS/JavaScript**: 无需任何框架
- **Fetch API**: 异步获取数据
- **URLSearchParams**: 解析任务 ID
- **setInterval**: 实现定时刷新

### 后端技术
- **FastAPI**: Web 框架
- **RedirectResponse**: 自动重定向
- **StaticFiles**: 静态文件服务
- **Query参数**: 接收 URL 参数

### 文件结构
```
pyJianYingDraftServer/
├── app/
│   ├── static/
│   │   └── task_status.html     # 任务状态页面
│   ├── routers/
│   │   └── tasks.py              # API 路由
│   └── main.py                   # 静态文件配置
```

## 📝 JSON 数据格式

远程 URL 返回的 JSON 必须包含以下字段:

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

## 🔍 故障排查

### 问题 1: 页面显示 "任务不存在"
**原因**: 任务 ID 无效或任务已被删除
**解决**: 检查 URL 中的 `task_id` 参数是否正确

### 问题 2: 页面一直显示 "加载中"
**原因**: 无法连接到后端 API
**解决**:
1. 检查后端服务是否已启动
2. 检查后端地址是否为 `http://127.0.0.1:8000`
3. 查看浏览器控制台的错误信息

### 问题 3: 提交后显示 404 错误
**原因**: 静态文件目录未正确配置
**解决**:
1. 确认 `pyJianYingDraftServer/app/static/` 目录存在
2. 确认 `task_status.html` 文件存在
3. 重启后端服务

### 问题 4: 进度条不更新
**原因**: JavaScript 自动刷新失败
**解决**:
1. 手动点击"立即刷新"按钮
2. 检查浏览器控制台错误
3. 确认 `/api/tasks/{task_id}` 接口可访问

## 💡 高级用法

### 自定义刷新间隔

修改 `task_status.html` 中的刷新间隔(默认 2000ms):

```javascript
refreshInterval = setInterval(() => {
    if (!isCompleted) {
        refreshStatus();
    }
}, 2000); // 修改这里的值(毫秒)
```

### 禁用自动刷新

在 `window.onload` 中注释掉自动刷新:

```javascript
window.onload = function() {
    if (!taskId) {
        showError('未提供任务 ID');
        return;
    }

    document.getElementById('taskId').textContent = taskId;
    refreshStatus();
    // startAutoRefresh(); // 注释这一行禁用自动刷新
};
```

### 自定义样式

修改 `task_status.html` 中的 CSS 变量:

```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    /* 修改背景渐变颜色 */
}

.progress-bar {
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    /* 修改进度条颜色 */
}
```

## 📞 相关链接

- **详细 API 文档**: [README_SUBMIT_WITH_URL.md](./README_SUBMIT_WITH_URL.md)
- **快速开始指南**: [QUICK_START_URL_SUBMIT.md](./QUICK_START_URL_SUBMIT.md)
- **源代码**:
  - 状态页面: [task_status.html](../pyJianYingDraftServer/app/static/task_status.html)
  - API 路由: [tasks.py](../pyJianYingDraftServer/app/routers/tasks.py)

## 🎉 示例截图说明

### 等待中状态
- 黄色状态徽章
- 加载动画旋转
- 显示"任务等待中"消息

### 下载中状态
- 蓝色状态徽章
- 显示进度条
- 实时更新下载速度和剩余时间

### 完成状态
- 绿色状态徽章
- 显示草稿文件路径
- 停止自动刷新

### 失败状态
- 红色状态徽章
- 显示详细错误信息
- 停止自动刷新

---

**提示**: 首次使用建议运行 `test_web_submit.py` 测试脚本体验完整流程！
