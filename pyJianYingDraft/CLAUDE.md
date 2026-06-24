# CLAUDE.md — pyJianYingDraft 核心库

[根目录](../CLAUDE.md) > **pyJianYingDraft**

## 模块简单介绍

pyJianYingDraft 核心库以编程方式生成和操作剪映（JianYing/CapCut）草稿文件（`draft_content.json`），是整个工具集的能力底座。支持两种工作模式：创建模式（从头构建，完全可控）与模板模式（加载现有草稿，保留复杂特性仅做受限替换）。在 Windows 下还能通过 UI 自动化操控剪映客户端批量导出视频。

关键技术栈：Python 3.8/3.11、pymediainfo（媒体信息）、imageio（图片）、uiautomation（仅 Windows 自动导出）。作为 pip 包发布（`setup.py`），也是后端 `pyJianYingDraftServer` 的依赖。

## 约定的规则

- 时间内部单位为微秒，`SEC = 1000000`；`trange(start, duration)` 第二参数是持续时长。
- 主视频轨道（最底层）片段必须从 `0s` 开始。
- 模板模式仅支持剪映 ≤5.9；自动导出仅支持剪映 ≤6.x。
- 类名 PascalCase；snake_case 旧别名仅作向后兼容，触发 `DeprecationWarning`。
- 大多数方法返回 `self`，支持链式调用。
- 特效/滤镜参数顺序以枚举类注释为准（不一定与剪映 UI 一致），取值 0-100。
- 文本片段同时设置循环和出入场动画时，必须先添加出入场动画。
- 关键帧时刻是相对片段头部的偏移量。
- Windows 才有 `JianyingController`（`__init__.py` 按 `sys.platform` 条件导出）。
- 详情见 [约定详情](claude/conventions.md)。

## 文件索引

| 文件 | 用途 | 何时阅读 |
| --- | --- | --- |
| [架构总览](claude/overview.md) | 类层次、双模式设计、运行时形态 | 第一次接手 |
| [约定详情](claude/conventions.md) | 时间/命名/参数顺序/模板限制细则 | 写片段代码前 |
| [模块职责](claude/module-responsibilities.md) | 各 `.py` 文件职责 | 找实现位置 |
| [入口与启动](claude/entrypoints.md) | 包导入、示例脚本 | 跑示例 |
| [对外接口](claude/public-interfaces.md) | `__init__.py` 公开导出清单 | 调用 API |
| [依赖与配置](claude/dependencies-and-config.md) | pip 依赖、MediaInfo 要求 | 环境配置 |
| [数据模型](claude/data-model.md) | 核心类层次、片段字段、元数据枚举 | 设计片段 |
| [测试与质量](claude/testing-and-quality.md) | 验证方式、质量风险 | 验证改动 |
| [文件地图](claude/file-map.md) | 17 个 `.py` + `metadata/` 清单 | 找文件 |
| [常见问题](claude/faq.md) | 时间混淆、轨道对齐、模板失败等 | 排错 |
| [变更记录](claude/changelog.md) | 索引生成记录 | 看历史 |

## 扫描状态

- 更新时间：2026-06-24 09:19:30
- 已扫描：`__init__.py` 全文 + 全部 17 个 `.py` 路径 + `metadata/` 全部 17 个枚举文件路径。
- 跳过：各 `*_segment.py` 与 `metadata/*.py` 的函数体细节（仅在根级 data-model 概述）。
- 下一步建议：深挖 `video_segment.py`/`text_segment.py` 的具体参数与 `export_json()` 结构、`metadata/` 各枚举的可调参数注释。
