# 图标文件说明

## 需要添加的图标

在此目录下添加名为 `jianyingdraft.svg` 的图标文件。

### 图标要求

- **格式**: SVG
- **尺寸**: 60x60 像素
- **颜色**: 单色或简单的双色设计
- **命名**: `jianyingdraft.svg`

### 图标使用

所有节点都引用了此图标:
```typescript
icon: 'file:jianyingdraft.svg'
```

如果暂时没有图标,可以:
1. 使用 n8n 内置图标,修改节点的 `icon` 属性为 `'fa:video'` 等
2. 创建一个简单的 SVG 图标
3. 从网上下载符合要求的图标并重命名

### 示例 SVG 图标

创建一个简单的剪映图标示例:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
  <rect width="60" height="60" rx="8" fill="#00C9FF"/>
  <path d="M20 15 L40 30 L20 45 Z" fill="white"/>
</svg>
```

将以上内容保存为 `jianyingdraft.svg` 即可。
