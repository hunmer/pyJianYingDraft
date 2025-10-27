# 平台特定模板说明

## 概述

`pyJianYingDraft` 现在支持根据不同操作系统自动选择合适的草稿内容模板文件。

## 实现方式

在 `pyJianYingDraft/assets/__init__.py` 中,使用 `platform.system()` 检测当前运行的操作系统:

- **macOS (Darwin)**: 使用 `draft_content_template_macos.json`
- **Windows / Linux**: 使用 `draft_content_template.json`

## 模板文件位置

```
pyJianYingDraft/assets/
├── draft_content_template.json        # Windows/Linux 模板
├── draft_content_template_macos.json  # macOS 模板
└── draft_meta_info.json               # 元数据模板(通用)
```

## 使用方法

无需手动干预,系统会自动选择正确的模板:

```python
from pyJianYingDraft.assets import get_asset_path

# 自动根据系统选择对应的模板文件
template_path = get_asset_path('DRAFT_CONTENT_TEMPLATE')
```

## 测试验证

在 macOS 系统上:
```bash
python3 -c "
from pyJianYingDraft.assets import ASSET_FILES
print(ASSET_FILES['DRAFT_CONTENT_TEMPLATE'])
"
# 输出: draft_content_template_macos.json
```

在 Windows/Linux 系统上:
```bash
python -c "
from pyJianYingDraft.assets import ASSET_FILES
print(ASSET_FILES['DRAFT_CONTENT_TEMPLATE'])
"
# 输出: draft_content_template.json
```

## 为什么需要不同的模板?

不同操作系统上的剪映可能有不同的:
- 文件路径格式
- 系统字体配置
- 默认设置参数

使用平台特定的模板可以确保生成的草稿文件在对应平台上的剪映中能够正确加载和渲染。
