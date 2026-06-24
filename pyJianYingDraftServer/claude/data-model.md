# 数据模型

## SQLite 表（`app/db.py`）

- 异步 SQLAlchemy ORM。
- 主要表：
  - 任务（含状态、`download_files` 映射、`draft_path`、创建时间等）。
  - 生成记录（generation_records）。
- 自动清理：默认保留 30 天任务。
- 重启恢复：从 DB 加载任务，但 Aria2 GID 会变化，需通过 `download_files` 重新映射。

## 任务状态机

```
PENDING → DOWNLOADING → PROCESSING → COMPLETED
                                   ↘ FAILED
```

## 规则组（Rule Group）

- 每条规则：素材类型 + 素材 ID。
- 类型 → 轨道映射见 [public-interfaces](public-interfaces.md)。

## 测试数据（Test Data）

- `tracks`：轨道列表，每轨道含多个片段。
- `segments`：`target_timerange`。
- `styles`：关键帧/动画/特效。
- `use_raw_segments: true` + `raw_segments`：原始片段模式。

## Pydantic 模型（`app/models/`）

- `draft_models.py`：草稿数据结构。
- `rule_models.py`：`RuleGroupTestRequest` 等规则与测试数据。
- `download_models.py`：下载任务。
- `generation_record_models.py`：生成记录。

## 文件版本管理

- 自动备份历史，最多 10 个版本。
- 通过 WebSocket（旧描述）或轮询推送更新。
