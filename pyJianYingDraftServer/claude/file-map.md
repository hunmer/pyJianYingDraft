# 文件地图

## 入口与配置

| 文件 | 说明 |
| --- | --- |
| `run.py` | uvicorn 启动（reload=False） |
| `run_production.py` | 生产启动（旧文档提及） |
| `build_server.py` | PyInstaller 打包 |
| `config.json` | 服务配置 |
| `cleanup_aria2.py` | 清理 aria2c |
| `example_aria2_usage.py` | Aria2 示例 |
| `test_e2e.py` / `test_database.py` / `test_groups.py` | 测试 |

## app/

| 文件 | 说明 |
| --- | --- |
| `main.py` | FastAPI 入口（app 实例在 :168） |
| `config.py` | 配置加载 |
| `db.py` | SQLite 异步 ORM |
| `path_utils.py` | 路径工具 |

## app/routers/

`draft.py`、`subdrafts.py`、`materials.py`、`tracks.py`、`files.py`、`rules.py`、`tasks.py`、`aria2.py`、`generation_records.py`

## app/services/

`draft_service.py`、`rule_test_service.py`、`task_queue.py`、`aria2_manager.py`、`aria2_client.py`、`aria2_controller.py`、`aria2_singleton.py`、`generation_record_service.py`

## app/models/

`draft_models.py`、`rule_models.py`、`download_models.py`、`generation_record_models.py`

## 运行时产物（.gitignore）

- `aria2.conf`、`aria2.log`
- `data/`、`tasks.db`
- `dist/`、`*.exe`
