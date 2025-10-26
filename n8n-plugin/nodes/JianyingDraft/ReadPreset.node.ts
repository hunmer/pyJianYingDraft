import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class ReadPreset implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Read Preset',
		name: 'readPreset',
		icon: 'file:jianyingdraft.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: '校验并返回剪映草稿预设数据',
		defaults: {
			name: 'Read Preset',
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
				description: 'JSON字符串,包含完整的 full-request.json 信息',
				placeholder: '输入预设数据的JSON',
			},
			{
				displayName: 'API Base URL',
				name: 'apiBase',
				type: 'string',
				default: 'http://127.0.0.1:8000',
				description: 'API服务器基础地址 (如果未使用凭据)',
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
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

				// 1. 检查数据是否存在
				if (!presetDataInput) {
					throw new NodeOperationError(this.getNode(), '预设数据不能为空', {
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

				// 3. 校验必需字段
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
						`缺少必需字段: ${missingFields.join(', ')}`,
						{ itemIndex: i },
					);
				}

				// 校验可选字段的类型(如果提供)
				if (
					parsedPresetData.segment_styles !== undefined &&
					typeof parsedPresetData.segment_styles !== 'object'
				) {
					throw new NodeOperationError(this.getNode(), 'segment_styles 必须是对象类型', {
						itemIndex: i,
					});
				}

				if (
					parsedPresetData.use_raw_segments !== undefined &&
					typeof parsedPresetData.use_raw_segments !== 'boolean'
				) {
					throw new NodeOperationError(this.getNode(), 'use_raw_segments 必须是布尔值', {
						itemIndex: i,
					});
				}

				if (
					parsedPresetData.canvas_width !== undefined &&
					typeof parsedPresetData.canvas_width !== 'number'
				) {
					throw new NodeOperationError(this.getNode(), 'canvas_width 必须是数字', {
						itemIndex: i,
					});
				}

				if (
					parsedPresetData.canvas_height !== undefined &&
					typeof parsedPresetData.canvas_height !== 'number'
				) {
					throw new NodeOperationError(this.getNode(), 'canvas_height 必须是数字', {
						itemIndex: i,
					});
				}

				if (parsedPresetData.fps !== undefined && typeof parsedPresetData.fps !== 'number') {
					throw new NodeOperationError(this.getNode(), 'fps 必须是数字', { itemIndex: i });
				}

				// 4. 校验 ruleGroup 结构
				const { ruleGroup } = parsedPresetData;
				if (!ruleGroup.id || !ruleGroup.title || !Array.isArray(ruleGroup.rules)) {
					throw new NodeOperationError(
						this.getNode(),
						'ruleGroup 结构不正确: 需要包含 id, title, rules 字段',
						{ itemIndex: i },
					);
				}

				// 5. 校验 materials 是数组
				if (!Array.isArray(parsedPresetData.materials)) {
					throw new NodeOperationError(this.getNode(), 'materials 必须是数组', {
						itemIndex: i,
					});
				}

				// 6. 校验 testData 结构
				const { testData } = parsedPresetData;
				if (!Array.isArray(testData.tracks) || !Array.isArray(testData.items)) {
					throw new NodeOperationError(
						this.getNode(),
						'testData 结构不正确: 需要包含 tracks 和 items 数组',
						{ itemIndex: i },
					);
				}

				// 7. 校验 use_raw_segments 模式
				if (parsedPresetData.use_raw_segments === true) {
					if (
						!Array.isArray(parsedPresetData.raw_segments) ||
						parsedPresetData.raw_segments.length === 0
					) {
						throw new NodeOperationError(
							this.getNode(),
							'use_raw_segments 为 true 时,必须提供非空的 raw_segments 数组',
							{ itemIndex: i },
						);
					}

					// 校验每个 raw_segment 的必需字段
					for (let j = 0; j < parsedPresetData.raw_segments.length; j++) {
						const seg = parsedPresetData.raw_segments[j];
						if (!seg.track_id || !seg.track_type || !seg.segment) {
							throw new NodeOperationError(
								this.getNode(),
								`raw_segments[${j}] 缺少必需字段 (track_id, track_type, segment)`,
								{ itemIndex: i },
							);
						}

						// 校验 segment 中的 target_timerange
						if (
							!seg.segment.target_timerange ||
							seg.segment.target_timerange.duration === undefined
						) {
							throw new NodeOperationError(
								this.getNode(),
								`raw_segments[${j}].segment 缺少有效的 target_timerange`,
								{ itemIndex: i },
							);
						}
					}

					// 如果提供了 raw_materials,也要校验
					if (
						parsedPresetData.raw_materials &&
						Array.isArray(parsedPresetData.raw_materials)
					) {
						for (let j = 0; j < parsedPresetData.raw_materials.length; j++) {
							const mat = parsedPresetData.raw_materials[j];
							if (!mat.id || !mat.category || !mat.data) {
								throw new NodeOperationError(
									this.getNode(),
									`raw_materials[${j}] 缺少必需字段 (id, category, data)`,
									{ itemIndex: i },
								);
							}
						}
					}
				}

				// 8. 校验画布配置(如果提供)
				if (parsedPresetData.draft_config) {
					const { canvas_config, fps } = parsedPresetData.draft_config;

					if (canvas_config) {
						if (
							typeof canvas_config.canvas_width !== 'number' ||
							typeof canvas_config.canvas_height !== 'number'
						) {
							throw new NodeOperationError(
								this.getNode(),
								'draft_config.canvas_config 中的 canvas_width 和 canvas_height 必须是数字',
								{ itemIndex: i },
							);
						}
					}

					if (fps !== undefined && (typeof fps !== 'number' || fps <= 0)) {
						throw new NodeOperationError(this.getNode(), 'draft_config.fps 必须是正数', {
							itemIndex: i,
						});
					}
				}

				// 9. 统计信息
				const stats = {
					rule_count: ruleGroup.rules.length,
					material_count: parsedPresetData.materials.length,
					track_count: testData.tracks.length,
					item_count: testData.items.length,
					mode: parsedPresetData.use_raw_segments ? 'raw_segments' : 'normal',
					has_canvas_config:
						!!parsedPresetData.canvas_width || !!parsedPresetData.draft_config?.canvas_config,
					canvas_size:
						parsedPresetData.canvas_width && parsedPresetData.canvas_height
							? `${parsedPresetData.canvas_width}x${parsedPresetData.canvas_height}`
							: parsedPresetData.draft_config?.canvas_config
								? `${parsedPresetData.draft_config.canvas_config.canvas_width}x${parsedPresetData.draft_config.canvas_config.canvas_height}`
								: 'default',
				};

				returnData.push({
					json: {
						valid: true,
						preset_data: presetDataInput,
						api_base: apiBase,
						stats,
						message: '预设数据校验通过',
					},
					pairedItem: i,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							valid: false,
							error: error.message,
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
