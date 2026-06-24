# 常见问题

## 时间单位搞混

- 内部统一微秒，`SEC = 1000000`。
- `trange("0s", "5s")` 第二参数是**持续时长 5 秒**，不是结束时刻 5 秒。
- 关键帧时刻是相对片段头部的偏移。
- 定位：`pyJianYingDraft/time_util.py`。

## 主视频轨道片段被剪映强制对齐

- 主视频轨道（最底层）片段必须从 `0s` 开始。
- 定位：`pyJianYingDraft/track.py`、`script_file.py`。

## 模板模式加载失败

- 剪映 6+ 对草稿加密，模板模式仅支持 ≤5.9 未加密 `draft_content.json`。
- 定位：`pyJianYingDraft/template_mode.py`。

## 文本动画顺序错乱

- 同时设置循环和出入场动画时，必须**先添加出入场动画**。
- 定位：`pyJianYingDraft/text_segment.py`。

## 多个同名轨道报错

- 多个同类型轨道必须指定 `track_name`。
- 定位：`pyJianYingDraft/track.py`。

## 后端启动后多个 aria2c 进程

- 启用了 `--reload`。必须禁用（`run.py` 已默认 `reload=False`）。
- 清理：`python cleanup_aria2.py`。
- 定位：`pyJianYingDraftServer/app/services/aria2_manager.py`。

## 服务器重启后下载状态丢失

- Aria2 GID 在重启后变化，需从数据库 `download_files` 字段恢复映射。
- 定位：`pyJianYingDraftServer/app/services/task_queue.py`、文档 `GID_PATH_MAPPING.md`。

## 后端入口找不到 `socket_app`

- 当前实际入口是 `app.main:app`（FastAPI 实例），非 `socket_app`。
- 定位：`pyJianYingDraftServer/app/main.py:168`、`run.py`。

## 前端找不到 `electron/` 目录

- 当前仓库无 `electron/` 目录（与历史描述不符），实际是纯 Next.js（App Router）。
- 打包脚本 `build:all` 仅做后端 exe + `next build`。
- 定位：`pyjianyingdraft-web/package.json`。

## 路径在 Linux/macOS 报错

- 避免硬编码 Windows 路径，用 `os.path.join()` 或 `pathlib.Path`。
- 自动导出功能在非 Windows 不可用。

## 剪映升级后特效/滤镜失效

- 元数据 ID 变化，需从实际草稿文件中提取更新 `pyJianYingDraft/metadata/`。
