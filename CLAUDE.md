# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**pyJianYingDraft** 是一个 Python 库,用于编程方式生成和操作剪映(JianyingPro)的草稿文件。它允许开发者通过代码创建视频剪辑项目,而无需手动在剪映界面操作。

**核心能力:**
- 生成剪映草稿文件 (`draft_content.json`)
- 模板模式:加载现有草稿并替换素材/文本
- 自动导出:控制剪映批量导出视频(仅 Windows,剪映 ≤6.x)

## 开发环境

- **Python 版本:** 推荐 3.8 或 3.11
- **依赖:** pymediainfo, imageio, uiautomation (Windows)
- **测试:** 主要在剪映 5.9 版本测试,部分功能支持 5.x-7.x

## 架构设计

### 核心类层次

```
DraftFolder (草稿文件夹管理器)
└── ScriptFile (草稿文件核心)
    ├── ScriptMaterial (素材集合: 音视频/文本/特效/转场等)
    ├── Track (轨道: video/audio/text/effect/filter)
    │   └── Segment (片段基类)
    │       ├── VideoSegment / AudioSegment
    │       ├── TextSegment
    │       ├── StickerSegment
    │       ├── EffectSegment / FilterSegment
    │       └── ImportedSegment (模板模式)
    └── ImportedTrack (模板模式导入的轨道)
        ├── ImportedMediaTrack (音视频轨道)
        └── ImportedTextTrack (文本轨道)
```

### 关键设计模式

1. **链式调用:** 大多数方法返回 `self`,支持 `.add_track().add_segment().save()` 链式写法
2. **素材自动管理:** 添加片段时自动收集并注册相关素材(Material/Effect/Transition 等)
3. **模板与创建模式分离:**
   - 创建模式: 从头构建草稿,完全可控
   - 模板模式: 加载现有草稿,保留复杂特性(复合片段/文本特效等),仅允许受限编辑

## 常用开发任务

### 运行示例
```bash
python demo.py  # 需先修改草稿文件夹路径
```

### 测试和验证
- **手动验证:** 运行代码后在剪映中打开生成的草稿,检查时间轴是否符合预期
- **注意:** 项目无自动化测试,依赖剪映软件验证

### 时间系统
- **内部单位:** 微秒 (`int`)
- **便捷输入:** 字符串形式如 `"1.5s"`, `"1h3m12s"`
- **转换函数:**
  - `tim(time_str)`: 字符串 → 微秒
  - `trange(start, duration)`: 创建 `Timerange` 对象 (注意第二个参数是**持续时长**,不是结束时间)
  - `SEC = 1000000` (1秒 = 1,000,000 微秒)

### 路径处理原则
- 使用 `os.path.join()` 构建跨平台路径
- 素材路径支持绝对路径和相对路径
- Windows 路径在代码中使用原始字符串 `r"path\to\file"`

## 模块职责

### 核心模块
- **`script_file.py`**: 草稿文件主类 `ScriptFile`,管理整体结构和导出逻辑
- **`draft_folder.py`**: 文件夹级别操作,创建/加载/复制草稿
- **`track.py`**: 轨道管理,包括 `TrackType` 枚举和 `Track` 类
- **`segment.py`**: 片段基类,定义共通属性(time_range, material_id 等)

### 片段类型
- **`video_segment.py`**: 视频/贴纸片段,关键帧,蒙版,动画,特效,滤镜,转场,背景填充
- **`audio_segment.py`**: 音频片段,音量关键帧,淡入淡出,音效
- **`text_segment.py`**: 文本片段,字体样式,气泡/花字效果,描边/阴影/背景
- **`effect_segment.py`**: 独立轨道上的特效/滤镜片段

### 素材与元数据
- **`local_materials.py`**: 本地素材封装 (`VideoMaterial`, `AudioMaterial`),含媒体信息提取
- **`metadata/`**: 剪映内置资源的枚举定义
  - `font_meta.py`, `filter_meta.py`, `transition_meta.py` 等
  - 枚举成员以中文命名,对应剪映 UI 中的名称
  - 注释中标注可调参数及其顺序

### 工具模块
- **`time_util.py`**: 时间转换 (`tim`, `trange`, `Timerange`, `srt_tstamp`)
- **`keyframe.py`**: 关键帧系统,支持 alpha/transform/scale/volume 等属性
- **`animation.py`**: 入场/出场/循环动画的元数据管理
- **`template_mode.py`**: 模板模式专用类 (`ImportedTrack`, `ShrinkMode`, `ExtendMode`)
- **`jianying_controller.py`**: UI 自动化导出 (Windows only, 依赖 uiautomation)
- **`util.py`**: 通用工具函数 (JSON 序列化,属性赋值等)
- **`exceptions.py`**: 自定义异常 (`MaterialNotFound`, `TrackNotFound`, `ExtensionFailed` 等)

## 重要约定

### 命名规范
- **类名:** PascalCase (如 `VideoSegment`, `ScriptFile`)
- **向后兼容:** 保留 snake_case 别名(如 `Script_file`),但会触发 `DeprecationWarning`
- **枚举类:** 中文成员名直接对应剪映 UI,提供 `from_name()` 忽略大小写/空格/下划线查找

### 参数顺序约定
- 片段构造函数: `__init__(material, target_timerange, source_timerange=None, speed=None, ...)`
- `target_timerange`: 片段在时间轴上的位置和长度
- `source_timerange`: 从素材中截取的范围 (可选,默认自动计算)
- `speed`: 播放速度 (可选,默认 1.0)

### 特效和滤镜参数
- 参数列表 (`params`) 顺序以枚举类**注释**为准,不一定与剪映 UI 顺序一致
- 参数值范围 0-100,对应剪映 UI 中的百分比
- `None` 表示使用默认值

### 轨道层级
- `relative_index`: 相对于同类型轨道的层级,值越大越靠近前景
- `absolute_index`: 直接覆盖 `render_index`,供高级用户使用
- 主视频轨道(最底层)的片段必须从 0s 开始

### 模板模式限制
- 仅支持未加密的 `draft_content.json` (剪映 ≤5.9)
- 导入的轨道(`ImportedTrack`)不可直接添加新片段
- 支持三种替换:
  1. 按名称替换素材 (`replace_material_by_name`) - 影响所有引用
  2. 按片段替换素材 (`replace_material_by_seg`) - 单个片段,支持时间范围调整
  3. 替换文本内容 (`replace_text`) - 保留格式

## 常见陷阱

1. **时间单位混淆:** 记住 `trange("0s", "5s")` 第二个参数是持续时长,不是结束时间
2. **轨道名称:** 多个同类型轨道时必须指定 `track_name`
3. **素材路径:** 替换素材时需确保新素材路径正确且可访问
4. **文本动画顺序:** 为文本片段同时设置循环和出入场动画时,必须先添加出入场动画
5. **关键帧时间:** 关键帧时刻是相对于片段头部的偏移量,不是绝对时间
6. **模板兼容性:** 剪映 6+ 版本对草稿文件加密,模板模式目前无法加载
7. **主视频轨道对齐:** 主视频轨道(最底层)片段必须从 0s 开始,否则剪映会强制对齐

## 版本兼容性

| 功能 | 剪映版本 | 说明 |
|-----|---------|------|
| 草稿生成 (音视频/文本/特效) | 5.x ~ 7.x | ✅ 全版本支持 |
| 模板模式 (加载/替换) | ≤ 5.9 | ⚠️ 6+ 版本文件加密 |
| 自动导出 | ≤ 6.x | ⚠️ 7+ 版本隐藏控件 |

## 平台兼容性

- **Windows:** 全功能支持
- **Linux/MacOS:** 支持草稿生成和模板模式,**不支持自动导出**,生成的草稿需在 Windows 剪映导出

## 典型工作流

```python
import pyJianYingDraft as draft

# 1. 初始化草稿文件夹
folder = draft.DraftFolder(r"path/to/JianyingPro Drafts")

# 2a. 创建新草稿 (创建模式)
script = folder.create_draft("my_video", 1920, 1080)

# 2b. 或加载模板 (模板模式)
script = folder.duplicate_as_template("template_name", "new_draft")

# 3. 添加轨道
script.add_track(draft.TrackType.video)
script.add_track(draft.TrackType.audio)

# 4. 创建并添加片段
video_seg = draft.VideoSegment("video.mp4", draft.trange("0s", "5s"))
audio_seg = draft.AudioSegment("audio.mp3", draft.trange("0s", "5s"), volume=0.8)
script.add_segment(video_seg).add_segment(audio_seg)

# 5. 保存
script.save()  # 模板模式
# script.dump("path/to/draft_content.json")  # 创建模式
```

## 扩展指南

- **添加新特效/滤镜类型:** 在 `metadata/` 对应模块中扩展枚举类,标注参数
- **支持新片段类型:** 继承 `BaseSegment`,实现 `export_json()` 方法
- **新素材类型:** 继承 `VideoMaterial` 或 `AudioMaterial`,添加媒体信息提取逻辑
- **元数据更新:** 剪映更新后资源 ID 可能变化,需从实际草稿文件中提取更新
- # Error Type
Runtime Error

## Error Message
Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of `FileDiffViewer`.


    at FileDiffViewer (src\components\FileDiffViewer.tsx:215:9)
    at Home (src\app\page.tsx:362:13)

## Code Frame
  213 |       {/* 版本选择器 */}
  214 |       <Paper sx={{ p: 2, mb: 2 }}>
> 215 |         <Grid container spacing={2}>
      |         ^
  216 |           {/* 版本1选择 */}
  217 |           <Grid size={{ xs: 12, md: 6 }}>
  218 |             <FormControl fullWidth>

Next.js version: 15.5.6 (Webpack)