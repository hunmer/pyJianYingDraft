# Subdrafts 快速入门

## 安装

确保已安装 pyJianYingDraft:

```bash
pip install pyJianYingDraft
```

## 快速开始

### 1. 读取复合片段

```python
import pyJianYingDraft as draft

# 加载草稿文件
script = draft.ScriptFile.load_template("path/to/draft_content.json")

# 获取所有复合片段
subdrafts = script.read_subdrafts()

# 检查是否有复合片段
if subdrafts:
    print(f"找到 {len(subdrafts)} 个复合片段")
else:
    print("没有复合片段")
```

### 2. 打印详细信息

```python
# 方法1: 使用便捷方法（推荐）
script.print_subdrafts_info()

# 方法2: 手动遍历
for idx, subdraft in enumerate(subdrafts, 1):
    print(f"\n复合片段 {idx}:")
    print(f"  名称: {subdraft.get('name', '(无名称)')}")
    print(f"  ID: {subdraft['id']}")
    print(f"  类型: {subdraft['type']}")
```

### 3. 访问嵌套草稿数据

```python
# 获取第一个复合片段的嵌套草稿
subdraft = subdrafts[0]
nested_draft = subdraft['draft']

# 访问基本信息
width = nested_draft['canvas_config']['width']
height = nested_draft['canvas_config']['height']
duration = nested_draft['duration'] / 1000000  # 转换为秒
fps = nested_draft['fps']

print(f"分辨率: {width}x{height}")
print(f"时长: {duration:.2f} 秒")
print(f"帧率: {fps} fps")

# 访问轨道
tracks = nested_draft['tracks']
print(f"轨道数: {len(tracks)}")

# 访问素材
materials = nested_draft['materials']
print(f"视频: {len(materials.get('videos', []))} 个")
print(f"音频: {len(materials.get('audios', []))} 个")
```

### 4. 统计分析

```python
# 统计所有复合片段的总时长
total_duration = sum(
    subdraft['draft']['duration']
    for subdraft in subdrafts
) / 1000000  # 转换为秒

print(f"总时长: {total_duration:.2f} 秒")

# 统计轨道类型分布
from collections import Counter

all_track_types = []
for subdraft in subdrafts:
    for track in subdraft['draft']['tracks']:
        all_track_types.append(track.get('type', 'unknown'))

track_stats = Counter(all_track_types)
print("\n轨道类型统计:")
for track_type, count in track_stats.items():
    print(f"  {track_type}: {count} 条")
```

## 完整示例

运行项目提供的演示脚本查看完整示例：

```bash
# 查看所有演示场景
python demo_subdrafts.py

# 运行自动化测试
python test_subdrafts.py
```

## 注意事项

1. **文件路径**: 确保草稿文件路径正确
2. **版本兼容**: 仅支持剪映 5.x 版本（6+ 版本文件已加密）
3. **空值处理**: 某些字段可能为空或不存在，使用 `.get()` 方法安全访问
4. **时间单位**: `duration` 字段单位是微秒，需除以 1000000 转换为秒

## 数据结构参考

```python
subdraft = {
    "id": "复合片段ID",
    "name": "复合片段名称",
    "type": "类型（通常是 combination）",
    "combination_id": "组合ID",
    "combination_type": "组合类型",
    "draft": {
        "canvas_config": {
            "width": 1920,
            "height": 1080,
            "ratio": "original"
        },
        "duration": 23133333,  # 微秒
        "fps": 30.0,
        "tracks": [...],  # 轨道列表
        "materials": {
            "videos": [...],
            "audios": [...],
            "texts": [...],
            # 更多素材类型...
        },
        # 更多字段...
    },
    # 更多字段...
}
```

## 获取帮助

- 查看详细文档: `SUBDRAFTS_FEATURE.md`
- 查看测试用例: `test_subdrafts.py`
- 查看完整演示: `demo_subdrafts.py`
- 项目主页: https://github.com/GuanYixuan/pyJianYingDraft
