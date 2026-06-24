# 依赖与配置

## 关键依赖（package.json）

- 框架：`next@15.5.6`、`react@19`、`react-dom@19`。
- UI：`@heroui/react@^3.2.1`、`@heroui/styles@^3.2.1`、`tailwindcss@^4.0.0`、`@tailwindcss/postcss`、`tailwind-variants`、`lucide-react@^0.469.0`。
- 编辑器：`@uiw/react-codemirror@^4.25.2`、`@uiw/codemirror-theme-vscode`、`@codemirror/*`（state/view/language/commands/autocomplete/search/lint/lang-json/lang-python/lang-javascript/theme-one-dark）。
- 时间轴：`@xzdarcy/react-timeline-editor@^0.1.9`。
- 网络：`axios@^1.13.1`。
- 差异对比：`diff@^8.0.2`、`diff2html@^3.4.52`、`react-diff-view@^3.3.2`、`unidiff@^1.0.4`。
- 调试：`react-dev-inspector@^2.0.1`、`@react-dev-inspector/babel-plugin@^2.0.1`。

## devDependencies

- `typescript@^5`、`eslint@9`、`eslint-config-next@15.5.6`、`postcss@^8.5.6`、`@types/node@^20`、`@types/react@^19`、`@types/react-dom@^19`。

## scripts

- `dev` / `build` / `start` / `lint`
- `run:backend` / `build:backend` / `build:all`

## 配置文件

- `next.config.ts`
- `tsconfig.json` / `tsconfig.tsbuildinfo`
- `postcss.config.js`
- `.eslintrc.json`
- `.env.local` / `.env.example`
- `next-env.d.ts`
- `inspect-source-loader.cjs`（dev-inspector 配套）

## 环境变量

- `.env.local` 实际值未读（避免泄密）。
- 通常包含后端 baseURL（如 `NEXT_PUBLIC_API_BASE_URL`），具体以 `.env.example` 为准。
