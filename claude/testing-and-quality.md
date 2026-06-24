# 测试与质量

## 核心库

- **无自动化测试**，依赖在剪映软件中手动打开生成的草稿验证时间轴。
- 验证手段：运行 `demo.py` / `demo_subdrafts.py`，在剪映中打开生成结果。

## 后端

测试脚本位于 `pyJianYingDraftServer/`：

| 脚本 | 用途 |
| --- | --- |
| `test_e2e.py` | 端到端测试 |
| `test_database.py` | 数据库测试 |
| `test_groups.py` | 规则组测试 |

运行：`python test_*.py`（需先启动服务或按脚本内部要求）。

排障辅助脚本：`cleanup_aria2.py`（清理 Aria2 进程）、`example_aria2_usage.py`（Aria2 用法示例）。

详细排障文档：`ARIA2_FIX_GUIDE.md`、`ARIA2_RETRY_GUIDE.md`、`ASYNC_DOWNLOAD_SYSTEM.md`、`ARIA2_ARCHITECTURE.md`、`GID_PATH_MAPPING.md`、`PROJECT_STRUCTURE.md`、`README_BUILD.md`（均位于 `pyJianYingDraftServer/`）。

## 前端

- Lint：`npm run lint`（`next lint`，基于 `eslint-config-next`）。
- 类型检查：`tsc`（`typescript@5`，通过 `next build` 隐式执行）。
- 无单元测试框架配置（package.json 未发现 jest/vitest）。

## 质量风险

1. 核心库无自动化测试，回归依赖人工。
2. 剪映版本升级会导致元数据 ID 失效（`metadata/` 需从实际草稿更新）。
3. Aria2 GID 在服务器重启后变化，依赖 DB 映射恢复。
4. 时间单位混淆（微秒 vs 秒）是高频 bug 源。
5. 模板模式无法支持剪映 6+ 加密文件。
