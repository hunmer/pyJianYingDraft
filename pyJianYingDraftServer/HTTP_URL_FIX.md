# HTTP URL处理修复总结

**修复日期:** 2025-10-22
**问题类型:** 关键Bug - HTTP URL路径处理
**影响范围:** 异步任务中含有HTTP素材的草稿生成

## 问题描述

当用户提交包含HTTP URL素材的异步任务时，系统产生以下错误：

```
[TaskQueue 19:09:08] ✗ 任务 a78a6c39... 草稿生成失败: 找不到 D:\programming\pyJianYingDraft\pyJianYingDraftServer\https:\s.coze.cn\t\igybkZ9EfpU
```

**根本原因:**
- 前端传来的素材包含HTTP URL: `"path": "https://s.coze.cn/t/igybkZ9EfpU"`
- 系统正确识别并下载了文件到本地
- 但在生成草稿前，仍然将HTTP URL传递给 `RuleTestService`
- RuleTestService试图将URL作为文件路径打开，导致"找不到文件"错误

## 关键设计问题

原始设计的问题：
1. `_extract_download_urls()` 识别URL并下载
2. 但下载后没有将 task.materials 中的URL替换为本地路径
3. `_generate_draft()` 时仍然使用原始的 task.materials（包含HTTP URL）
4. RuleTestService 无法访问HTTP URL（它需要本地文件路径）

## 解决方案

### 1. 建立URL→本地路径映射

**文件:** `app/services/task_queue.py:197-253`
**方法:** `_extract_download_urls()`

```python
# 建立映射关系
url_to_local_path: Dict[str, str] = {}

for material in materials:
    path = material.get("path")
    if path.startswith("http"):
        # 计算本地保存路径
        save_path = str(download_dir / filename)
        urls_with_paths.append((path, save_path))

        # 记录映射关系：HTTP URL -> 本地路径
        url_to_local_path[path] = save_path

# 保存映射到任务对象
task._url_to_local_path_map = url_to_local_path
```

### 2. 下载完成后转换路径

**文件:** `app/services/task_queue.py:257-290`
**新方法:** `_apply_downloaded_paths()`

```python
def _apply_downloaded_paths(self, task: DownloadTask) -> None:
    """将HTTP URL替换为本地文件路径"""
    url_to_local_map = task._url_to_local_path_map

    # 遍历所有素材
    for material in task.materials:
        path = material.get("path")
        if path in url_to_local_map:
            # 关键操作：将HTTP URL替换为本地路径
            material["path"] = url_to_local_map[path]
            self._log(f"素材路径已更新: {path} -> {material['path']}")
```

### 3. 处理流程中的正确调用顺序

**文件:** `app/services/task_queue.py:171-178`
**方法:** `_process_task()`

```python
# 4. 等待下载完成
await self._wait_for_download_completion(task_id)

# 4.5. 将HTTP URL替换为本地文件路径 (新增)
self._apply_downloaded_paths(task)

# 5. 生成草稿 (此时task.materials已含本地路径)
await self._generate_draft(task_id)
```

## 处理流程时序图

```
时间 →
┌─────────────────────────────────────────────────────────────────┐
│ 任务提交                                                          │
│ task.materials = [                                              │
│   {"path": "https://s.coze.cn/t/igybkZ9EfpU"}  ← HTTP URL      │
│ ]                                                               │
└────────────────┬──────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ _extract_download_urls()                                        │
│ - 识别HTTP URL素材                                             │
│ - 建立映射: https://... → /downloads/task_id/filename.mp4      │
│ - 保存到 task._url_to_local_path_map                           │
│ - 返回需要下载的URL列表给Aria2                                  │
└────────────────┬──────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Aria2 下载                                                       │
│ - 下载 https://s.coze.cn/t/igybkZ9EfpU                          │
│ - 保存到 /downloads/task_id/igybkZ9EfpU.mp4                     │
└────────────────┬──────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ _wait_for_download_completion()                                 │
│ - 监控Aria2进度                                                 │
│ - 等待所有文件下载完成                                           │
└────────────────┬──────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ _apply_downloaded_paths() ← 关键修复点                          │
│ - 遍历 task.materials                                           │
│ - 查询映射表: https://... → /downloads/task_id/igybkZ9EfpU.mp4 │
│ - 将 material["path"] 替换为本地路径                             │
│                                                                 │
│ task.materials = [                                              │
│   {"path": "/downloads/task_id/igybkZ9EfpU.mp4"}  ← 本地路径   │
│ ]                                                               │
└────────────────┬──────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ _generate_draft()                                               │
│ - RuleTestService.run_test(materials=[...本地路径...])          │
│ - 可以正常打开和处理文件                                         │
│ - 生成草稿成功                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 代码修改明细

### 修改1: _extract_download_urls 方法扩展

**行号:** 181-255
**类型:** 修改

```python
# 新增：建立映射字典
url_to_local_path: Dict[str, str] = {}

# ... (处理URL逻辑) ...

# 新增：记录映射关系
url_to_local_path[path] = save_path

# 新增：保存映射到任务对象
task._url_to_local_path_map = url_to_local_path
```

### 修改2: 新增 _apply_downloaded_paths 方法

**行号:** 257-290
**类型:** 新增

```python
def _apply_downloaded_paths(self, task: DownloadTask) -> None:
    """将下载的本地文件路径应用到task.materials中"""
    # ... 完整实现见源文件
```

### 修改3: _process_task 方法中添加调用

**行号:** 174-175
**类型:** 新增

```python
# 4.5. 将HTTP URL替换为本地文件路径
self._apply_downloaded_paths(task)
```

## 技术亮点

### 1. 非侵入式设计
- 使用 `task._url_to_local_path_map` 动态属性
- 不修改 DownloadTask 模型定义
- 保持向后兼容

### 2. 原地修改
- 直接修改 task.materials 字典中的值
- `material["path"] = new_path`
- 无需创建新对象，节省内存

### 3. 清晰的职责分离
- `_extract_download_urls()`: 识别→下载
- `_apply_downloaded_paths()`: 映射→替换
- `_generate_draft()`: 处理（现在总是本地路径）

## 测试建议

### 测试1: 纯本地素材（无HTTP URL）
```python
materials = [
    {"path": "/local/video.mp4", "type": "video"}
]
# 预期: 直接生成草稿，不执行下载
```

### 测试2: 纯HTTP素材
```python
materials = [
    {"path": "https://example.com/video.mp4", "type": "video"}
]
# 预期: 下载→转换→生成草稿
```

### 测试3: 混合本地和HTTP素材
```python
materials = [
    {"path": "/local/image.png", "type": "image"},
    {"path": "https://example.com/audio.mp3", "type": "audio"}
]
# 预期: 仅下载HTTP，保留本地路径，混合传递给生成器
```

### 测试4: HTTP URL转义和特殊字符
```python
materials = [
    {"path": "https://s.coze.cn/t/igybkZ9EfpU?v=1&t=test", "type": "video"}
]
# 预期: 正确处理URL参数和特殊字符
```

## 相关修改

| 文件 | 行号 | 修改类型 | 说明 |
|------|------|---------|------|
| task_queue.py | 197-253 | 修改 | _extract_download_urls 建立映射 |
| task_queue.py | 257-290 | 新增 | _apply_downloaded_paths 方法 |
| task_queue.py | 174-175 | 新增 | 在_process_task中调用apply方法 |

## 向后兼容性

- ✅ 本地路径素材不受影响
- ✅ 旧格式字典 {"videos": [...]} 仍支持
- ✅ 无需更新前端或API契约
- ✅ _url_to_local_path_map 作为内部属性，不暴露

## 性能影响

- ➕ 额外内存: 每个HTTP URL记录一条映射 (字符串长度通常<200字符)
- ➕ 额外时间: O(n) 遍历更新materials (n=素材数，通常<100)
- 性能影响: **可忽略**

## 验证清单

- [ ] 识别HTTP URL正确
- [ ] Aria2 下载成功
- [ ] 下载后本地文件存在
- [ ] URL→本地路径映射正确
- [ ] task.materials 更新成功
- [ ] RuleTestService 能打开本地文件
- [ ] 草稿文件生成成功

---

**修复状态:** ✅ 完成
**测试状态:** 等待验证
**风险等级:** 低 (逻辑清晰，非侵入式)
