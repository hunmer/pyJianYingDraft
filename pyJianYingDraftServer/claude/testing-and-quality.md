# 测试与质量

## 测试脚本

| 脚本 | 用途 |
| --- | --- |
| `test_e2e.py` | 端到端 |
| `test_database.py` | 数据库 |
| `test_groups.py` | 规则组 |

运行前请确认服务已启动或脚本自包含。

## 排障脚本

- `cleanup_aria2.py`：清理 aria2c 进程。
- `example_aria2_usage.py`：Aria2 用法示例。

## 排障文档（位于本目录）

- `ASYNC_DOWNLOAD_SYSTEM.md`
- `ARIA2_ARCHITECTURE.md`
- `ARIA2_FIX_GUIDE.md`
- `ARIA2_RETRY_GUIDE.md`
- `GID_PATH_MAPPING.md`
- `PROJECT_STRUCTURE.md`
- `README_BUILD.md`

## 质量风险

1. Aria2 多进程（启用 reload）。
2. 服务器重启后 GID 丢失，依赖 DB 映射。
3. 日志递归（误改根 logger）。
4. `config.json` 的 `PYJY_DRAFT_ROOT` 配置错误导致草稿无法生成。
5. 跨平台路径硬编码。
6. 主视频轨道不从 0s 导致剪映强制对齐。
