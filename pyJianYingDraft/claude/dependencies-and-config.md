# 依赖与配置

## 运行时依赖（setup.py）

- Python `>=3.8`（推荐 3.8 或 3.11）。
- `pymediainfo`：媒体信息提取，**需系统安装 MediaInfo 共享库**（Windows 安装包或 Linux `libmediainfo`）。
- `imageio`：图片读取（贴纸/封面）。
- `uiautomation>=2; sys_platform == 'win32'`：仅 Windows 自动导出。

## 包数据

- `pyJianYingDraft/assets/*.json`：打包进发行版的资源数据（`setup.py` 的 `package_data`）。
- `metadata/*.py`：编译进包的枚举（非数据文件）。

## 版本

- `setup.py` 声明 `version="0.2.5"`，author `gary318`。
- PyPI 长描述来自 `pypi_readme.md`。

## 兼容性

| 能力 | 剪映版本 |
| --- | --- |
| 草稿生成（音视频/文本/特效） | 5.x ~ 7.x |
| 模板模式 | ≤ 5.9 |
| 自动导出 | ≤ 6.x |

## 平台

- Windows：全功能。
- Linux/macOS：草稿生成与模板模式可用，自动导出不可用。
