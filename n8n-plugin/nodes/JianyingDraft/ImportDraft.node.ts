import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class ImportDraft implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Import Draft',
		name: 'importDraft',
		icon: 'file:jianyingdraft.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: '调用 API 将预设数据提交为异步任务',
		defaults: {
			name: 'Import Draft',
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
				displayName: 'Preset Data',
				name: 'presetData',
				type: 'json',
				default: '',
				required: true,
				description: 'JSON字符串,包含完整的预设数据',
				placeholder: '输入预设数据的JSON',
			},
			{
				displayName: 'Draft Title',
				name: 'draftTitle',
				type: 'string',
				default: '',
				description: '自定义草稿标题,默认使用 ruleGroup.title',
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
				const presetDataInput = this.getNodeParameter('presetData', i) as string;
				const draftTitle = this.getNodeParameter('draftTitle', i, '') as string;
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
				if (!presetDataInput) {
					throw new NodeOperationError(this.getNode(), 'preset_data 不能为空', {
						itemIndex: i,
					});
				}

				// 2. 解析 preset_data 字符串为 JSON 对象
				let parsedPresetData: any;
				try {
					parsedPresetData =
						typeof presetDataInput === 'string'
							? JSON.parse(presetDataInput)
							: presetDataInput;
				} catch (parseError: any) {
					throw new NodeOperationError(
						this.getNode(),
						`preset_data JSON 解析失败: ${parseError.message}`,
						{ itemIndex: i },
					);
				}

				// 3. 验证必需字段
				const requiredFields = ['ruleGroup', 'materials', 'testData'];
				const missingFields: string[] = [];

				for (const field of requiredFields) {
					if (!parsedPresetData[field]) {
						missingFields.push(field);
					}
				}

				if (missingFields.length > 0) {
					throw new NodeOperationError(
						this.getNode(),
						`preset_data 缺少必需字段: ${missingFields.join(', ')}`,
						{ itemIndex: i },
					);
				}

				// 4. 准备请求数据 - 包含所有字段
				const requestPayload: any = {
					ruleGroup: draftTitle
						? {
								...parsedPresetData.ruleGroup,
								title: draftTitle,
							}
						: parsedPresetData.ruleGroup,
					materials: parsedPresetData.materials,
					testData: parsedPresetData.testData,
					use_raw_segments: true,
					segment_styles: parsedPresetData.segment_styles || {},
					raw_segments: parsedPresetData.raw_segments || [],
					raw_materials: parsedPresetData.raw_materials || [],
					canvas_width: parsedPresetData.canvas_width || undefined,
					canvas_height: parsedPresetData.canvas_height || undefined,
					fps: parsedPresetData.fps || undefined,
					draft_config: parsedPresetData.draft_config || {},
				};

				// 5. 调用 API - 使用异步任务提交端点
				const apiUrl = `${apiBase}/api/tasks/submit`;

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: apiUrl,
					body: requestPayload,
					json: true,
				});

				// 6. 检查响应数据 - 异步任务端点返回 task_id
				if (!response.task_id) {
					throw new NodeOperationError(
						this.getNode(),
						response.message || '任务提交失败,未返回任务ID',
						{ itemIndex: i },
					);
				}

				// 7. 返回任务ID,用户需要使用此ID轮询任务状态
				returnData.push({
					json: {
						success: true,
						task_id: response.task_id,
						message: response.message || '异步任务已提交,请使用 task_id 查询任务状态',
						api_response: response,
					},
					pairedItem: i,
				});
			} catch (error: any) {
				if (this.continueOnFail()) {
					let errorMessage = '保存草稿失败';
					if (error.message) {
						errorMessage += `: ${error.message}`;
					}

					// 特殊处理网络错误
					if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
						const apiBase = this.getNodeParameter('apiBase', i, 'http://127.0.0.1:8000');
						errorMessage = `无法连接到 API 服务器 (${apiBase}),请确保服务已启动`;
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
