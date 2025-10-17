# pyJianYingDraftServer 项目结构

## 目录结构

```
pyJianYingDraftServer/
│
├── app/                              # 主应用目录
│   ├── __init__.py                   # 应用包初始化
│   ├── main.py                       # FastAPI 应用入口，路由注册
│   │
│   ├── models/                       # 数据模型（Pydantic）
│   │   ├── __init__.py
│   │   └── draft_models.py          # 草稿相关数据模型定义
│   │
│   ├── routers/                      # API 路由模块
│   │   ├── __init__.py
│   │   ├── draft.py                 # 草稿基础操作路由
│   │   ├── subdrafts.py             # 复合片段操作路由
│   │   ├── materials.py             # 素材管理路由
│   │   └── tracks.py                # 轨道管理路由
│   │
│   └── services/                     # 业务逻辑层
│       ├── __init__.py
│       └── draft_service.py         # 草稿解析服务（核心业务逻辑）
│
├── requirements.txt                  # Python 依赖列表
├── .gitignore                       # Git 忽略文件配置
├── README.md                        # 项目说明文档
├── PROJECT_STRUCTURE.md             # 项目结构说明（本文件）
├── run.py                           # Python 启动脚本
├── run.bat                          # Windows 批处理启动脚本
└── example_client.py                # API 使用示例客户端
```

## 模块职责

### app/main.py
- FastAPI 应用实例创建
- CORS 中间件配置
- 路由注册
- 根路径和健康检查端点

### app/models/draft_models.py
数据模型定义（使用 Pydantic）：
- `TimerangeInfo`: 时间范围信息
- `SegmentInfo`: 片段基础信息
- `TrackInfo`: 轨道基础信息
- `MaterialInfo`: 素材基础信息
- `DraftInfo`: 草稿文件基础信息
- `SubdraftInfo`: 复合片段信息

### app/services/draft_service.py
核心业务逻辑服务类 `DraftService`：
- `load_draft()`: 加载草稿文件
- `get_draft_info()`: 获取草稿基础信息
- `get_subdrafts()`: 获取复合片段列表
- `get_materials()`: 获取素材信息
- `get_tracks_by_type()`: 根据类型获取轨道

### app/routers/

#### draft.py - 草稿基础路由
- `GET /api/draft/info`: 获取草稿基础信息
- `GET /api/draft/validate`: 验证草稿文件

#### subdrafts.py - 复合片段路由
- `GET /api/subdrafts/list`: 获取所有复合片段
- `GET /api/subdrafts/{index}`: 获取指定复合片段
- `GET /api/subdrafts/{index}/tracks`: 获取复合片段轨道
- `GET /api/subdrafts/{index}/materials`: 获取复合片段素材统计

#### materials.py - 素材管理路由
- `GET /api/materials/all`: 获取所有素材
- `GET /api/materials/type/{type}`: 根据类型获取素材
- `GET /api/materials/videos`: 获取视频素材
- `GET /api/materials/audios`: 获取音频素材
- `GET /api/materials/texts`: 获取文本素材
- `GET /api/materials/statistics`: 获取素材统计

#### tracks.py - 轨道管理路由
- `GET /api/tracks/type/{type}`: 根据类型获取轨道
- `GET /api/tracks/video`: 获取视频轨道
- `GET /api/tracks/audio`: 获取音频轨道
- `GET /api/tracks/text`: 获取文本轨道
- `GET /api/tracks/statistics`: 获取轨道统计

## 架构设计原则

### 1. 分层架构
- **路由层 (Routers)**: 处理 HTTP 请求和响应
- **服务层 (Services)**: 实现业务逻辑
- **模型层 (Models)**: 数据验证和序列化

### 2. 单一职责
- 每个路由文件负责一类功能
- 服务层与 pyJianYingDraft 库交互
- 模型层只负责数据结构定义

### 3. 代码整洁
- 清晰的命名规范
- 详细的文档字符串
- 合理的错误处理

### 4. 易扩展性
- 模块化设计便于添加新功能
- 统一的服务接口
- 标准化的响应格式

## 数据流

```
Client Request
    ↓
FastAPI Router (app/routers/*.py)
    ↓
Service Layer (app/services/draft_service.py)
    ↓
pyJianYingDraft Library
    ↓
draft_content.json File
    ↓
Response (Pydantic Models)
    ↓
Client
```

## 依赖关系

- **FastAPI**: Web 框架
- **Pydantic**: 数据验证和序列化
- **Uvicorn**: ASGI 服务器
- **pyJianYingDraft**: 剪映草稿解析库

## 扩展建议

### 添加新路由
1. 在 `app/routers/` 创建新文件
2. 定义 APIRouter 和端点
3. 在 `app/main.py` 注册路由

### 添加新服务
1. 在 `app/services/` 创建服务类
2. 实现业务逻辑方法
3. 在路由中调用服务

### 添加新模型
1. 在 `app/models/` 定义 Pydantic 模型
2. 用于请求验证或响应序列化

## 启动方式

### 方式 1: Python 脚本
```bash
python run.py
```

### 方式 2: Uvicorn 命令
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 方式 3: Windows 批处理
```
双击 run.bat
```

## API 文档访问

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
