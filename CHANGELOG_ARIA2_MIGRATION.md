# Aria2 迁移变更日志

## 版本: v0.2.6 (待发布)

### 重大变更 (Breaking Changes)

#### 1. 移除内置远程下载功能

**移除的模块：**
- `pyJianYingDraft/remote_downloader.py` - 完全移除

**移除的文档：**
- `REMOTE_DOWNLOAD_README.md`
- `REMOTE_DOWNLOAD_QUICKSTART.md`

**移除的测试文件：**
- `test_remote_download.py`
- `test_async_download.py`

#### 2. ScriptFile API 变更

**废弃的参数（仍然接受但会显示警告）：**

```python
# pyJianYingDraft/script_file.py

def dump(
    self,
    file_path: str,
    download_remote: bool = None,      # ⚠️ 已废弃
    max_concurrent: int = None,        # ⚠️ 已废弃
    proxy: Optional[str] = None,       # ⚠️ 已废弃
    download_verbose: bool = None      # ⚠️ 已废弃
) -> None:
    """
    如果传入这些参数，会显示 DeprecationWarning：
    "download_remote, max_concurrent, proxy, download_verbose 参数已废弃。
    远程素材下载功能已移除，请使用 pyJianYingDraftServer 中的 aria2 下载功能。"
    """
    pass

def save(
    self,
    download_remote: bool = None,      # ⚠️ 已废弃
    max_concurrent: int = None,        # ⚠️ 已废弃
    proxy: Optional[str] = None,       # ⚠️ 已废弃
    download_verbose: bool = None      # ⚠️ 已废弃
) -> None:
    """同上"""
    pass
```

**移除的方法：**
- `ScriptFile._download_remote_materials()` - 完全移除

#### 3. Timeline.tsx 变更

**移除的功能：**
- 同步测试数据按钮（1436-1458行）
- 只保留提交按钮

**修复的问题：**
- `handleTestData` 和 `handleAsyncSubmit` 返回值类型错误
- 现在这两个函数都不返回值，符合 `handleTestDataSelect` 的类型要求

### 新增内容

#### 1. 迁移指南

**新增文档：**
- `MIGRATION_ARIA2.md` - 详细的迁移指南，包括：
  - 旧方式 vs 新方式对比
  - 三种使用 aria2 的方法
  - 功能对比表
  - 常见问题解答

### 依赖变更

**移除的依赖（从 requirements.txt）：**
- 无（aiohttp 和 aiohttp-retry 从未在主项目的 requirements.txt 中）

**注意：** pyJianYingDraftServer 仍然保留 aiohttp 依赖，用于其他用途（如 HTTP 客户端测试）

### 向后兼容性

#### ✅ 兼容的用法

```python
# 这些用法仍然有效，不会报错
script.save()
script.dump("path/to/file.json")
```

#### ⚠️ 会显示警告的用法

```python
# 会显示 DeprecationWarning，但不会报错
script.save(download_remote=True)
script.dump("path/to/file.json", proxy="http://127.0.0.1:7890")
```

#### ❌ 不再支持的用法

```python
# 这些导入会失败
from pyJianYingDraft.remote_downloader import download_remote_materials  # ModuleNotFoundError
from pyJianYingDraft.remote_downloader import RemoteMaterialDownloader   # ModuleNotFoundError
```

### 迁移步骤

#### 对于库用户

1. **如果你不使用远程素材下载：**
   - 无需任何更改
   - 移除 `download_remote=True` 等参数以消除警告

2. **如果你使用远程素材下载：**
   - 阅读 `MIGRATION_ARIA2.md`
   - 选择以下方式之一：
     - 使用 pyJianYingDraftServer 的 Web 界面
     - 使用 pyJianYingDraftServer 的 API
     - 直接使用 aria2 客户端

#### 对于开发者

1. **更新代码：**
   ```python
   # 旧代码
   script.save(download_remote=True, proxy="http://127.0.0.1:7890")
   
   # 新代码（使用 API）
   import requests
   response = requests.post("http://localhost:8000/api/tasks/submit", json={...})
   ```

2. **更新测试：**
   - 移除依赖 `remote_downloader` 的测试
   - 使用 `pyJianYingDraftServer` 的测试工具

### 技术细节

#### 代码变更统计

**删除：**
- `pyJianYingDraft/remote_downloader.py`: 283 行
- `REMOTE_DOWNLOAD_README.md`: 424 行
- `REMOTE_DOWNLOAD_QUICKSTART.md`: 57 行
- `test_remote_download.py`: 89 行
- `test_async_download.py`: 163 行
- `ScriptFile._download_remote_materials()`: 44 行
- Timeline.tsx 同步测试按钮: 23 行

**修改：**
- `ScriptFile.dump()`: 添加废弃警告
- `ScriptFile.save()`: 添加废弃警告
- Timeline.tsx: 修复返回值类型

**新增：**
- `MIGRATION_ARIA2.md`: 迁移指南
- `CHANGELOG_ARIA2_MIGRATION.md`: 本文档

#### 总计
- 删除代码: ~1,083 行
- 修改代码: ~50 行
- 新增文档: ~250 行

### 测试建议

#### 单元测试

```python
# 测试废弃警告
import warnings

with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    script.save(download_remote=True)
    assert len(w) == 1
    assert issubclass(w[0].category, DeprecationWarning)
    assert "已废弃" in str(w[0].message)
```

#### 集成测试

1. 启动 pyJianYingDraftServer
2. 提交包含远程素材的任务
3. 验证 aria2 正确下载文件
4. 验证草稿文件正确生成

### 发布清单

- [ ] 更新 `setup.py` 版本号为 0.2.6
- [ ] 更新主 `README.md`，移除远程下载相关内容
- [ ] 在 GitHub 创建 Release，标注为 Breaking Change
- [ ] 更新文档网站（如果有）
- [ ] 发布到 PyPI
- [ ] 通知用户重大变更

### 相关链接

- [Aria2 下载系统文档](pyJianYingDraftServer/ASYNC_DOWNLOAD_SYSTEM.md)
- [迁移指南](MIGRATION_ARIA2.md)
- [服务器文档](pyJianYingDraftServer/README.md)

### 贡献者

- 本次变更由 AI Assistant 完成
- 基于用户需求："移除 aiohttp 和 aiohttp-retry 的下载方式，始终使用 aria2 下载"

---

**发布日期：** 待定  
**版本：** v0.2.6  
**类型：** Breaking Change

