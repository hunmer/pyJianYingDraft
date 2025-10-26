import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class SubmitDraftWithUrl implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Submit Draft With URL',
		name: 'submitDraftWithUrl',
		icon: 'file:jianyingdraft.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: '通过 URL 提交草稿 - 验证远程 JSON 数据并提交任务',
		defaults: {
			name: 'Submit Draft With URL',
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
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				description: '远程 JSON 数据的 URL 地址',
				placeholder: 'https://example.com/preset.json',
			},
			{
				displayName: 'API Base URL',
				name: 'apiBase',
				type: 'string',
				default: 'http://127.0.0.1:8000',
				description: 'API服务器基础地址 (如果未使用凭据)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				// 获取参数
				const url = this.getNodeParameter('url', i) as string;
				let apiBase = this.getNodeParameter('apiBase', i, 'http://127.0.0.1:8000') as string;

				// 尝试从凭据获取 API Base
				try {
					const credentials = await this.getCredentials('jianyingDraftApi');
					if (credentials?.apiBase) {
						apiBase = credentials.apiBase as string;
					}
				} catch {
					// 如果没有凭据,使用参数中的 apiBase
				}

				// 1. 验证必需字段
				if (!url) {
					throw new NodeOperationError(this.getNode(), 'url 参数不能为空', {
						itemIndex: i,
					});
				}

				// 2. 验证URL格式
				let parsedUrl: URL;
				try {
					parsedUrl = new URL(url);
				} catch (urlError: any) {
					throw new NodeOperationError(
						this.getNode(),
						`无效的URL格式: ${urlError.message}`,
						{ itemIndex: i },
					);
				}

				// 3. 获取远程 JSON 数据
				let jsonData: any;
				try {
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: url,
						json: true,
					});

					jsonData = response;
				} catch (fetchError: any) {
					throw new NodeOperationError(
						this.getNode(),
						`获取或解析URL内容失败: ${fetchError.message}`,
						{ itemIndex: i },
					);
				}

				// 4. 验证必需字段
				const requiredFields = ['ruleGroup', 'materials', 'testData'];
				const missingFields: string[] = [];

				for (const field of requiredFields) {
					if (!jsonData[field]) {
						missingFields.push(field);
					}
				}

				if (missingFields.length > 0) {
					throw new NodeOperationError(
						this.getNode(),
						`远程 JSON 数据缺少必需字段: ${missingFields.join(', ')}`,
						{ itemIndex: i },
					);
				}

				// 5. 验证字段类型
				if (typeof jsonData.ruleGroup !== 'object' || jsonData.ruleGroup === null) {
					throw new NodeOperationError(
						this.getNode(),
						`ruleGroup 字段必须是对象,当前类型: ${typeof jsonData.ruleGroup}`,
						{ itemIndex: i },
					);
				}

				if (!Array.isArray(jsonData.materials)) {
					throw new NodeOperationError(
						this.getNode(),
						`materials 字段必须是数组,当前类型: ${typeof jsonData.materials}`,
						{ itemIndex: i },
					);
				}

				if (typeof jsonData.testData !== 'object' || jsonData.testData === null) {
					throw new NodeOperationError(
						this.getNode(),
						`testData 字段必须是对象,当前类型: ${typeof jsonData.testData}`,
						{ itemIndex: i },
					);
				}

				// 6. 构建 API URL
				const encodedUrl = encodeURIComponent(url);
				const apiUrl = `${apiBase}/api/tasks/submit_with_url?url=${encodedUrl}`;

				returnData.push({
					json: {
						success: true,
						api_url: apiUrl,
						message: 'URL 验证成功,已生成 API 调用地址',
						validation_info: {
							url: url,
							has_required_fields: true,
							materials_count: jsonData.materials?.length || 0,
							rule_group_title: jsonData.ruleGroup?.title || '(未命名)',
						},
					},
					pairedItem: i,
				});
			} catch (error: any) {
				if (this.continueOnFail()) {
					let errorMessage = '处理失败';
					if (error.message) {
						errorMessage += `: ${error.message}`;
					}

					returnData.push({
						json: {
							success: false,
							error: errorMessage,
						},
						pairedItem: i,
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
