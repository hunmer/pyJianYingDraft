# 入口与启动

## 包入口

`pyJianYingDraft/__init__.py`：
- 导入并 re-export 全部公开类/枚举/函数。
- 用 `ISWIN = (sys.platform == 'win32')` 条件导出 Windows 专属的 `JianyingController` 等。
- 定义 snake_case 旧别名（触发 `DeprecationWarning`）。
- 维护 `__all__`（基础列表 + Windows 附加项）。

## 使用入口

```python
import pyJianYingDraft as draft

folder = draft.DraftFolder(r"path/to/JianyingPro Drafts")
script = folder.create_draft("name", 1920, 1080)
script.add_track(draft.TrackType.video)
script.add_segment(draft.VideoSegment("video.mp4", draft.trange("0s", "5s")))
script.dump("path/to/draft_content.json")
```

模板模式：

```python
script = folder.duplicate_as_template("template_name", "new_draft")
script.replace_material_by_name(...)
script.replace_text(...)
script.save()
```

## 示例脚本（仓库根目录）

- `demo.py`：基本使用，需先改草稿文件夹路径。
- `demo_subdrafts.py`：复合片段示例。

## 无独立可执行入口

作为库被 `import`；由后端 `pyJianYingDraftServer` 通过 `sys.path` 引用，或用户脚本直接导入。
