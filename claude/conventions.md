# 约定详情

## 命令速查

```bash
# 核心库示例
python demo.py              # 需先改代码中的草稿文件夹路径
python demo_subdrafts.py    # 复合片段示例

# 后端
cd pyJianYingDraftServer
python run.py               # 开发启动（已禁用 --reload）
python test_e2e.py          # 端到端测试
python test_database.py     # 数据库测试
python test_groups.py       # 规则组测试
python build_server.py      # 打包单文件 exe

# 前端
cd pyjianyingdraft-web
npm run dev                 # Next.js 开发
npm run lint                # ESLint
npm run build               # 生产构建
npm run build:all           # 含后端打包
```

## 时间系统（核心库）

- 内部单位：微秒 `int`。
- `SEC = 1000000`（1 秒）。
- `tim(time_str)`：`"1.5s"` / `"1h3m12s"` → 微秒。
- `trange(start, duration)`：第二个参数是**持续时长**，不是结束时间。
- 关键帧时刻是相对于片段头部的偏移量，不是绝对时间。

## 命名与兼容

- 类名 PascalCase；保留 snake_case 旧别名（`Script_file`、`Draft_folder` 等）触发 `DeprecationWarning`，不要在新代码使用。
- 枚举成员中文命名直接对应剪映 UI；提供 `from_name()` 忽略大小写/空格/下划线查找。

## 片段构造参数顺序

`__init__(material, target_timerange, source_timerange=None, speed=None, ...)`：
- `target_timerange`：片段在时间轴上的位置和长度。
- `source_timerange`：从素材截取的范围，默认自动计算。
- `speed`：播放速度，默认 1.0。

## 特效/滤镜参数

- `params` 顺序以枚举类**注释**为准，不一定与剪映 UI 顺序一致。
- 参数值范围 0–100，对应 UI 百分比；`None` 表示默认值。

## 轨道层级

- `relative_index`：相对同类型轨道，值越大越靠前景。
- `absolute_index`：直接覆盖 `render_index`，供高级用户。
- 主视频轨道（最底层）片段必须从 `0s` 开始。

## 模板模式限制

- 仅支持未加密 `draft_content.json`（剪映 ≤5.9）。
- `ImportedTrack` 不可直接添加新片段。
- 三种替换：按名称替换素材（影响所有引用）、按片段替换素材（单个，可调时间范围）、替换文本（保留格式）。

## 文本动画顺序

为文本片段同时设置循环和出入场动画时，**必须先添加出入场动画**。

## 路径处理

- 使用 `os.path.join()` 构建跨平台路径。
- Windows 路径用原始字符串 `r"path\to\file"`。
- 后端优先用 `pathlib.Path`。

## 后端日志规范

- 不要修改根日志配置（与 uvicorn 冲突可能导致递归）。
- 用 `print()` 输出关键事件并立即 `sys.stdout.flush()`。
- `PYTHONUNBUFFERED=1`（已在 `run.py` 设置）。

## 后端配置关键项（`pyJianYingDraftServer/config.json`）

- `PYJY_DRAFT_ROOT`：剪映草稿文件夹路径（必填）。
- `ARIA2_PATH`：aria2c 路径（可选，按 config → 打包 resources → PATH 顺序发现）。
- `PYJY_RULE_GROUPS`：规则组数组。

## 忽略与生成物

`.gitignore` 已忽略：`__pycache__`、`build/`、`dist/`、`*.egg-info/`、`.venv/`、`venv/`、`node_modules/`（隐式）、`pyjianyingdraft-web/dist/`、`pyJianYingDraftServer/data/`、`tasks.db`、`*.exe`。
