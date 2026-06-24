# 架构总览

## 类层次

```
DraftFolder (草稿文件夹管理器)
└── ScriptFile (草稿文件核心)
    ├── ScriptMaterial (素材集合)
    ├── Track (video/audio/text/effect/filter)
    │   └── Segment (基类)
    │       ├── VideoSegment / AudioSegment
    │       ├── TextSegment
    │       ├── StickerSegment
    │       ├── EffectSegment / FilterSegment
    │       └── ImportedSegment (模板模式)
    └── ImportedTrack (模板模式)
        ├── ImportedMediaTrack
        └── ImportedTextTrack
```

## 双模式设计

- **创建模式**：`DraftFolder.create_draft()` → `ScriptFile`，从零构建，完全可控，但无法表达剪映复合片段/复杂文本特效。
- **模板模式**：`DraftFolder.duplicate_as_template()` → 加载现有草稿，保留全部特性，仅允许三种受限替换（按名称/按片段替换素材、替换文本）。

分离原因：剪映 6+ 加密使模板模式只能支持 ≤5.9；同时复杂特效难以用代码重建。

## 关键设计模式

1. **链式调用**：大多数 `ScriptFile` 方法返回 `self`。
2. **素材自动注册**：添加片段时自动收集 Material/Effect/Transition。
3. **中文枚举**：`metadata/` 下枚举成员名对应剪映 UI，参数顺序写在注释里。

## 运行时形态

- 纯 Python 脚本调用，无守护进程。
- 自动导出（Windows）：`JianyingController` 通过 `uiautomation` 启动并操控剪映 GUI。
- 元数据来自 `assets/*.json` 与 `metadata/*.py` 枚举。
