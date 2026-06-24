# 常见问题

## 启动后多个 aria2c 进程

- 启用了 `--reload`。用 `python run.py`（已 `reload=False`）。
- 清理：`python cleanup_aria2.py`。
- 定位：`app/services/aria2_manager.py`。

## 找不到 `socket_app`

- 实际入口是 `app.main:app`。
- 定位：`app/main.py:168`、`run.py`。

## 服务器重启后下载状态丢失

- Aria2 GID 变化，从 DB `download_files` 恢复。
- 定位：`app/services/task_queue.py`、文档 `GID_PATH_MAPPING.md`。

## 日志递归错误

- 误改了根 logger。只配置 `pyJianYingDraft` logger 且 `propagate=False`。
- 定位：`app/main.py` 顶部。

## 草稿生成失败：主视频轨道对齐

- 主视频轨道片段必须从 0s 开始。
- 定位：`app/services/rule_test_service.py`。

## 下载失败重试

- 默认 3 次，指数退避，改 `aria2_client.py` 的 `MAX_RETRY_COUNT`。
- 定位：`app/services/aria2_client.py`、文档 `ARIA2_RETRY_GUIDE.md`。

## config.json 必填项

- `PYJY_DRAFT_ROOT` 必须指向有效剪映草稿文件夹。
- 定位：`app/config.py`、`config.json`。

## Windows GBK 编码错误

- `main.py` 已把 stdout/stderr 包装为 UTF-8。
- 若仍报错，检查终端代码页。
