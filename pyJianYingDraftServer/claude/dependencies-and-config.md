# 依赖与配置

## 依赖

- FastAPI + uvicorn（ASGI）。
- SQLAlchemy（异步 ORM）+ aiosqlite（隐式，SQLite 异步驱动）。
- aria2p（Aria2 RPC 客户端）。
- 外部 aria2c 可执行文件。
- 父目录核心库 `pyJianYingDraft`（通过 `sys.path` 注入，非 pip）。
- PyInstaller（打包）。

## config.json 关键项

```json
{
  "PYJY_DRAFT_ROOT": "剪映草稿文件夹路径（必填）",
  "ARIA2_PATH": "aria2c 路径（可选）",
  "PYJY_RULE_GROUPS": [规则组数组]
}
```

## Aria2 路径发现顺序

1. `config.json` 的 `ARIA2_PATH`。
2. 打包资源 `resources/aria2c.exe`。
3. 系统 PATH 中的 `aria2c`。

## 环境变量

- `PYTHONUNBUFFERED=1`：`run.py` 已设。
- 打包环境：`sys.frozen=True`，路径用 `sys.executable`。

## Aria2 运行时文件

- 配置：`pyJianYingDraftServer/aria2.conf`。
- 日志：`pyJianYingDraftServer/aria2.log`。

## 兼容性

- 草稿解析/生成：剪映 5.x ~ 7.x。
- 模板模式：≤ 5.9。
- Windows 全功能 + 自动导出（≤6.x）；Linux/macOS 支持服务与生成，无自动导出。
