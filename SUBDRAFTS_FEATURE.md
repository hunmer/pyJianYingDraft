# Subdrafts (复合片段) 功能说明

## 概述

为 pyJianYingDraft 添加了读取和解析剪映草稿中复合片段 (subdrafts) 的功能。复合片段是剪映中的高级功能，允许将多个片段组合成一个可复用的单元。

## 新增功能

### 1. `ScriptFile.read_subdrafts()` 方法

读取草稿中的所有复合片段信息。

**返回值**: `List[Dict[str, Any]]` - 复合片段信息列表

**每个复合片段字典包含的主要字段**:
- `id` (str): 复合片段的唯一标识符
- `name` (str): 复合片段名称
- `type` (str): 复合片段类型
- `combination_id` (str): 组合ID
- `combination_type` (str): 组合类型
- `draft` (Dict): 嵌套的完整草稿数据，包含:
  - `canvas_config`: 画布配置（分辨率、比例）
  - `duration`: 时长（微秒）
  - `fps`: 帧率
  - `tracks`: 轨道列表
  - `materials`: 素材字典（videos、audios、texts等）
  - 其他草稿属性...

**使用示例**:

```python
import pyJianYingDraft as draft

# 加载包含复合片段的草稿
script = draft.ScriptFile.load_template("draft_content.json")

# 读取复合片段
subdrafts = script.read_subdrafts()

# 遍历复合片段
for subdraft in subdrafts:
    print(f"复合片段: {subdraft['name']}")
    print(f"  ID: {subdraft['id']}")
    print(f"  时长: {subdraft['draft']['duration']} 微秒")
    print(f"  轨道数: {len(subdraft['draft']['tracks'])}")
```

### 2. `ScriptFile.print_subdrafts_info()` 方法

打印草稿中所有复合片段的详细信息，包括名称、ID、时长、分辨率、帧率、轨道统计、素材统计等。

**使用示例**:

```python
import pyJianYingDraft as draft

# 加载草稿
script = draft.ScriptFile.load_template("draft_content.json")

# 打印详细信息
script.print_subdrafts_info()
```

**输出示例**:

```
共找到 1 个复合片段:

复合片段 1:
  名称: 我的复合片段
  ID: E3E401BF-E85D-4b97-AC2D-79D23E80E686
  类型: combination
  组合ID: 26666518-8DBB-4901-87FA-BE72EE5F5AA7
  组合类型: none

  嵌套草稿信息:
    分辨率: 1920x1080
    帧率: 30.0 fps
    时长: 23.13 秒
    轨道数: 15
    轨道类型分布: video: 7, text: 5, audio: 3
    素材统计: 视频 10, 音频 25, 文本 39
```

## 技术实现

### 数据存储位置

复合片段数据存储在剪映草稿文件的 `materials.drafts` 数组中，每个元素是一个包含完整嵌套草稿的对象。

### 核心代码

**读取方法** (`script_file.py:777-805`):
```python
def read_subdrafts(self) -> List[Dict[str, Any]]:
    """读取草稿中的复合片段(subdrafts)信息"""
    if "drafts" not in self.imported_materials:
        return []
    return self.imported_materials["drafts"]
```

**打印方法** (`script_file.py:807-856`):
```python
def print_subdrafts_info(self) -> None:
    """打印草稿中所有复合片段的详细信息"""
    subdrafts = self.read_subdrafts()

    if not subdrafts:
        print("草稿中没有复合片段")
        return

    # 输出详细信息...
```

## 测试验证

### 自动化测试

创建了完整的单元测试套件 (`test_subdrafts.py`)，包含 8 个测试用例：

1. ✅ `test_load_template_with_subdrafts` - 加载包含复合片段的模板
2. ✅ `test_read_subdrafts_returns_list` - 验证返回列表类型
3. ✅ `test_subdrafts_structure` - 验证数据结构完整性
4. ✅ `test_subdrafts_draft_canvas_config` - 验证画布配置
5. ✅ `test_subdrafts_tracks_and_materials` - 验证轨道和素材
6. ✅ `test_print_subdrafts_info` - 验证打印功能
7. ✅ `test_multiple_subdrafts` - 验证多个复合片段处理
8. ✅ `test_empty_subdrafts` - 验证空列表处理

**运行测试**:
```bash
python test_subdrafts.py
```

**测试结果**: 所有 8 个测试用例全部通过 ✓

### 演示脚本

创建了详细的演示脚本 (`demo_subdrafts.py`)，包含 4 个演示场景：

1. **基础使用** - 读取复合片段列表
2. **详细信息** - 使用 `print_subdrafts_info()` 打印详细信息
3. **访问嵌套数据** - 深入访问嵌套草稿的各个字段
4. **编程分析** - 编程方式统计和分析复合片段

**运行演示**:
```bash
python demo_subdrafts.py
```

## 使用场景

1. **复合片段分析**: 读取并分析草稿中的复合片段结构
2. **素材统计**: 统计复合片段中的视频、音频、文本等素材数量
3. **时长计算**: 获取复合片段的总时长和平均时长
4. **轨道检查**: 检查复合片段中的轨道类型和数量
5. **嵌套草稿处理**: 访问复合片段内部的完整草稿数据

## 兼容性

- ✅ 支持剪映 5.x 版本草稿
- ⚠️ 剪映 6+ 版本草稿文件已加密，无法直接读取

## 文件清单

### 修改的文件

1. **`pyJianYingDraft/script_file.py`** (line 777-856)
   - 新增 `read_subdrafts()` 方法
   - 新增 `print_subdrafts_info()` 方法

### 新增的文件

1. **`test_subdrafts.py`** - 自动化测试套件（8个测试用例）
2. **`demo_subdrafts.py`** - 功能演示脚本（4个演示场景）
3. **`SUBDRAFTS_FEATURE.md`** - 本功能说明文档

## 代码质量

### 遵循的设计原则

- ✅ **KISS**: 简洁的 API 设计，易于理解和使用
- ✅ **DRY**: 复用现有的 `imported_materials` 数据结构
- ✅ **YAGNI**: 只实现必要的功能，不过度设计
- ✅ **单一职责**: 每个方法职责明确
- ✅ **文档完整**: 详细的 docstring 和使用示例

### 代码规范

- ✅ 类型注解完整
- ✅ 文档字符串符合项目规范
- ✅ 命名遵循 PEP 8
- ✅ 错误处理健壮
- ✅ 测试覆盖充分

## 未来扩展

可能的扩展方向：

1. **复合片段创建**: 支持创建新的复合片段
2. **复合片段修改**: 修改现有复合片段的属性
3. **复合片段导出**: 将复合片段导出为独立草稿
4. **复合片段导入**: 从独立草稿导入为复合片段
5. **深度分析工具**: 提供更多分析和统计功能

## 总结

本次更新为 pyJianYingDraft 添加了完整的复合片段读取功能，包括：

- 2 个新的公共方法
- 8 个自动化测试用例（全部通过）
- 4 个实用演示场景
- 完整的功能文档

所有代码遵循项目的编码规范和设计原则，具有良好的可维护性和扩展性。

---

**作者**: Claude
**日期**: 2025-10-17
**版本**: 1.0.0
