# 对外接口

## 页面路由（App Router）

| 路径 | 文件 | 用途 |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | 首页/草稿列表 |
| `/editor` | `src/app/editor/page.tsx` | 草稿编辑器（时间轴） |
| `/downloads` | `src/app/downloads/page.tsx` | 下载管理 |

## API Route（Next.js Route Handler）

| 路径 | 文件 | 用途 |
| --- | --- | --- |
| `/api/open-in-editor` | `src/app/api/open-in-editor/route.ts` | 开发态打开本地编辑器 |

## 后端 API 调用（`src/lib/api.ts`）

通过 axios 调用 `pyJianYingDraftServer`（默认 `http://localhost:8000`），主要端点对接后端：

- `/api/draft/*` 草稿基础
- `/api/subdrafts/*` 复合片段
- `/api/materials/*` 素材
- `/api/tracks/*` 轨道
- `/api/files/*` 文件
- `/api/rules/*` 规则测试
- `/api/tasks/*` 异步任务
- `/api/aria2/*` 下载管理
- 生成记录相关端点

具体封装函数本次未深读 `api.ts` 全文，建议下一步补扫。

## 实时订阅

- `useTaskProgress`：任务进度。
- `useAria2WebSocket`：Aria2 下载实时推送。

## 规则类型映射（与后端共享）

- `image`/`video` → 视频轨道
- `audio`/`music`/`sound`/`extract_music` → 音频轨道
- `text`/`subtitle` → 文本轨道
- `video_effect` → 特效轨道
