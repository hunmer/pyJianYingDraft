# testData中animations字段使用说明

## 概述

testData的items现在支持可选的`animations`字段,用于为视频片段添加组合动画效果。

## 使用方法

在testData的items中添加animations字段:

```json
{
  "items": [
    {
      "data": {
        "duration": 4.824,
        "path": "https://s.coze.cn/t/jLXmN2tAs0U/",
        "start": 5,
        "track": "2",
        "animations": {
          "duration": 3,
          "name": "拉伸扭曲"
        }
      },
      "type": "image"
    }
  ]
}
```

## animations字段结构

```typescript
{
  "name"?: string,     // 可选: 动画名称(从pyJianYingDraft/metadata/video_group_animation.py获取)
  "duration"?: number  // 可选: 动画持续时长(秒)
}
```

### 三种使用模式

1. **指定name和duration - 创建新动画并替换**
   ```json
   "animations": {
     "name": "拉伸扭曲",
     "duration": 3
   }
   ```

2. **仅指定name - 创建新动画，使用片段时长**
   ```json
   "animations": {
     "name": "旋转上升"
   }
   ```
   动画duration会自动使用片段的duration

3. **仅指定duration - 修改现有动画的duration**
   ```json
   "animations": {
     "duration": 2.5
   }
   ```
   保持动画类型不变，只修改时长（要求segment已有动画）

## 可用的组合动画

从`pyJianYingDraft/metadata/video_group_animation.py`获取完整列表,部分常用动画包括:

### 免费动画
- 拉伸扭曲
- 扭曲拉伸
- 三分割
- 上下分割
- 左右分割
- 中间分割
- 旋转上升
- 旋转降落
- 缩放
- 翻转
- 叠叠乐
- 小火车
- 立方体
- 魔方
- 绕圈圈
- 过山车
- 海盗船
- 滑滑梯
- 荡秋千
- 悠悠球
- 小陀螺
- 哈哈镜
- 百叶窗
- 碎块滑动
- 四格滑动
- 四格翻转
- 四格转动
- 方片转动
- 手机
- 水晶
- 夹心饼干

### 付费动画(需要剪映会员)
- 分身
- 动感摇晃I
- 动感摇晃II
- 回忆旋转
- 坠落
- 弹动冲屏
- 波动吸收
- 波动放大
- 相框滑动
- 红酒摇晃
- 跳跳糖
- 闪光放大

## 注意事项

1. **至少指定一个字段**: name或duration至少要有一个
2. **动画名称大小写敏感**: 必须使用完全相同的名称(如"拉伸扭曲")
3. **duration单位**: 使用秒作为单位,会自动转换为微秒
4. **动画类型**: 目前仅支持组合动画(group animation),不支持入场/出场动画
5. **仅duration模式**: 只能修改已存在的动画，如果segment没有动画会警告并跳过
6. **仅name模式**: 会使用片段的完整时长作为动画duration
7. **动画替换**: 指定name会替换所有现有动画
8. **时间范围**: 动画从片段开始位置(start=0)播放,持续指定的duration

## 完整示例

### 示例1: 三种模式组合使用

```json
{
  "testData": {
    "tracks": [
      {
        "id": "2",
        "type": "video",
        "title": "视频轨道"
      }
    ],
    "items": [
      {
        "type": "image",
        "data": {
          "track": "2",
          "start": 0,
          "duration": 5,
          "path": "/path/to/image.jpg",
          "scale": 1.2,
          "x": 0,
          "y": 0,
          "animations": {
            "name": "拉伸扭曲",
            "duration": 3
          }
        }
      },
      {
        "type": "video",
        "data": {
          "track": "2",
          "start": 5,
          "duration": 4,
          "path": "/path/to/video.mp4",
          "animations": {
            "name": "旋转上升"
          }
        }
      },
      {
        "type": "image",
        "data": {
          "track": "2",
          "start": 9,
          "duration": 3,
          "path": "/path/to/image2.jpg",
          "animations": {
            "duration": 2
          }
        }
      }
    ]
  }
}
```

**说明:**
- 第1个片段: 使用"拉伸扭曲"动画，持续3秒
- 第2个片段: 使用"旋转上升"动画，自动使用片段时长4秒
- 第3个片段: 保持原有动画类型，仅修改duration为2秒(需要在raw_segments中已有动画)

## 技术实现

- animations字段在`rule_test_service.py`的`_apply_item_data_to_segment`方法中处理
- 使用`GroupAnimationType.from_name()`查找动画元数据
- 创建`VideoAnimation`对象并添加到segment的`material_animations`数组中
- 动画数据最终导出到草稿JSON的`material_animations`字段

## 调试信息

启用后台日志可以看到动画处理的详细信息:

### 创建新动画(指定name)
```
[DEBUG]   - 创建组合动画: name=拉伸扭曲, duration=3000000us (3.0s)
```

### 自动使用片段时长
```
[DEBUG]   - 未指定duration，使用片段时长: 4000000us (4.0s)
[DEBUG]   - 创建组合动画: name=旋转上升, duration=4000000us (4.0s)
```

### 仅修改duration
```
[DEBUG]   - 修改动画duration: 2000000us (2.0s)
```

### 错误情况

动画名称不存在:
```
[WARNING] 未找到组合动画: 错误名称
[DEBUG] 可用的组合动画: ['三分割', '上下分割', '拉伸扭曲', ...]
```

没有现有动画却只指定duration:
```
[WARNING] segment没有现有动画，无法仅修改duration
```

两个字段都未指定:
```
[WARNING] animations字段必须至少包含name或duration
```
