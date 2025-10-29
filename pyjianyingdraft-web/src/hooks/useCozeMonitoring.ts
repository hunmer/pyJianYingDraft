'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  WorkflowMonitorState,
  WorkflowMonitorData,
  CozeSubscribeRequest,
  CozeUnsubscribeRequest,
} from '@/types/coze';
import { socketCozeApi } from '@/lib/socket';

interface UseCozeMonitoringResult extends WorkflowMonitorState {
  // 监控管理
  startMonitoring: (clientId: string, workflowId?: string, workflowName?: string) => Promise<void>;
  stopMonitoring: (clientId: string) => Promise<void>;
  stopAllMonitoring: () => Promise<void>;

  // 数据管理
  markAsRead: (dataId: string) => void;
  markAllAsRead: (clientId?: string) => void;
  clearData: (clientId?: string) => void;

  // 工作流选择
  selectWorkflow: (workflowId: string) => void;
  getFilteredData: () => WorkflowMonitorData[];
}

export const useCozeMonitoring = (): UseCozeMonitoringResult => {
  const [state, setState] = useState<WorkflowMonitorState>({
    monitoredWorkflows: [],
    subscribedClientIds: [],
    monitorData: [],
    isMonitoring: false,
    totalDataReceived: 0,
    unreadDataCount: 0,
  });

  // WebSocket事件监听器的清理函数引用
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // 清理所有事件监听器
  useEffect(() => {
    return () => {
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, []);

  // 添加监控的工作流
  const addMonitoredWorkflow = useCallback((
    clientId: string,
    workflowId?: string,
    workflowName?: string
  ) => {
    setState(prev => {
      // 检查是否已经在监控
      const existing = prev.monitoredWorkflows.find(
        w => w.clientId === clientId && w.workflowId === workflowId
      );

      if (existing) {
        // 更新现有工作流
        return {
          ...prev,
          monitoredWorkflows: prev.monitoredWorkflows.map(w =>
            w.clientId === clientId && w.workflowId === workflowId
              ? { ...w, isActive: true, lastDataReceived: undefined }
              : w
          ),
        };
      }

      // 添加新的监控工作流
      const newWorkflow = {
        workflowId: workflowId || `workflow_${Date.now()}`,
        workflowName: workflowName || `工作流 ${prev.monitoredWorkflows.length + 1}`,
        clientId,
        isActive: true,
        startedAt: new Date().toISOString(),
        dataCount: 0,
      };

      return {
        ...prev,
        monitoredWorkflows: [...prev.monitoredWorkflows, newWorkflow],
        subscribedClientIds: [...new Set([...prev.subscribedClientIds, clientId])],
        isMonitoring: true,
      };
    });
  }, []);

  // 移除监控的工作流
  const removeMonitoredWorkflow = useCallback((clientId: string, workflowId?: string) => {
    setState(prev => {
      const updatedWorkflows = prev.monitoredWorkflows.filter(
        w => !(w.clientId === clientId && w.workflowId === workflowId)
      );

      // 计算剩余的clientId列表
      const remainingClientIds = new Set(updatedWorkflows.map(w => w.clientId));

      return {
        ...prev,
        monitoredWorkflows: updatedWorkflows,
        subscribedClientIds: Array.from(remainingClientIds),
        isMonitoring: updatedWorkflows.length > 0,
      };
    });
  }, []);

  // 添加监控数据
  const addMonitorData = useCallback((data: WorkflowMonitorData) => {
    setState(prev => {
      // 更新对应工作流的数据计数
      const updatedWorkflows = prev.monitoredWorkflows.map(w => {
        if (w.clientId === data.clientId && (!data.workflowId || w.workflowId === data.workflowId)) {
          return {
            ...w,
            dataCount: w.dataCount + 1,
            lastDataReceived: data.receivedAt,
          };
        }
        return w;
      });

      return {
        ...prev,
        monitorData: [data, ...prev.monitorData].slice(0, 1000), // 限制最多保存1000条数据
        monitoredWorkflows: updatedWorkflows,
        totalDataReceived: prev.totalDataReceived + 1,
        unreadDataCount: prev.unreadDataCount + 1,
      };
    });
  }, []);

  // 开始监控
  const startMonitoring = useCallback(async (
    clientId: string,
    workflowId?: string,
    workflowName?: string
  ) => {
    try {
      console.log(`🚀 开始监控Coze工作流: clientId=${clientId}, workflowId=${workflowId}`);

      // 订阅WebSocket
      const request: CozeSubscribeRequest = {
        clientId,
        workflowId,
      };

      await socketCozeApi.subscribe(request);

      // 添加到监控列表
      addMonitoredWorkflow(clientId, workflowId, workflowName);

      // 设置事件监听器
      const cleanupDataUpdate = socketCozeApi.onDataUpdate((data) => {
        if (data.clientId === clientId) {
          addMonitorData(data);
        }
      });

      const cleanupStatusChange = socketCozeApi.onSubscribeStatusChange((status) => {
        if (status.client_id === clientId) {
          console.log(`📊 Coze监控状态变化: clientId=${clientId}, status=${status.message}`);
        }
      });

      const cleanupError = socketCozeApi.onSubscribeError((error) => {
        if (error.client_id === clientId) {
          console.error(`❌ Coze监控错误: clientId=${clientId}, error=${error.error}`);
        }
      });

      // 保存清理函数
      cleanupFunctionsRef.current.push(cleanupDataUpdate, cleanupStatusChange, cleanupError);

      console.log(`✅ Coze工作流监控已启动: clientId=${clientId}`);

    } catch (error) {
      console.error(`❌ 启动Coze工作流监控失败: clientId=${clientId}`, error);
      throw error;
    }
  }, [addMonitoredWorkflow, addMonitorData]);

  // 停止监控
  const stopMonitoring = useCallback(async (clientId: string) => {
    try {
      console.log(`🛑 停止监控Coze工作流: clientId=${clientId}`);

      // 取消订阅
      const request: CozeUnsubscribeRequest = {
        clientId,
      };

      await socketCozeApi.unsubscribe(request);

      // 从监控列表移除
      removeMonitoredWorkflow(clientId);

      console.log(`✅ Coze工作流监控已停止: clientId=${clientId}`);

    } catch (error) {
      console.error(`❌ 停止Coze工作流监控失败: clientId=${clientId}`, error);
      throw error;
    }
  }, [removeMonitoredWorkflow]);

  // 停止所有监控
  const stopAllMonitoring = useCallback(async () => {
    const clientIds = [...state.subscribedClientIds];

    for (const clientId of clientIds) {
      try {
        await stopMonitoring(clientId);
      } catch (error) {
        console.error(`停止监控失败: clientId=${clientId}`, error);
      }
    }

    // 清理所有事件监听器
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    cleanupFunctionsRef.current = [];

    // 重置状态
    setState({
      monitoredWorkflows: [],
      subscribedClientIds: [],
      monitorData: [],
      isMonitoring: false,
      totalDataReceived: 0,
      unreadDataCount: 0,
    });
  }, [state.subscribedClientIds, stopMonitoring]);

  // 标记数据为已读
  const markAsRead = useCallback((dataId: string) => {
    setState(prev => ({
      ...prev,
      monitorData: prev.monitorData.map(data =>
        data.id === dataId ? { ...data, isRead: true } : data
      ),
      unreadDataCount: Math.max(0, prev.unreadDataCount - 1),
    }));
  }, []);

  // 标记所有数据为已读
  const markAllAsRead = useCallback((clientId?: string) => {
    setState(prev => {
      let updatedData = prev.monitorData;
      let markedCount = 0;

      if (clientId) {
        // 只标记指定客户端的数据
        updatedData = prev.monitorData.map(data => {
          if (data.clientId === clientId && !data.isRead) {
            markedCount++;
            return { ...data, isRead: true };
          }
          return data;
        });
      } else {
        // 标记所有数据
        markedCount = prev.unreadDataCount;
        updatedData = prev.monitorData.map(data => ({ ...data, isRead: true }));
      }

      return {
        ...prev,
        monitorData: updatedData,
        unreadDataCount: Math.max(0, prev.unreadDataCount - markedCount),
      };
    });
  }, []);

  // 清除数据
  const clearData = useCallback((clientId?: string) => {
    setState(prev => {
      if (clientId) {
        // 只清除指定客户端的数据
        return {
          ...prev,
          monitorData: prev.monitorData.filter(data => data.clientId !== clientId),
        };
      } else {
        // 清除所有数据
        return {
          ...prev,
          monitorData: [],
          totalDataReceived: 0,
          unreadDataCount: 0,
        };
      }
    });
  }, []);

  // 选择工作流
  const selectWorkflow = useCallback((workflowId: string) => {
    setState(prev => ({
      ...prev,
      selectedWorkflowId: workflowId,
    }));
  }, []);

  // 获取过滤后的数据
  const getFilteredData = useCallback(() => {
    if (!state.selectedWorkflowId) {
      return state.monitorData;
    }

    // 找到选中的工作流对应的clientId
    const selectedWorkflow = state.monitoredWorkflows.find(
      w => w.workflowId === state.selectedWorkflowId
    );

    if (!selectedWorkflow) {
      return [];
    }

    // 返回对应clientId的数据
    return state.monitorData.filter(data => data.clientId === selectedWorkflow.clientId);
  }, [state.selectedWorkflowId, state.monitoredWorkflows, state.monitorData]);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    stopAllMonitoring,
    markAsRead,
    markAllAsRead,
    clearData,
    selectWorkflow,
    getFilteredData,
  };
};