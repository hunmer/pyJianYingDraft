# 测试与质量

## Lint

- `npm run lint`（`next lint`，基于 `eslint-config-next`）。
- 配置 `.eslintrc.json`。

## 类型检查

- TypeScript 5。
- 通过 `next build` 隐式执行 `tsc`。
- 配置 `tsconfig.json`。

## 单元测试

- package.json **未配置** jest/vitest 等测试框架。
- 验证依赖浏览器开发工具手动检查 API 调用与状态。

## 质量风险

1. HeroUI 主题引用未定义的 CSS 变量导致透明（参见 memory）。
2. 后端 baseURL 配置错误（`.env.local`）导致 API 不通。
3. 时间轴状态分散在多个 hook，改动易引入不一致。
4. 无自动化测试，回归依赖人工。
5. `react@19` + 部分依赖可能存在兼容性（如 react-timeline-editor）。
