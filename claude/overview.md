# 架构总览

## 三模块关系

```
pyjianyingdraft-web (Next.js 前端, 浏览器)
        │  HTTP REST / WebSocket(进度推送)
        ▼
pyJianYingDraftServer (FastAPI 后端, :8000)
        │  import pyJianYingDraft
        ▼
pyJianYingDraft (核心 Python 库)
        │  读写 draft_content.json
        ▼
剪映草稿文件夹 + 剪映客户端(可选 UI 自动化导出)
```

依赖方向是单向的：前端依赖后端，后端依赖核心库。核心库可独立使用（CLI/脚本）。

## 运行时形态

- **纯脚本模式**：直接 `import pyJianYingDraft as draft`，构造 `DraftFolder` → `ScriptFile` → `save()`。
- **服务模式**：后端常驻进程，前端通过浏览器编辑，后端调用核心库生成草稿并落盘到剪映草稿文件夹。
- **下载流水线**：前端提交任务 → 后端 TaskQueue → Aria2 批量下载 → 自动生成草稿 → WebSocket 推送进度。
- **自动导出**（仅 Windows）：核心库的 `JianyingController` 通过 `uiautomation` 操控剪映 GUI 批量导出。

## 重要设计取舍

1. **创建模式 vs 模板模式分离**：创建模式完全可控但无法表达剪映复合片段/复杂文本特效；模板模式加载现有草稿保留全部特性，但只允许受限编辑（替换素材/文本）。原因是剪映 6+ 对草稿加密，模板模式仅适用于 ≤5.9 的未加密文件。
2. **链式 API**：大多数 `ScriptFile` 方法返回 `self`，鼓励 `.add_track().add_segment().save()` 流式写法。
3. **素材自动注册**：添加片段时自动收集并注册 Material/Effect/Transition，调用方不必手动维护素材列表。
4. **元数据枚举中文命名**：`metadata/` 下的枚举成员用中文（对应剪映 UI），参数顺序写在枚举注释里，可能与 UI 显示顺序不一致。
5. **后端禁用热重载**：Aria2 是单例进程，`--reload` 会启动多份 uvicorn worker 导致多个 aria2c 冲突。
6. **后端入口实际为 `app.main:app`**（FastAPI 实例），部分旧文档提到的 `socket_app` 当前仓库未定义；WebSocket 推送通过任务队列内部轮询 + 自定义事件实现。

## 平台兼容性矩阵

| 能力 | Windows | Linux/macOS |
| --- | --- | --- |
| 草稿生成 | 全支持 | 全支持 |
| 模板模式 | ≤5.9 | ≤5.9 |
| 自动导出 | ≤6.x | 不支持 |
| 后端服务 | 全支持 | 全支持（无自动导出） |
| 前端 | 全支持 | 全支持 |
