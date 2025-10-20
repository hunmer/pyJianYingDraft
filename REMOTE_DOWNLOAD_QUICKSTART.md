# 远程素材自动下载 - 快速开始

## 最简使用

```python
import pyJianYingDraft as draft

# 加载草稿
script = draft.DraftFolder("草稿路径").load_template("模板名称")

# 添加远程素材
script.imported_materials["videos"] = [
    {
        "id": "video-1",
        "path": "https://example.com/video.mp4",  # 远程URL
        "material_name": "视频",
        "duration": 5000000,
        "width": 1920,
        "height": 1080,
        "material_type": "video"
    }
]

# 保存 - 自动下载远程素材!
script.save()
```

## 使用代理

```python
# 使用HTTP代理下载
script.save(proxy="http://127.0.0.1:7890")
```

## 高并发下载

```python
# 同时下载50个文件(需要安装 aiohttp)
script.save(max_concurrent=50)
```

## 安装依赖(可选,但强烈推荐)

```bash
pip install aiohttp aiohttp-retry
```

## 工作原理

1. **自动识别**: 扫描所有 `path` 字段,找出 `http://` 或 `https://` 开头的URL
2. **并发下载**: 使用 aiohttp 异步下载所有远程文件到 `{草稿目录}/{草稿ID}/`
3. **路径转换**: 自动将URL转换为剪映格式: `##_draftpath_placeholder_##\{草稿ID}\{文件名}`
4. **保存草稿**: 将更新后的素材信息写入 draft_content.json

## 完整文档

详细文档请查看: [REMOTE_DOWNLOAD_README.md](./REMOTE_DOWNLOAD_README.md)
