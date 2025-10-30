import { useState, useRef } from 'react';
import { CozeWorkflowExecuteOptions } from '@/services/cozeWorkflowService';
import { CozeWorkflow, WorkflowStreamEvent, WorkflowStreamState } from '@/types/coze';

interface UseWorkflowExecutionOptions {
  apiBase: string;
  apiKey: string;
  botId?: string;
  userId?: string;
}

export const useWorkflowExecution = (options: UseWorkflowExecutionOptions) => {
  const [streamState, setStreamState] = useState<WorkflowStreamState>({
    isStreaming: false,
    events: [],
    status: 'running',
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const executeWorkflow = async (
    workflow: CozeWorkflow,
    parameters: Record<string, any>,
    streamEnabled: boolean = true
  ): Promise<void> => {
    if (!workflow?.id) {
      throw new Error('工作流 ID 不能为空');
    }

    try {
      // 重置状态
      setStreamState({
        isStreaming: true,
        events: [],
        status: 'running',
        startTime: new Date().toISOString(),
      });

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();

      // 动态导入服务以避免循环依赖
      const { CozeWorkflowService } = await import('@/services/cozeWorkflowService');

      // 执行工作流
      await CozeWorkflowService.executeWorkflowStream(workflow.id, parameters, {
        apiBase: options.apiBase,
        apiKey: options.apiKey,
        botId: options.botId,
        userId: options.userId,
        stream: streamEnabled,
        signal: abortControllerRef.current.signal,
        onEvent: (event: WorkflowStreamEvent) => {
          setStreamState(prev => {
            const newEvents = [...prev.events, event];
            const newState = {
              ...prev,
              events: newEvents,
              currentStep: event.node_id || prev.currentStep,
            };

            // 处理特殊事件
            if (event.event === 'workflow_started') {
              conversationIdRef.current = event.conversation_id || null;
            } else if (event.event === 'workflow_finished') {
              newState.status = 'completed';
              newState.endTime = event.timestamp;
              newState.output = event.data;
            } else if (event.event === 'error') {
              newState.status = 'failed';
              newState.endTime = event.timestamp;
              newState.error = event.data?.message || '执行出错';
            }

            return newState;
          });
        },
      });

    } catch (error) {
      console.error('工作流执行失败:', error);

      // 如果不是手动取消的错误，添加错误事件
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setStreamState(prev => ({
          ...prev,
          status: 'failed',
          endTime: new Date().toISOString(),
          error: error instanceof Error ? error.message : '未知错误',
          isStreaming: false,
        }));
      }
    }
  };

  const cancelExecution = async (): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (conversationIdRef.current) {
      try {
        const { CozeWorkflowService } = await import('@/services/cozeWorkflowService');
        await CozeWorkflowService.cancelWorkflowExecution(
          conversationIdRef.current,
          options.apiBase,
          options.apiKey
        );
      } catch (error) {
        console.warn('取消工作流执行失败:', error);
      }
    }

    setStreamState(prev => ({
      ...prev,
      status: 'cancelled',
      endTime: new Date().toISOString(),
      isStreaming: false,
    }));
  };

  const resetState = (): void => {
    setStreamState({
      isStreaming: false,
      events: [],
      status: 'running',
    });
    conversationIdRef.current = null;
    abortControllerRef.current = null;
  };

  return {
    streamState,
    executeWorkflow,
    cancelExecution,
    resetState,
    isExecuting: streamState.isStreaming,
  };
};