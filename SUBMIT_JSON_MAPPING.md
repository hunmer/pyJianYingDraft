# Submit.json 提交文件映射关系说明

## 文档概述

本文档详细说明了规则测试系统中 `submit.json` 提交文件的数据结构和各字段之间的映射关系,帮助理解数据流转和关联逻辑。

---

## 1. 顶层结构

```json
{
  "draft_config": {},      // 草稿配置(画布大小、FPS等)
  "ruleGroup": {},         // 规则组定义
  "materials": [],         // 素材列表
  "testData": {},          // 测试数据(轨道和片段定义)
  "use_raw_segments": true,// 是否使用原始片段模式
  "raw_segments": [],      // 原始片段列表(模板数据)
  "raw_materials": [],     // 原始素材列表
  "segment_styles": {}     // 片段样式预设
}
```

---

## 2. 核心映射关系图

### 2.1 完整映射链路

```
raw_segments[].material_id
    ↓
ruleGroup.rules[].material_ids[]
    ↓
ruleGroup.rules[].type (规则类型)
    ↓
testData.items[].type (引用规则)
    ↓
testData.items[].data.track (轨道标识)
    ↓
testData.tracks[].id (轨道定义)
```

### 2.2 关键关联点

| 源字段 | 目标字段 | 关联方式 | 说明 |
|--------|---------|---------|------|
| `raw_segments[].material_id` | `ruleGroup.rules[].material_ids[]` | **material_id 匹配** | 通过素材ID关联原始片段和规则 |
| `ruleGroup.rules[].type` | `testData.items[].type` | **字符串相等** | 规则类型对应测试项类型 |
| `testData.items[].type` | `testData.items[].data.track` | **通常相等** | 测试项的轨道标识通常等于类型 |
| `testData.items[].data.track` | `testData.tracks[].id` | **字符串相等** | 轨道标识对应轨道定义 |

---

## 3. 数据结构详解

### 3.1 ruleGroup (规则组)

定义了素材的分类和用途。

```json
{
  "id": "group_1761613457275",
  "title": "书单",
  "rules": [
    {
      "type": "bg",                    // 规则类型(唯一标识)
      "title": "背景图片",              // 规则显示名称
      "material_ids": [                 // 关联的素材ID列表
        "463f1295-1646-4813-9509-4d4622115720"
      ]
    },
    {
      "type": "book_border1",
      "title": "",
      "material_ids": [
        "8afb6e67-ca00-4434-b637-ed41c989c192"
      ]
    }
    // ... 更多规则
  ]
}
```

**重要特性:**
- `rule.type` 是全局唯一标识符
- 一个 rule 可以关联多个 material_id
- `material_ids` 数组用于关联素材和规则

### 3.2 testData (测试数据)

定义了如何使用规则生成草稿。

#### 3.2.1 testData.tracks (轨道定义)

```json
{
  "tracks": [
    {
      "id": "book_border1",           // 轨道ID(字符串名称)
      "type": "video",                 // 轨道类型: video/audio/text/effect
      "title": "边框1",                // 轨道显示名称(可选)
      "relative_index": 10,            // 相对层级(可选)
      "absolute_index": null           // 绝对层级(可选)
    },
    {
      "id": "book_sound",
      "type": "audio",
      "title": "书本音效"
    }
    // ... 更多轨道
  ]
}
```

**注意事项:**
- `tracks[].id` 使用**字符串名称**(如 "book_border1"),不是UUID
- `tracks[].type` 必须是有效的轨道类型
- 轨道定义的数量 >= 实际使用的轨道数量

#### 3.2.2 testData.items (测试项)

```json
{
  "items": [
    {
      "type": "book_border1",         // 引用的规则类型
      "data": {
        "track": "book_border1",      // 目标轨道ID(通常等于type)
        "start": 0.0,                 // 开始时间(秒),可选
        "duration": 1.94,             // 持续时长(秒),可选
        "x": 0,                       // 位置X,可选
        "y": 0,                       // 位置Y,可选
        "scale": 1.0,                 // 缩放,可选
        "volume": 1.0,                // 音量,可选
        "speed": 1.0,                 // 速度,可选
        "text": "文本内容",            // 文本内容(仅文本片段),可选
        "animations": {               // 动画配置,可选
          "name": "翻书",
          "duration": 1.3
        }
      }
    }
    // ... 更多测试项
  ]
}
```

**重要特性:**
- `items[].type` 必须匹配某个 `ruleGroup.rules[].type`
- `items[].data.track` 必须匹配某个 `testData.tracks[].id`
- `items[].data` 中的时间、位置等属性都是**可选的**
- 未指定的属性会从 `raw_segments` 或 `segment_styles` 中获取默认值

### 3.3 raw_segments (原始片段列表)

提供片段的模板数据和默认值。

```json
{
  "raw_segments": [
    {
      "track_id": "3670a512-fb27-45ff-8b49-b5f02f9fe50c",  // UUID格式的轨道ID
      "track_type": "video",                                // 轨道类型
      "track_name": "",                                     // 轨道名称(通常为空)
      "material_id": "8afb6e67-ca00-4434-b637-ed41c989c192", // 素材ID
      "material_category": "videos",                        // 素材分类
      "segment": {                                          // 片段完整数据
        "id": "segment-uuid",
        "material_id": "8afb6e67-ca00-4434-b637-ed41c989c192",
        "target_timerange": {
          "start": 0,          // 开始时间(微秒)
          "duration": 1940000  // 持续时长(微秒)
        },
        "source_timerange": {
          "start": 0,
          "duration": 1940000
        },
        "clip": {              // 位置、缩放等设置
          "transform": {"x": 0, "y": 0},
          "scale": {"x": 1.0, "y": 1.0}
        },
        "volume": 1.0,
        "speed": 1.0,
        "extra_material_refs": []  // 额外素材引用(特效、动画等)
      },
      "material": {},          // 素材完整数据
      "extra_materials": {}    // 额外素材数据
    }
    // ... 更多原始片段
  ]
}
```

**关键特性:**
- `raw_segments[].track_id` 使用**UUID格式**,与 `testData.tracks[].id` **不同**
- `raw_segments[].material_id` 用于关联到 `ruleGroup.rules[].material_ids`
- `segment.target_timerange` 中的时间单位是**微秒**(1秒 = 1,000,000微秒)
- 同一个 `material_id` 可能对应多个 raw_segments

### 3.4 segment_styles (片段样式预设)

为不同素材和轨道提供样式预设。

```json
{
  "segment_styles": {
    "material-id-1": {                  // 素材ID
      "track-id-1": {                   // 轨道ID(或"__default__")
        "clip": {
          "transform": {"x": 100, "y": 50},
          "scale": {"x": 1.2, "y": 1.2}
        },
        "volume": 0.8,
        "speed": 1.0,
        "material_animations": [...],   // 动画数据
        "common_keyframes": [...]       // 关键帧数据
      },
      "__default__": {                  // 默认样式
        "volume": 1.0
      }
    }
  }
}
```

**优先级规则:**
1. `testData.items[].data` 中明确指定的值 **(最高优先级)**
2. `segment_styles[material_id][track_id]` 中的样式
3. `segment_styles[material_id]["__default__"]` 中的默认样式
4. `raw_segments` 中的模板值 **(最低优先级)**

---

## 4. 数据流转详解

### 4.1 规则引擎处理流程

```
1. 加载 ruleGroup.rules
   ↓
2. 解析 testData.items
   ↓ (通过 item.type 匹配 rule.type)
3. 获取 rule.material_ids
   ↓
4. 从 materials 列表中找到对应素材
   ↓
5. 创建 plans (执行计划)
   {
     track_id: item.data.track,
     material: material对象,
     item: item.data
   }
```

### 4.2 use_raw_segments 模式流程

当 `use_raw_segments: true` 时:

```
1. 构建原始草稿
   - 使用 raw_segments 创建所有轨道和片段
   ↓
2. 注入默认值 (_inject_raw_segment_defaults)
   - 通过 material_id 匹配 raw_segments 和 plans
   - 将 raw_segments 的 start/duration 注入到 item.data
   ↓
3. 合并测试数据 (_merge_raw_segments_with_test_data)
   - 清空原始轨道
   - 根据 plans 重新创建片段
   - 应用 segment_styles 预设
   - 应用 item.data 覆盖
   ↓
4. 生成最终草稿
```

### 4.3 material_id 匹配逻辑

这是最关键的关联逻辑:

```python
# 步骤1: 建立 material_id 到 rule.type 的映射
material_to_rule = {}
for rule in ruleGroup.rules:
    for mat_id in rule.material_ids:
        material_to_rule[mat_id] = rule.type

# 步骤2: 按 material_id 分组 raw_segments
raw_segments_by_material = {}
for raw_seg in raw_segments:
    material_id = raw_seg.material_id
    raw_segments_by_material[material_id].append(raw_seg)

# 步骤3: 为每个 plan 匹配对应的 raw_segment
for plan in plans:
    material_id = plan.material.id
    raw_segs = raw_segments_by_material[material_id]

    # 从对应的 raw_segment 中提取默认值
    raw_seg = raw_segs[index]
    if "start" not in plan.item.data:
        plan.item.data["start"] = raw_seg.segment.target_timerange.start / 1_000_000
```

---

## 5. 常见问题和陷阱

### 5.1 track_id 的两种格式

⚠️ **最常见的错误!**

- `testData.tracks[].id`: 字符串名称,如 `"book_border1"`
- `raw_segments[].track_id`: UUID格式,如 `"3670a512-fb27-45ff-8b49-b5f02f9fe50c"`

**不能直接通过 track_id 匹配!** 必须通过 `material_id` 关联。

### 5.2 时间单位转换

- `testData.items[].data.start/duration`: **秒** (浮点数)
- `raw_segments[].segment.target_timerange.start/duration`: **微秒** (整数)

转换公式:
```python
秒 = 微秒 / 1_000_000
微秒 = 秒 * 1_000_000
```

### 5.3 material_ids 是数组

一个 rule 可能关联多个素材:

```json
{
  "type": "book_group",
  "material_ids": [
    "book-1-id",
    "book-2-id",
    "book-3-id"
  ]
}
```

处理时需要遍历整个数组。

### 5.4 同一 material_id 的多个 segments

某些场景下,同一个素材可能在草稿中出现多次:

```json
raw_segments: [
  { "material_id": "same-id", "target_timerange": {"start": 0, ...} },
  { "material_id": "same-id", "target_timerange": {"start": 5000000, ...} }
]
```

需要维护指针按顺序匹配。

---

## 6. 实战示例

### 6.1 完整映射示例

假设有以下数据:

```json
// ruleGroup
{
  "rules": [
    {
      "type": "book_border1",
      "material_ids": ["8afb6e67-ca00-4434-b637-ed41c989c192"]
    }
  ]
}

// testData
{
  "tracks": [
    {"id": "book_border1", "type": "video"}
  ],
  "items": [
    {
      "type": "book_border1",
      "data": {
        "track": "book_border1"
        // 注意: 没有指定 start 和 duration!
      }
    }
  ]
}

// raw_segments
[
  {
    "track_id": "3670a512-fb27-45ff-8b49-b5f02f9fe50c",
    "material_id": "8afb6e67-ca00-4434-b637-ed41c989c192",
    "segment": {
      "target_timerange": {
        "start": 0,
        "duration": 1940000  // 1.94秒
      }
    }
  }
]
```

**映射流程:**

1. 通过 `item.type = "book_border1"` 找到对应的 rule
2. 获取 `rule.material_ids = ["8afb6e67..."]`
3. 从 materials 中找到该素材,创建 plan
4. 在 `_inject_raw_segment_defaults` 中:
   - 通过 `plan.material.id = "8afb6e67..."`
   - 找到对应的 `raw_segment` (material_id 匹配)
   - 提取 `start = 0`, `duration = 1.94`
   - 注入到 `plan.item.data`
5. 最终生成的片段:
   - 轨道: "book_border1" (video类型)
   - 开始: 0秒
   - 时长: 1.94秒

### 6.2 覆盖默认值示例

如果 `testData.items[].data` 指定了值:

```json
{
  "type": "book_border1",
  "data": {
    "track": "book_border1",
    "start": 2.5,        // 明确指定
    "duration": 3.0      // 明确指定
  }
}
```

则会忽略 `raw_segments` 中的默认值,使用 2.5秒 和 3.0秒。

---

## 7. 代码参考

相关代码位置:

- **主流程**: [rule_test_service.py:43-114](d:\programming\pyJianYingDraft\pyJianYingDraftServer\app\services\rule_test_service.py#L43-L114) (`run_test` 方法)
- **构建执行计划**: [rule_test_service.py:208-234](d:\programming\pyJianYingDraft\pyJianYingDraftServer\app\services\rule_test_service.py#L208-L234) (`_build_segment_plans`)
- **注入默认值**: [rule_test_service.py:904-978](d:\programming\pyJianYingDraft\pyJianYingDraftServer\app\services\rule_test_service.py#L904-L978) (`_inject_raw_segment_defaults`)
- **合并数据**: [rule_test_service.py:980-1077](d:\programming\pyJianYingDraft\pyJianYingDraftServer\app\services\rule_test_service.py#L980-L1077) (`_merge_raw_segments_with_test_data`)

---

## 8. 总结

### 核心要点

1. **material_id 是关键**: 所有关联都通过 material_id 实现
2. **track_id 有两种格式**: testData用字符串,raw_segments用UUID
3. **时间单位要转换**: 秒 ↔ 微秒
4. **优先级要清楚**: item.data > segment_styles > raw_segments
5. **可选字段很多**: 大部分字段都可以不指定,使用默认值

### 最佳实践

- ✅ 使用 `material_id` 匹配,不要使用 `track_id`
- ✅ 始终检查字段是否存在再读取
- ✅ 时间转换要注意单位
- ✅ 理解数据优先级,避免覆盖意外
- ✅ 同一 material_id 可能有多个 segments,需要维护指针

---

**文档版本**: 1.0
**最后更新**: 2025-10-28
**相关代码**: pyJianYingDraftServer/app/services/rule_test_service.py
