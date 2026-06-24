# 依赖与配置

## 核心库依赖（`setup.py`）

- Python `>=3.8`（推荐 3.8 或 3.11）。
- `pymediainfo`（媒体信息提取，需系统安装 MediaInfo）。
- `imageio`（图片读取，用于贴纸/封面）。
- `uiautomation>=2; sys_platform == 'win32'`（仅 Windows 自动导出）。

包数据：`pyJianYingDraft/assets/*.json`。

## 后端依赖

- FastAPI + uvicorn。
- SQLAlchemy（异步 ORM）+ SQLite（`tasks.db`）。
- `aria2p`（Aria2 RPC 客户端）+ 外部 `aria2c` 可执行文件。
- 通过 `sys.path` 引用父目录的核心库（非 pip 安装）。

### 后端配置发现顺序

- `config.json` 的 `ARIA2_PATH`。
- 打包资源 `resources/aria2c.exe`。
- 系统 PATH 中的 `aria2c`。

### 后端环境变量

- `PYTHONUNBUFFERED=1`：强制日志实时输出（`run.py` 已设置）。

## 前端依赖（`package.json` 摘要）

- 框架：`next@15.5.6`、`react@19`、`react-dom@19`。
- UI：`@heroui/react@^3.2.1`、`@heroui/styles`、`tailwindcss@^4.0.0`、`tailwind-variants`、`lucide-react`。
- 编辑器：`@uiw/react-codemirror` + `@codemirror/*`（json/python/javascript 高亮与校验）、`@uiw/codemirror-theme-vscode`。
- 时间轴：`@xzdarcy/react-timeline-editor@^0.1.9`。
- 网络/工具：`axios`、`diff` + `diff2html` + `react-diff-view` + `unidiff`（差异对比）。
- 开发：`typescript@^5`、`eslint@9` + `eslint-config-next`、`@tailwindcss/postcss`、`@types/*`。

### 前端环境变量

- `.env.local`（实际值未读，避免泄密）。
- `.env.example`（模板，未读）。

## 版本兼容性

| 能力 | 剪映版本 |
| --- | --- |
| 草稿生成/解析（音视频/文本/特效） | 5.x ~ 7.x 全支持 |
| 模板模式 | ≤ 5.9（6+ 加密） |
| 自动导出 | ≤ 6.x（7+ 隐藏控件） |

## 平台差异

- Windows：全功能 + 自动导出。
- Linux/macOS：支持草稿生成与模板模式、后端服务、前端；**不支持自动导出**，生成的草稿需在 Windows 剪映导出。
