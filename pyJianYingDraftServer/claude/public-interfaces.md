# 对外接口

## REST 路由（注册于 `app/main.py`）

| 方法/前缀 | 路由文件 | tags |
| --- | --- | --- |
| `/api/draft` | `routers/draft.py` | 草稿基础 |
| `/api/subdrafts` | `routers/subdrafts.py` | 复合片段 |
| `/api/materials` | `routers/materials.py` | 素材管理 |
| `/api/tracks` | `routers/tracks.py` | 轨道管理 |
| `/api/files` | `routers/files.py` | 文件服务 |
| `/api/rules` | `routers/rules.py` | 规则测试 |
| `/api/tasks`（tasks.router 自定义前缀） | `routers/tasks.py` | 异步任务 |
| `/api/aria2` | `routers/aria2.py` | Aria2 下载管理 |
| （generation_records.router 自定义） | `routers/generation_records.py` | 生成记录 |

注：`tasks.router` 与 `generation_records.router` 在注册时未显式 `prefix`，由路由内部装饰器定义具体路径。

## 任务状态机

```
PENDING → DOWNLOADING → PROCESSING → COMPLETED
                                   ↘ FAILED
```

## 典型任务流

1. `POST /api/tasks/submit`，body 含规则组、素材、测试数据（可选 `use_raw_segments`）。
2. 前端订阅进度（TaskQueue 内部 1s 轮询驱动推送）。
3. `GET /api/tasks/{task_id}` 查询状态与 `draft_path`。

## 规则类型映射（前后端共享）

- `image` / `video` → 视频轨道
- `audio` / `music` / `sound` / `extract_music` → 音频轨道
- `text` / `subtitle` → 文本轨道
- `video_effect` → 特效轨道

## 草稿生成核心

`services/rule_test_service.py` 的 `RuleTestService.run_test()`：
1. 解析 `RuleGroupTestRequest`。
2. `DraftFolder.create_draft()`。
3. `_build_segment_plans()` 构建片段计划。
4. 添加轨道与片段（主视频轨道从 0s 开始）。
5. `script.dump()`。

## 文档端点

- Swagger：`/docs`
- ReDoc：`/redoc`
- 静态：`/static`（若存在）
