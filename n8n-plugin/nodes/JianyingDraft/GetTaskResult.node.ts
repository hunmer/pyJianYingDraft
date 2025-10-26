import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class GetTaskResult implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Get Task Result',
		name: 'getTaskResult',
		icon: 'file:jianyingdraft.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: '查询草稿生成任务结果',
		defaults: {
			name: 'Get Task Result',
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
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				default: '',
				required: true,
				description: '任务ID (从 importDraft 返回的 task_id)',
				placeholder: '输入任务ID',
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
				const taskId = this.getNodeParameter('taskId', i) as string;
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
				if (!taskId) {
					throw new NodeOperationError(this.getNode(), 'task_id 不能为空', {
						itemIndex: i,
					});
				}

				// 2. 调用 API 查询任务状态
				const apiUrl = `${apiBase}/api/tasks/${taskId}`;

				const response = await this.helpers.httpRequest({
					method: 'GET',
					url: apiUrl,
					json: true,
				});

				// 3. 返回任务信息
				returnData.push({
					json: {
						success: true,
						task_id: response.task_id,
						status: response.status,
						message: response.message,
						progress: response.progress,
						draft_path: response.draft_path,
						error_message: response.error_message,
						created_at: response.created_at,
						updated_at: response.updated_at,
						completed_at: response.completed_at,
						api_response: response,
					},
					pairedItem: i,
				});
			} catch (error: any) {
				if (this.continueOnFail()) {
					let errorMessage = '查询任务结果失败';
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
