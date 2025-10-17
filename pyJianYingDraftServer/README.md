# pyJianYingDraftServer

基于 FastAPI 的剪映草稿文件解析 API 服务，提供便捷的 REST API 接口来解析和操作剪映(JianyingPro)草稿文件。

## 功能特性

### 1. 草稿基础信息 (`/api/draft`)
- `GET /api/draft/info` - 获取草稿文件基础信息（分辨率、帧率、时长、轨道等）
- `GET /api/draft/validate` - 验证草稿文件是否有效

### 2. 复合片段操作 (`/api/subdrafts`)
- `GET /api/subdrafts/list` - 获取所有复合片段列表
- `GET /api/subdrafts/{index}` - 获取指定索引的复合片段详细信息
- `GET /api/subdrafts/{index}/tracks` - 获取复合片段中的轨道信息
- `GET /api/subdrafts/{index}/materials` - 获取复合片段中的素材统计

### 3. 素材管理 (`/api/materials`)
- `GET /api/materials/all` - 获取所有素材信息
- `GET /api/materials/type/{type}` - 根据类型获取素材
- `GET /api/materials/videos` - 获取所有视频素材
- `GET /api/materials/audios` - 获取所有音频素材
- `GET /api/materials/texts` - 获取所有文本素材
- `GET /api/materials/statistics` - 获取素材统计信息

### 4. 轨道管理 (`/api/tracks`)
- `GET /api/tracks/type/{type}` - 根据类型获取轨道列表
- `GET /api/tracks/video` - 获取所有视频轨道
- `GET /api/tracks/audio` - 获取所有音频轨道
- `GET /api/tracks/text` - 获取所有文本轨道
- `GET /api/tracks/statistics` - 获取轨道统计信息

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 安装 pyJianYingDraft（假设在同级目录）
cd ../pyJianYingDraft
pip install -e .
cd ../pyJianYingDraftServer
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问 API 文档

启动服务后，访问以下地址查看交互式 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 使用示例

### Python 客户端示例

```python
import requests

# 基础URL
BASE_URL = "http://localhost:8000"

# 草稿文件路径
draft_path = r"D:\JianyingPro Drafts\your_draft\draft_content.json"

# 1. 获取草稿基础信息
response = requests.get(f"{BASE_URL}/api/draft/info", params={"file_path": draft_path})
draft_info = response.json()
print(f"草稿分辨率: {draft_info['width']}x{draft_info['height']}")
print(f"总时长: {draft_info['duration_seconds']}秒")
print(f"轨道数: {draft_info['track_count']}")

# 2. 获取复合片段列表
response = requests.get(f"{BASE_URL}/api/subdrafts/list", params={"file_path": draft_path})
subdrafts = response.json()
for i, subdraft in enumerate(subdrafts):
    print(f"复合片段 {i}: {subdraft['name']}")
    print(f"  时长: {subdraft['draft_info']['duration_seconds']}秒")

# 3. 获取素材统计
response = requests.get(f"{BASE_URL}/api/materials/statistics", params={"file_path": draft_path})
stats = response.json()
print(f"素材总数: {stats['total_count']}")
print(f"各类型素材: {stats['by_type']}")

# 4. 获取视频轨道
response = requests.get(f"{BASE_URL}/api/tracks/video", params={"file_path": draft_path})
video_tracks = response.json()
for track in video_tracks:
    print(f"视频轨道: {track['name']}, 片段数: {track['segment_count']}")
```

### cURL 示例

```bash
# 获取草稿信息
curl -X GET "http://localhost:8000/api/draft/info?file_path=D:/path/to/draft_content.json"

# 获取复合片段列表
curl -X GET "http://localhost:8000/api/subdrafts/list?file_path=D:/path/to/draft_content.json"

# 获取视频素材
curl -X GET "http://localhost:8000/api/materials/videos?file_path=D:/path/to/draft_content.json"
```

### JavaScript 示例

```javascript
const BASE_URL = 'http://localhost:8000';
const draftPath = 'D:/JianyingPro Drafts/your_draft/draft_content.json';

// 获取草稿信息
async function getDraftInfo() {
    const response = await fetch(
        `${BASE_URL}/api/draft/info?file_path=${encodeURIComponent(draftPath)}`
    );
    const data = await response.json();
    console.log('草稿信息:', data);
}

// 获取复合片段
async function getSubdrafts() {
    const response = await fetch(
        `${BASE_URL}/api/subdrafts/list?file_path=${encodeURIComponent(draftPath)}`
    );
    const data = await response.json();
    console.log('复合片段:', data);
}

getDraftInfo();
getSubdrafts();
```

## 项目结构

```
pyJianYingDraftServer/
├── app/
│   ├── __init__.py           # 应用初始化
│   ├── main.py               # FastAPI 主应用
│   ├── models/               # 数据模型
│   │   ├── __init__.py
│   │   └── draft_models.py   # 草稿相关模型
│   ├── routers/              # API 路由
│   │   ├── __init__.py
│   │   ├── draft.py          # 草稿基础路由
│   │   ├── subdrafts.py      # 复合片段路由
│   │   ├── materials.py      # 素材管理路由
│   │   └── tracks.py         # 轨道管理路由
│   └── services/             # 业务逻辑
│       ├── __init__.py
│       └── draft_service.py  # 草稿解析服务
├── requirements.txt          # Python 依赖
├── .gitignore               # Git 忽略文件
└── README.md                # 项目文档
```

## 数据模型

### DraftInfo - 草稿信息
```json
{
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 60000000,
  "duration_seconds": 60.0,
  "track_count": 5,
  "tracks": [...]
}
```

### SubdraftInfo - 复合片段信息
```json
{
  "id": "...",
  "name": "复合片段名称",
  "type": "compound_clip",
  "combination_id": "...",
  "draft_info": {...},
  "material_stats": {
    "videos": 2,
    "audios": 1,
    "texts": 3
  }
}
```

### TrackInfo - 轨道信息
```json
{
  "id": "...",
  "name": "video_track",
  "type": "video",
  "render_index": 0,
  "segment_count": 5,
  "segments": [...]
}
```

### SegmentInfo - 片段信息
```json
{
  "id": "...",
  "material_id": "...",
  "target_timerange": {
    "start": 0,
    "duration": 5000000,
    "start_seconds": 0.0,
    "duration_seconds": 5.0
  },
  "speed": 1.0,
  "volume": 0.8
}
```

## 开发说明

### 添加新的路由

1. 在 `app/routers/` 目录下创建新的路由文件
2. 在路由文件中定义 APIRouter 和相关端点
3. 在 `app/main.py` 中导入并注册路由

示例：
```python
# app/routers/custom.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/custom")
async def custom_endpoint():
    return {"message": "Custom endpoint"}

# app/main.py
from app.routers import custom
app.include_router(custom.router, prefix="/api/custom", tags=["自定义"])
```

### 扩展服务层

在 `app/services/draft_service.py` 中添加新的静态方法来实现业务逻辑。

## 注意事项

1. **文件路径**: 所有 API 都需要提供 `file_path` 参数，应为 `draft_content.json` 文件的绝对路径
2. **时间单位**: 时间在内部以微秒为单位，API 响应中同时提供微秒和秒两种格式
3. **错误处理**: API 会返回适当的 HTTP 状态码和错误信息
4. **CORS**: 服务器默认允许所有来源的跨域请求，生产环境中应适当限制

## 技术栈

- **FastAPI** - 现代、快速的 Web 框架
- **Pydantic** - 数据验证和设置管理
- **Uvicorn** - ASGI 服务器
- **pyJianYingDraft** - 剪映草稿文件解析库

## 许可证

与 pyJianYingDraft 保持一致

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关项目

- [pyJianYingDraft](https://github.com/yourusername/pyJianYingDraft) - 剪映草稿文件 Python 库
