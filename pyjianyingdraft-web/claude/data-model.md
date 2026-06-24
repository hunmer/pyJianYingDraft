# 数据模型

## TypeScript 类型（`src/types/`）

- `draft.ts`：草稿、轨道、片段、素材类型（镜像后端 `draft_models`）。
- `rule.ts`：规则组、测试数据类型（镜像 `rule_models`）。
- `aria2.ts`：下载任务、进度类型。
- `global.d.ts`：全局类型补丁。

## 时间轴状态（`src/components/timeline-editor/`）

- `types.ts`：时间轴内部类型。
- `constants.ts`：常量。
- `useRawPayloads.ts`：原始 payload 处理。
- `useTestHandlers.ts`：测试操作处理。
- `useRuleGroups.ts`：规则组集成。
- `TooltipManager.ts`：tooltip 管理。
- `TimelineEditor.tsx`：主组件。

## 规则组结构（前后端共享）

- 每条规则：素材类型 + 素材 ID。
- 类型映射：`image/video`→视频，`audio/music/sound/extract_music`→音频，`text/subtitle`→文本，`video_effect`→特效。
- 默认规则组：`src/config/defaultRules.ts`。

## 本地存储

- `src/lib/storage.ts`：本地存储抽象（具体 key 未深读）。

## 任务进度

- `useTaskProgress` 订阅任务状态（与后端 `PENDING→DOWNLOADING→PROCESSING→COMPLETED/FAILED` 对齐）。
- `useAria2WebSocket` 订阅下载实时进度。
