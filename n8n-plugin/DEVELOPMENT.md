# n8n-nodes-jianying-draft 开发指南

## 🛠️ 开发环境设置

### 1. 克隆项目

```bash
cd pyJianYingDraft/n8n-plugin
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 开发模式

```bash
npm run dev
```

此命令会监听文件变化并自动重新编译。

## 📁 项目结构

```
n8n-plugin/
├── credentials/                    # 凭据定义
│   └── JianyingDraftApi.credentials.ts
├── nodes/                          # 节点定义
│   └── JianyingDraft/
│       ├── ReadPreset.node.ts
│       ├── ImportDraft.node.ts
│       ├── GetTaskResult.node.ts
│       ├── SubmitDraftWithUrl.node.ts
│       └── jianyingdraft.svg       # 节点图标 (需要添加)
├── dist/                           # 编译输出目录
├── package.json                    # 包配置
├── tsconfig.json                   # TypeScript 配置
├── gulpfile.js                     # Gulp 构建配置
├── .eslintrc.js                    # ESLint 配置
├── .prettierrc.js                  # Prettier 配置
└── README.md                       # 项目文档
```

## 🔧 本地测试

### 方法 1: 链接到 n8n (推荐)

```bash
# 在 n8n-plugin 目录
npm link

# 在 n8n 安装目录
cd ~/.n8n
npm link n8n-nodes-jianying-draft

# 重启 n8n
n8n start
```

### 方法 2: 复制到 custom 目录

```bash
# 构建项目
npm run build

# 复制到 n8n custom 目录
cp -r dist/* ~/.n8n/custom/

# 重启 n8n
n8n start
```

## 📝 代码规范

### TypeScript 规范

- 使用严格的 TypeScript 模式
- 所有函数参数和返回值必须有类型注解
- 使用 `interface` 定义数据结构
- 避免使用 `any`,使用 `unknown` 或具体类型

### 命名规范

- **节点类名**: PascalCase (例如: `ReadPreset`)
- **文件名**: PascalCase.node.ts (例如: `ReadPreset.node.ts`)
- **变量名**: camelCase (例如: `presetData`)
- **常量**: UPPER_SNAKE_CASE (例如: `API_BASE_URL`)

### 代码格式化

```bash
# 格式化所有代码
npm run format

# 检查代码风格
npm run lint

# 自动修复代码风格问题
npm run lintfix
```

## 🎨 添加新节点

### 1. 创建节点文件

在 `nodes/JianyingDraft/` 目录下创建新文件,例如 `MyNewNode.node.ts`:

```typescript
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

export class MyNewNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'My New Node',
		name: 'myNewNode',
		icon: 'file:jianyingdraft.svg',
		group: ['transform'],
		version: 1,
		description: '节点描述',
		defaults: {
			name: 'My New Node',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'jianyingDraftApi',
				required: false,
			},
		],
		properties: [
			// 节点参数定义
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			// 处理逻辑
		}

		return [returnData];
	}
}
```

### 2. 在 package.json 中注册节点

```json
{
  "n8n": {
    "nodes": [
      "dist/nodes/JianyingDraft/MyNewNode.node.js"
    ]
  }
}
```

### 3. 构建并测试

```bash
npm run build
# 重启 n8n 查看新节点
```

## 🧪 测试节点

### 手动测试流程

1. 在 n8n 中创建测试工作流
2. 添加你的节点
3. 配置参数
4. 执行工作流
5. 检查输出结果

### 测试检查清单

- ✅ 参数验证是否正确
- ✅ 错误处理是否完善
- ✅ 输出格式是否符合预期
- ✅ 与其他节点的兼容性
- ✅ 凭据是否正常工作
- ✅ Continue on Fail 是否正常

## 🔍 调试技巧

### 1. 使用 console.log

```typescript
console.log('Debug info:', someVariable);
```

n8n 运行在终端时会显示这些日志。

### 2. 使用浏览器开发者工具

在浏览器中打开 n8n,使用开发者工具查看网络请求和控制台日志。

### 3. 检查节点输出

在节点执行后,点击节点查看输出数据:
- **Table** 视图: 表格形式
- **JSON** 视图: 原始 JSON
- **Schema** 视图: 数据结构

## 📦 发布准备

### 1. 更新版本号

```bash
npm version patch  # 小版本更新 (1.0.0 -> 1.0.1)
npm version minor  # 中版本更新 (1.0.0 -> 1.1.0)
npm version major  # 大版本更新 (1.0.0 -> 2.0.0)
```

### 2. 更新 README

确保文档完整且准确:
- 使用示例
- API 文档
- 变更日志

### 3. 检查构建

```bash
npm run build
npm run lint
```

### 4. 发布到 npm

```bash
npm publish
```

## 🤝 贡献指南

### 提交代码

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/my-new-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送分支: `git push origin feature/my-new-feature`
5. 提交 Pull Request

### 代码审查

- 确保所有测试通过
- 遵循项目代码规范
- 添加必要的文档和注释
- 更新 README 中的变更说明

## 📚 参考资源

### n8n 官方文档

- [创建自定义节点](https://docs.n8n.io/integrations/creating-nodes/)
- [节点开发最佳实践](https://docs.n8n.io/integrations/creating-nodes/build/node-best-practices/)
- [节点参数参考](https://docs.n8n.io/integrations/creating-nodes/build/reference/)

### TypeScript 资源

- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### 本项目相关

- [pyJianYingDraft 文档](../CLAUDE.md)
- [coze-plugin 示例](../coze-plugin/doc/)
- [API 文档](http://localhost:8000/docs)

## ⚠️ 常见问题

### Q: 修改代码后节点没有更新?

A: 需要重启 n8n 才能加载最新的节点代码。

### Q: TypeScript 编译错误?

A: 检查 `tsconfig.json` 配置,确保 `n8n-workflow` 已正确安装。

### Q: 节点图标不显示?

A: 确保 `jianyingdraft.svg` 文件存在于 `nodes/JianyingDraft/` 目录,并且 gulpfile 正确复制了图标。

### Q: 如何处理异步操作?

A: 使用 `async/await` 和 `this.helpers.httpRequest()` 进行 HTTP 请求。

---

祝开发顺利! 🎉
