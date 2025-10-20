# 远程素材自动下载功能

## 概述

pyJianYingDraft 现在支持自动下载远程素材(HTTP/HTTPS URL),并在保存草稿时自动将路径转换为剪映可识别的本地路径格式。

### 主要特性

- ✅ **异步高并发下载** - 使用 aiohttp 实现,支持同时下载多个文件
- ✅ **自动重试机制** - 使用 aiohttp-retry,失败自动重试(指数退避)
- ✅ **代理支持** - 支持 HTTP/HTTPS 代理
- ✅ **智能降级** - 未安装 aiohttp 时自动降级为同步下载
- ✅ **路径自动转换** - 自动转换为剪映格式: `##_draftpath_placeholder_##\{draftId}\{filename}`
- ✅ **并发控制** - 可自定义最大并发数,避免触发服务器限制
- ✅ **进度追踪** - 实时显示下载进度和统计信息

## 安装

### 基础安装

```bash
pip install pyJianYingDraft
```

### 启用异步高并发下载(推荐)

```bash
pip install aiohttp aiohttp-retry
```

> 注意: 如果不安装 aiohttp,将自动降级为同步下载模式(仍然可用,但速度较慢)

## 快速开始

### 方式1: 使用 ScriptFile 的 save/dump 方法(推荐)

最简单的用法 - 在保存草稿时自动下载:

```python
import pyJianYingDraft as draft

# 创建或加载草稿
script = draft.DraftFolder("草稿路径").load_template("模板名称")

# 添加远程素材
script.imported_materials["videos"] = [
    {
        "id": "remote-video-1",
        "path": "https://example.com/video.mp4",  # 远程URL
        "material_name": "远程视频",
        "duration": 5000000,
        "width": 1920,
        "height": 1080,
        "material_type": "video"
    }
]

# 保存时自动下载 - 就这么简单!
script.save()  # 默认启用远程下载

# 或者使用 dump 方法
script.dump("path/to/draft_content.json")
```

### 方式2: 使用高级参数

自定义下载行为:

```python
# 使用代理下载
script.save(
    download_remote=True,
    proxy="http://127.0.0.1:7890",  # 使用代理
    max_concurrent=50,               # 最大并发数
    download_verbose=True            # 显示详细日志
)

# 禁用自动下载(保持远程URL)
script.save(download_remote=False)

# dump 方法也支持相同参数
script.dump(
    "draft_content.json",
    download_remote=True,
    proxy="http://127.0.0.1:7890"
)
```

### 方式3: 直接使用下载模块

如果需要更精细的控制:

```python
from pyJianYingDraft.remote_downloader import download_remote_materials

# 准备素材数据
materials = {
    "videos": [
        {
            "id": "video-1",
            "path": "https://example.com/video1.mp4",
            # ... 其他字段
        }
    ],
    "audios": [
        {
            "id": "audio-1",
            "path": "https://example.com/audio1.mp3",
            # ... 其他字段
        }
    ]
}

# 一行代码下载所有素材
success_count, failed_count = download_remote_materials(
    materials=materials,
    draft_id="YOUR-DRAFT-ID",
    draft_dir="/path/to/draft/directory",
    max_concurrent=50,
    proxy="http://127.0.0.1:7890",  # 可选
    verbose=True
)

print(f"下载完成: 成功 {success_count}, 失败 {failed_count}")
```

### 方式4: 使用下载器类(最灵活)

需要高级功能时:

```python
from pyJianYingDraft.remote_downloader import RemoteMaterialDownloader

# 创建下载器实例
downloader = RemoteMaterialDownloader(
    max_concurrent=50,      # 最大并发数
    retry_attempts=3,       # 重试次数
    timeout=30,             # 超时时间(秒)
    proxy="http://127.0.0.1:7890",  # 代理
    verbose=True            # 详细日志
)

# 下载素材
success, failed = downloader.download_materials(
    materials=script.content["materials"],
    draft_id=script.content["id"],
    draft_dir="/path/to/draft"
)

# 检查失败的URL
if downloader.failed_urls:
    print("以下URL下载失败:")
    for url in downloader.failed_urls:
        print(f"  - {url}")
```

## 配置参数说明

### save() / dump() 方法参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `download_remote` | bool | True | 是否下载远程素材 |
| `max_concurrent` | int | 50 | 最大并发下载数 |
| `proxy` | str | None | HTTP代理地址,如 `"http://127.0.0.1:7890"` |
| `download_verbose` | bool | True | 是否显示下载详细日志 |

### RemoteMaterialDownloader 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_concurrent` | int | 50 | 最大并发下载数,避免触发服务器限制 |
| `retry_attempts` | int | 3 | 失败重试次数 |
| `timeout` | int | 30 | 单个下载超时时间(秒) |
| `proxy` | str | None | HTTP/HTTPS代理地址 |
| `verbose` | bool | True | 是否显示详细日志 |

## 实际案例

### 案例1: 从API获取视频并创建草稿

```python
import requests
import pyJianYingDraft as draft

# 从API获取视频列表
response = requests.get("https://api.example.com/videos")
videos = response.json()

# 创建草稿
folder = draft.DraftFolder("D:/JianyingPro/Drafts")
script = folder.create_draft("API视频合集", 1920, 1080)

# 添加视频轨道
script.add_track(draft.TrackType.video)

# 添加远程视频
for i, video_data in enumerate(videos):
    video_material = draft.VideoMaterial(
        path=video_data["url"],  # 远程URL
        material_name=video_data["title"]
    )

    segment = draft.VideoSegment(
        video_material,
        draft.trange(f"{i*5}s", "5s")  # 每个视频5秒
    )

    script.add_segment(segment)

# 保存并自动下载所有远程视频
script.dump("draft_content.json", proxy="http://127.0.0.1:7890")
```

### 案例2: 批量处理模板

```python
import pyJianYingDraft as draft

# 加载模板
folder = draft.DraftFolder("D:/JianyingPro/Drafts")
template = folder.load_template("模板草稿")

# 批量替换远程素材
remote_videos = [
    "https://cdn.example.com/video1.mp4",
    "https://cdn.example.com/video2.mp4",
    "https://cdn.example.com/video3.mp4"
]

# 获取视频轨道
video_track = template.get_imported_track(draft.TrackType.video, index=0)

# 替换每个片段的素材为远程URL
for i, url in enumerate(remote_videos):
    video = draft.VideoMaterial(url)
    template.replace_material_by_seg(video_track, i, video)

# 保存 - 自动下载所有远程视频
template.save(
    max_concurrent=10,  # 限制并发避免触发CDN限制
    proxy="http://127.0.0.1:7890"
)
```

### 案例3: 使用Web服务器集成

```python
from flask import Flask, request, jsonify
from pyJianYingDraft.remote_downloader import download_remote_materials
import json

app = Flask(__name__)

@app.route('/create_draft', methods=['POST'])
def create_draft():
    data = request.json

    # 创建草稿
    script = ScriptFile(1920, 1080)

    # 添加远程素材
    script.imported_materials["videos"] = data["videos"]

    # 保存到临时目录
    draft_path = f"/tmp/draft_{data['id']}/draft_content.json"
    os.makedirs(os.path.dirname(draft_path), exist_ok=True)

    # 异步下载并保存
    script.dump(
        draft_path,
        max_concurrent=20,
        proxy=None,  # Web服务器通常不需要代理
        download_verbose=False  # 生产环境禁用详细日志
    )

    return jsonify({"status": "success", "path": draft_path})

if __name__ == '__main__':
    app.run()
```

## 工作原理

### 1. 路径识别

系统会扫描所有素材的 `path` 字段,识别以 `http://` 或 `https://` 开头的URL。

### 2. 并发下载

- 使用 aiohttp 创建异步任务池
- 根据 `max_concurrent` 参数控制并发数
- 使用 aiohttp-retry 实现自动重试(指数退避策略)

### 3. 文件命名

- 优先使用URL中的原始文件名
- 如果无法解析,根据URL内容猜测扩展名
- 最后降级为 UUID + 默认扩展名

### 4. 路径转换

下载完成后,将路径从:
```
https://example.com/video.mp4
```

转换为剪映格式:
```
##_draftpath_placeholder_0E685133-18CE-45ED-8CB8-2904A212EC80_##\{draftId}\video.mp4
```

### 5. 保存草稿

最后将更新后的素材信息写入 `draft_content.json`。

## 性能优化建议

### 1. 合理设置并发数

```python
# 小文件(图片) - 可以使用较高并发
script.save(max_concurrent=100)

# 大文件(视频) - 建议降低并发
script.save(max_concurrent=10)

# 有速率限制的服务器
script.save(max_concurrent=5)
```

### 2. 使用代理加速

```python
# 国外资源使用代理
script.save(proxy="http://127.0.0.1:7890")

# 国内资源不使用代理
script.save(proxy=None)
```

### 3. 生产环境建议

```python
# 禁用详细日志减少I/O
script.save(download_verbose=False)

# 使用自定义日志
from pyJianYingDraft.remote_downloader import RemoteMaterialDownloader

downloader = RemoteMaterialDownloader(verbose=False)
# 实现自己的日志逻辑
```

## 故障排除

### 问题1: 下载速度慢

**解决方案:**
- 安装 aiohttp: `pip install aiohttp aiohttp-retry`
- 增加并发数: `max_concurrent=100`
- 使用代理加速国外资源

### 问题2: 部分文件下载失败

**解决方案:**
```python
from pyJianYingDraft.remote_downloader import RemoteMaterialDownloader

downloader = RemoteMaterialDownloader(
    retry_attempts=5,  # 增加重试次数
    timeout=60         # 增加超时时间
)

success, failed = downloader.download_materials(...)

# 检查失败的URL
if downloader.failed_urls:
    print("失败的URL:", downloader.failed_urls)
```

### 问题3: 代理不生效

**检查代理格式:**
```python
# 正确格式
proxy="http://127.0.0.1:7890"

# 错误格式
proxy="127.0.0.1:7890"  # 缺少协议
proxy="socks5://127.0.0.1:7890"  # aiohttp 不支持 socks5
```

### 问题4: 文件名乱码或重复

文件名从URL自动提取,如果遇到问题,系统会生成UUID文件名。这不影响剪映使用。

### 问题5: 剪映无法识别素材

确保:
1. 文件已成功下载到 `{draft_dir}/{draft_id}/` 目录
2. 路径格式正确: `##_draftpath_placeholder_##\{draftId}\{filename}`
3. 文件扩展名正确

## 依赖库说明

| 库 | 版本要求 | 说明 | 是否必需 |
|---|---------|------|---------|
| aiohttp | ≥3.8.0 | 异步HTTP客户端 | 推荐 |
| aiohttp-retry | ≥2.8.0 | aiohttp重试封装 | 推荐 |

> 如果不安装 aiohttp,系统会自动降级为使用 Python 内置的 `urllib` 进行同步下载。

## API 参考

完整的API文档请参考源代码注释:
- `pyJianYingDraft/remote_downloader.py` - 下载模块
- `pyJianYingDraft/script_file.py` - ScriptFile 类的 save/dump 方法

## 贡献

欢迎提交 Issue 和 Pull Request!

## 许可证

与 pyJianYingDraft 主项目保持一致。
