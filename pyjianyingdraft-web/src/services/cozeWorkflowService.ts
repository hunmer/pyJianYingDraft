import { WorkflowStreamEvent, CozeWorkflowApiResponse, CozeWorkflow } from '@/types/coze';

export interface CozeWorkflowExecuteOptions {
  apiBase: string;
  apiKey: string;
  botId?: string;
  conversationId?: string;
  userId?: string;
  stream?: boolean;
  onEvent?: (event: WorkflowStreamEvent) => void;
  signal?: AbortSignal;
}

export class CozeWorkflowService {
  /**
   * 流式执行工作流
   */
  static async executeWorkflowStream(
    workflowId: string,
    parameters: Record<string, any>,
    options: CozeWorkflowExecuteOptions
  ): Promise<void> {
    const {
      apiBase,
      apiKey,
      botId,
      conversationId,
      userId,
      stream = true,
      onEvent,
      signal,
    } = options;

    // 构建请求 URL
    const url = new URL(`${apiBase}/v1/workflow/stream_run`);

    // 构建请求体
    const requestBody = {
      workflow_id: workflowId,
      parameters,
      conversation_id: conversationId,
      bot_id: botId,
      user_id: userId,
      stream,
    };

    try {
      // 发送流式请求
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': stream ? 'text/event-stream' : 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (stream) {
        await this.handleStreamResponse(response, onEvent);
      } else {
        await this.handleNormalResponse(response, onEvent);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 请求被取消，这是正常情况
        return;
      }

      // 发送错误事件
      onEvent?.({
        event: 'error',
        data: {
          message: error instanceof Error ? error.message : '未知错误',
          type: 'network_error'
        },
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * 获取工作流详细信息
   * 参考文档: https://www.coze.cn/open/docs/developer_guides/get_workflow_info
   */
  static async getWorkflowInfo(
    workflowId: string,
    apiBase: string,
    apiKey: string,
    includeInputOutput: boolean = true
  ): Promise<CozeWorkflow> {
    const url = new URL(`${apiBase}/v1/workflows/${workflowId}`);
    if (includeInputOutput) {
      url.searchParams.append('include_input_output', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: CozeWorkflowApiResponse = await response.json();
    if (result.code !== 0) {
      throw new Error(`API Error ${result.code}: ${result.msg}`);
    }

    // 转换API返回格式为内部使用的格式
    const { workflow_detail, input, output } = result.data;

    // 将Coze API的参数格式转换为JSON Schema格式
    const convertToSchema = (cozeInput?: CozeWorkflowInput) => {
      if (!cozeInput?.parameters) return undefined;

      const schema: any = {
        type: 'object',
        properties: {},
        required: [],
      };

      for (const [key, param] of Object.entries(cozeInput.parameters)) {
        const prop: any = {
          type: param.type,
          title: key,
          description: param.description,
        };

        if (param.default_value !== undefined) {
          prop.default = param.default_value;
        }

        if (param.type === 'array' && param.items) {
          prop.items = param.items;
        }

        if (param.type === 'object' && param.properties) {
          prop.properties = param.properties;
        }

        schema.properties[key] = prop;

        if (param.required) {
          schema.required.push(key);
        }
      }

      return schema;
    };

    const convertOutputToSchema = (cozeOutput?: CozeWorkflowOutput) => {
      if (!cozeOutput?.parameters) return undefined;

      const schema: any = {
        type: 'object',
        properties: {},
      };

      for (const [key, param] of Object.entries(cozeOutput.parameters)) {
        schema.properties[key] = {
          type: param.type,
          title: key,
        };
      }

      return schema;
    };

    // 构建返回的工作流对象
    const workflow: CozeWorkflow = {
      id: workflow_detail.workflow_id,
      name: workflow_detail.workflow_name,
      description: workflow_detail.description,
      created_time: new Date(workflow_detail.created_at * 1000).toISOString(),
      updated_time: new Date(workflow_detail.updated_at * 1000).toISOString(),
      version: 1, // API不返回版本信息，使用默认值
      input_schema: convertToSchema(input),
      output_schema: convertOutputToSchema(output),
      status: 'active', // API不返回状态信息，使用默认值
      icon_url: workflow_detail.icon_url,
      app_id: workflow_detail.app_id,
      creator_id: workflow_detail.creator.id,
      creator_name: workflow_detail.creator.name,
    };

    return workflow;
  }

  /**
   * 处理流式响应
   */
  private static async handleStreamResponse(
    response: Response,
    onEvent?: (event: WorkflowStreamEvent) => void
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // 保留最后一行（可能不完整）
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const eventData = JSON.parse(data);
              const streamEvent = this.parseStreamEvent(eventData);
              if (streamEvent) {
                onEvent?.(streamEvent);
              }
            } catch (error) {
              console.warn('解析事件数据失败:', error, 'Raw data:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 处理普通响应
   */
  private static async handleNormalResponse(
    response: Response,
    onEvent?: (event: WorkflowStreamEvent) => void
  ): Promise<void> {
    const result = await response.json();

    // 发送工作流开始事件
    onEvent?.({
      event: 'workflow_started',
      data: {
        conversation_id: result.conversation_id,
        workflow_id: result.data?.workflow_id,
      },
      timestamp: new Date().toISOString(),
    });

    // 发送工作流完成事件
    onEvent?.({
      event: 'workflow_finished',
      data: result.data || result,
      conversation_id: result.conversation_id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 解析流式事件
   */
  private static parseStreamEvent(eventData: any): WorkflowStreamEvent | null {
    // Coze 流式响应格式可能变化，这里处理常见的几种格式
    const timestamp = new Date().toISOString();

    if (eventData.type === 'workflow_started') {
      return {
        event: 'workflow_started',
        data: eventData.data || {},
        conversation_id: eventData.conversation_id,
        workflow_id: eventData.workflow_id,
        timestamp,
      };
    }

    if (eventData.type === 'workflow_finished') {
      return {
        event: 'workflow_finished',
        data: eventData.data || eventData.output || {},
        conversation_id: eventData.conversation_id,
        workflow_id: eventData.workflow_id,
        timestamp,
      };
    }

    if (eventData.type === 'node_started') {
      return {
        event: 'node_started',
        data: eventData.data || {},
        node_id: eventData.node_id,
        conversation_id: eventData.conversation_id,
        timestamp,
      };
    }

    if (eventData.type === 'node_finished') {
      return {
        event: 'node_finished',
        data: eventData.data || {},
        node_id: eventData.node_id,
        conversation_id: eventData.conversation_id,
        timestamp,
      };
    }

    if (eventData.type === 'error') {
      return {
        event: 'error',
        data: eventData.data || { message: '执行出错' },
        conversation_id: eventData.conversation_id,
        timestamp,
      };
    }

    if (eventData.type === 'message' || eventData.type === 'data') {
      return {
        event: eventData.type,
        data: eventData.data || {},
        conversation_id: eventData.conversation_id,
        timestamp,
      };
    }

    // 未知事件类型，作为通用数据事件处理
    return {
      event: 'data',
      data: eventData,
      timestamp,
    };
  }

  /**
   * 获取工作流执行历史
   */
  static async getWorkflowExecutions(
    workflowId: string,
    apiBase: string,
    apiKey: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<any> {
    const url = new URL(`${apiBase}/v1/workflow/list_runs`);
    url.searchParams.append('workflow_id', workflowId);

    if (options.limit) url.searchParams.append('limit', options.limit.toString());
    if (options.offset) url.searchParams.append('offset', options.offset.toString());
    if (options.status) url.searchParams.append('status', options.status);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`API Error ${result.code}: ${result.message}`);
    }

    return result.data;
  }

  /**
   * 取消工作流执行
   */
  static async cancelWorkflowExecution(
    conversationId: string,
    apiBase: string,
    apiKey: string
  ): Promise<void> {
    const url = new URL(`${apiBase}/v1/workflow/cancel_run`);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`API Error ${result.code}: ${result.message}`);
    }
  }
}