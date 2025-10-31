/**
 * useCoZone - 后端 API 版本
 *
 * 完全移除前端账号管理，改用后端 API
 * 账号配置在后端 config.json 中，前端只传递 account_id
 *
 * 主要改动：
 * 1. ✅ 移除所有 localStorage 账号管理
 * 2. ✅ 移除 CozeApiClient 依赖
 * 3. ✅ 所有 API 调用通过后端 /api/coze/*
 * 4. ✅ account_id 作为参数传递给后端 API
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '@/lib/api';
import type {
  CozeWorkspace,
  CozeWorkflow,
  WorkflowExecution,
  WorkflowEventLog,
  Task,
  CreateTaskRequest,
  ExecuteTaskRequest,
  TaskStatistics,
  ExecuteWorkflowResponse,
} from '@/types/coze';

interface UseCoZoneState {
  // 账号数据
  accounts: string[];
  currentAccount: string | null;

  // 基础数据
  workspaces: CozeWorkspace[];
  currentWorkspace: CozeWorkspace | null;
  workflows: CozeWorkflow[];
  executions: WorkflowExecution[];
  executionHistory: WorkflowExecution[];

  // 任务管理数据
  tasks: Task[];
  selectedWorkflowTasks: Task[];
  taskStatistics?: TaskStatistics;

  // 事件日志
  eventLogs: WorkflowEventLog[];

  // 状态
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  executing: boolean;
  taskLoading: boolean;
  taskExecuting: string | null;
  initialized: boolean;

  // 选中的数据
  selectedWorkflow: CozeWorkflow | null;
}

interface UseCoZoneResult extends UseCoZoneState {
  // 账号管理
  loadAccounts: () => Promise<void>;
  switchAccount: (accountId: string) => void;

  // 工作空间管理
  loadWorkspaces: (accountId?: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: (accountId?: string) => Promise<void>;

  // 工作流管理
  loadWorkflows: (workspaceId: string) => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  executeWorkflow: (workflowId: string, parameters?: Record<string, any>) => Promise<ExecuteWorkflowResponse>;
  loadExecutionHistory: (workflowId?: string) => Promise<void>;
  setSelectedWorkflow: (workflow: CozeWorkflow | null) => void;

  // 任务管理
  refreshTasks: (workflowId?: string) => Promise<void>;
  createTask: (taskData: CreateTaskRequest) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  executeTask: (requestData: ExecuteTaskRequest) => Promise<any>;
  getTaskStatistics: (workflowId?: string) => Promise<void>;

  // 事件日志管理
  addEventLog: (event: WorkflowEventLog) => void;
  clearEventLogs: () => void;
  getEventLogs: () => WorkflowEventLog[];

  // 工具方法
  clearError: () => void;
  resetState: () => void;
}

// localStorage 键名
const STORAGE_KEYS = {
  ACCOUNT: 'coze_last_account',
  WORKSPACE: 'coze_last_workspace',
};

export const useCoZone = (initialAccountId?: string): UseCoZoneResult => {
  const [state, setState] = useState<UseCoZoneState>({
    accounts: [],
    currentAccount: null,
    workspaces: [],
    currentWorkspace: null,
    workflows: [],
    executions: [],
    executionHistory: [],
    tasks: [],
    selectedWorkflowTasks: [],
    taskStatistics: undefined,
    eventLogs: [],
    loading: false,
    error: null,
    refreshing: false,
    executing: false,
    taskLoading: false,
    taskExecuting: null,
    initialized: false,
    selectedWorkflow: null,
  });

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventLogsRef = useRef<WorkflowEventLog[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 错误处理
  const handleError = useCallback((error: any) => {
    console.error('CoZone 错误:', error);

    let errorMessage = '操作失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    setState(prev => ({ ...prev, error: errorMessage, loading: false }));
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 重置状态
  const resetState = useCallback(() => {
    setState({
      accounts: [],
      currentAccount: null,
      workspaces: [],
      currentWorkspace: null,
      workflows: [],
      executions: [],
      executionHistory: [],
      tasks: [],
      selectedWorkflowTasks: [],
      taskStatistics: undefined,
      eventLogs: [],
      loading: false,
      error: null,
      refreshing: false,
      executing: false,
      taskLoading: false,
      taskExecuting: null,
      initialized: false,
      selectedWorkflow: null,
    });
  }, []);

  // ==================== 账号管理 ====================

  const loadAccounts = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await api.coze.getAccounts();
      const accounts = response.accounts || [];

      setState(prev => ({
        ...prev,
        accounts,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      handleError(error);
    }
  }, [handleError]);

  const switchAccount = useCallback((accountId: string) => {
    setState(prev => {
      // 保存到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ACCOUNT, accountId);
        // 清除工作空间缓存
        localStorage.removeItem(STORAGE_KEYS.WORKSPACE);
      }

      return {
        ...prev,
        currentAccount: accountId,
        workspaces: [],
        currentWorkspace: null,
        workflows: [],
        executions: [],
        executionHistory: [],
        selectedWorkflow: null,
      };
    });
  }, []);

  // ==================== 工作空间管理 ====================

  const loadWorkspaces = useCallback(async (accId?: string) => {
    const accountId = accId || state.currentAccount;
    if (!accountId) {
      handleError('未选择账号');
      return;
    }
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await api.coze.getWorkspaces(accountId);
      const workspaces = response.workspaces || [];

      setState(current => ({
        ...current,
        workspaces,
        loading: false,
        currentWorkspace: current.currentWorkspace && workspaces.find(w => w.id === current.currentWorkspace?.id)
          ? current.currentWorkspace
          : null
      }));
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      handleError(error);
    }
  }, [state.currentAccount, handleError]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setState(prev => {
      const workspace = prev.workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        // 保存到 localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.WORKSPACE, workspaceId);
        }

        return {
          ...prev,
          currentWorkspace: workspace,
          workflows: [],
          executions: [],
          executionHistory: [],
          selectedWorkflow: null,
        };
      }
      return prev;
    });
  }, []);

  const refreshWorkspaces = useCallback(async (accId?: string) => {
    setState(prev => ({ ...prev, refreshing: true }));
    await loadWorkspaces(accId);
    setState(prev => ({ ...prev, refreshing: false }));
  }, [loadWorkspaces]);

  // ==================== 工作流管理 ====================

  const loadWorkflows = useCallback(async (workspaceId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // 调用后端 API 获取工作流列表
      const response = await api.coze.getWorkflows(workspaceId, state.currentAccountId);
      const workflows: CozeWorkflow[] = response.workflows || [];

      setState(prev => ({ ...prev, workflows, loading: false }));
    } catch (error) {
      handleError(error);
    }
  }, [handleError, state.currentAccountId]);

  const refreshWorkflows = useCallback(async () => {
    if (!state.currentWorkspace) return;

    setState(prev => ({ ...prev, refreshing: true }));
    await loadWorkflows(state.currentWorkspace.id);
    setState(prev => ({ ...prev, refreshing: false }));
  }, [state.currentWorkspace, loadWorkflows]);

  const loadExecutionHistory = useCallback(async (workflowId?: string) => {
    try {
      if (!state.currentWorkspace || !state.currentAccount) return;

      // workflow_id 是必需的路径参数，如果没有则不调用 API
      if (!workflowId) {
        console.warn('loadExecutionHistory: workflowId 为空，跳过加载');
        setState(prev => ({ ...prev, executionHistory: [] }));
        return;
      }

      // 使用后端 API
      const response = await api.coze.getWorkflowHistory(
        workflowId,
        state.currentAccount,
        50,
        1
      );

      // 处理API返回的数据结构，将后端字段映射到前端期望的格式
      const histories: any[] = response.histories || [];
      const transformedHistory: WorkflowExecution[] = histories.map(item => {
        // 从当前工作流列表中查找对应的工作流名称
        const workflow = state.workflows.find(w => w.id === item.workflow_id);

        // API返回的时间戳是微秒级，需要转换为毫秒级
        const createTime = Math.floor(item.create_time / 1000);
        const updateTime = Math.floor(item.update_time / 1000);

        return {
          id: item.execute_id,
          workflow_id: item.workflow_id,
          workflow_name: workflow?.name || item.workflow_id,
          status: item.execute_status === 'success' ? 'success' as const :
                  item.execute_status === 'failed' ? 'failed' as const :
                  item.execute_status === 'running' ? 'running' as const :
                  'cancelled' as const,
          input_data: item.input_parameters,
          output_data: item.output,
          error_message: item.error_message,
          created_time: new Date(createTime).toISOString(),
          completed_time: updateTime ? new Date(updateTime).toISOString() : undefined,
          duration: updateTime && createTime ? updateTime - createTime : undefined,
        };
      });

      setState(prev => ({ ...prev, executionHistory: transformedHistory }));
      console.log('加载执行历史成功:', {
        total: response.total,
        historiesCount: histories.length,
        transformedCount: transformedHistory.length,
        firstItem: transformedHistory[0] || null
      });
    } catch (error) {
      console.error('加载执行历史失败:', error);
    }
  }, [state.currentWorkspace, state.currentAccount, state.workflows]);

  const executeWorkflow = useCallback(async (
    workflowId: string,
    parameters?: Record<string, any>,
    onStreamEvent?: (event: WorkflowStreamEvent) => void
  ): Promise<ExecuteWorkflowResponse> => {
    try {
      if (!state.currentWorkspace) {
        throw new Error('请先选择工作空间');
      }

      setState(prev => ({ ...prev, executing: true, error: null }));

      // 使用后端 API 执行任务（默认使用流式执行）
      const response = await api.coze.executeTask({
        workflowId,
        inputParameters: parameters || {},
        saveAsTask: true,
        taskName: `工作流执行 - ${new Date().toLocaleString()}`,
        useStream: true,
        onEvent: onStreamEvent,
      });

      setState(prev => ({ ...prev, executing: false }));

      return {
        status: 'success',
        message: '执行成功',
        data: response
      };
    } catch (error) {
      setState(prev => ({ ...prev, executing: false }));
      handleError(error);
      throw error;
    }
  }, [state.currentWorkspace, handleError]);

  const setSelectedWorkflow = useCallback((workflow: CozeWorkflow | null) => {
    setState(prev => ({ ...prev, selectedWorkflow: workflow }));
  }, []);

  // ==================== 任务管理 ====================

  const refreshTasks = useCallback(async (workflowId?: string) => {
    setState(prev => ({ ...prev, taskLoading: true, error: null }));

    try {
      const response = await api.coze.getTasks({ workflowId });

      setState(prev => ({
        ...prev,
        tasks: response.tasks || [],
        taskLoading: false,
      }));

      if (workflowId) {
        const workflowTasks = (response.tasks || []).filter(task => task.workflow_id === workflowId);
        setState(prev => ({
          ...prev,
          selectedWorkflowTasks: workflowTasks,
        }));
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        taskLoading: false,
        error: error instanceof Error ? error.message : '刷新任务列表失败',
      }));
    }
  }, []);

  const createTask = useCallback(async (taskData: CreateTaskRequest): Promise<Task> => {
    setState(prev => ({ ...prev, taskLoading: true, error: null }));

    try {
      const task = await api.coze.createTask(taskData);

      setState(prev => ({
        ...prev,
        tasks: [task, ...prev.tasks],
        taskLoading: false,
      }));

      if (state.selectedWorkflow && task.workflow_id === state.selectedWorkflow.id) {
        setState(prev => ({
          ...prev,
          selectedWorkflowTasks: [task, ...prev.selectedWorkflowTasks],
        }));
      }

      return task;

    } catch (error) {
      setState(prev => ({
        ...prev,
        taskLoading: false,
        error: error instanceof Error ? error.message : '创建任务失败',
      }));
      throw error;
    }
  }, [state.selectedWorkflow]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    try {
      const updatedTask = await api.coze.updateTask(taskId, updates);

      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => task.id === taskId ? updatedTask : task),
        selectedWorkflowTasks: prev.selectedWorkflowTasks.map(task =>
          task.id === taskId ? updatedTask : task
        ),
      }));

      return updatedTask;

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '更新任务失败',
      }));
      throw error;
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await api.coze.deleteTask(taskId);

      setState(prev => ({
        ...prev,
        tasks: prev.tasks.filter(task => task.id !== taskId),
        selectedWorkflowTasks: prev.selectedWorkflowTasks.filter(task => task.id !== taskId),
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '删除任务失败',
      }));
      throw error;
    }
  }, []);

  const executeTask = useCallback(async (requestData: ExecuteTaskRequest) => {
    setState(prev => ({
      ...prev,
      taskExecuting: requestData.task_id || 'new',
      error: null
    }));

    try {
      const result = await api.coze.executeTask(requestData);

      // 刷新任务列表
      await refreshTasks(requestData.workflowId);

      return result;

    } catch (error) {
      setState(prev => ({
        ...prev,
        taskExecuting: null,
        error: error instanceof Error ? error.message : '执行任务失败',
      }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, taskExecuting: null }));
    }
  }, [refreshTasks]);

  const getTaskStatistics = useCallback(async (workflowId?: string) => {
    try {
      const statistics = await api.coze.getTaskStatistics(workflowId);

      setState(prev => ({
        ...prev,
        taskStatistics: statistics,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '获取任务统计失败',
      }));
    }
  }, []);

  // ==================== 事件日志管理 ====================

  const addEventLog = useCallback((event: WorkflowEventLog) => {
    eventLogsRef.current = [...eventLogsRef.current, event];

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        eventLogs: [...eventLogsRef.current],
      }));
      updateTimeoutRef.current = null;
    }, 100);
  }, []);

  const getEventLogs = useCallback(() => {
    return state.eventLogs.length > 0 ? state.eventLogs : eventLogsRef.current;
  }, [state.eventLogs]);

  const clearEventLogs = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    setState(prev => ({ ...prev, eventLogs: [] }));
    eventLogsRef.current = [];
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, []);

  // 初始化逻辑（仅执行一次）
  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. 加载账号列表
        await loadAccounts();

        // 2. 恢复上次选择的账号（或使用初始账号）
        let accountToUse = initialAccountId;
        if (typeof window !== 'undefined') {
          const lastAccount = localStorage.getItem(STORAGE_KEYS.ACCOUNT);
          if (lastAccount) {
            accountToUse = lastAccount;
          }
        }

        // 3. 设置当前账号
        if (accountToUse) {
          setState(prev => ({ ...prev, currentAccount: accountToUse }));
        }

        setState(prev => ({ ...prev, initialized: true }));
      } catch (error) {
        console.error('初始化失败:', error);
        setState(prev => ({ ...prev, initialized: true }));
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在挂载时执行一次

  // 当前账号变化时，自动加载工作空间
  useEffect(() => {
    const loadData = async () => {
      if (state.currentAccount && state.initialized) {
        // 加载工作空间列表
        await loadWorkspaces(state.currentAccount);

        // 尝试恢复上次选择的工作空间
        if (typeof window !== 'undefined') {
          const lastWorkspaceId = localStorage.getItem(STORAGE_KEYS.WORKSPACE);
          if (lastWorkspaceId) {
            // 延迟一下，确保工作空间列表已加载
            setTimeout(() => {
              setState(prev => {
                const workspace = prev.workspaces.find(w => w.id === lastWorkspaceId);
                if (workspace) {
                  return { ...prev, currentWorkspace: workspace };
                }
                return prev;
              });
            }, 100);
          }
        }
      }
    };

    loadData();
  }, [state.currentAccount, state.initialized]);

  // 当前工作空间变化时，加载对应数据
  useEffect(() => {
    if (state.currentWorkspace) {
      loadWorkflows(state.currentWorkspace.id);
      // 注意：不在这里加载执行历史，因为需要先选中工作流
      // loadExecutionHistory() 会在选中工作流后调用
      refreshTasks();
    }
  }, [state.currentWorkspace]);

  // 当任务列表变化时，更新选中工作流的任务列表
  useEffect(() => {
    if (state.selectedWorkflow) {
      const workflowTasks = state.tasks.filter(task => task.workflow_id === state.selectedWorkflow?.id);
      setState(prev => ({
        ...prev,
        selectedWorkflowTasks: workflowTasks,
      }));
    }
  }, [state.selectedWorkflow, state.tasks]);

  // 选中工作流变化时，加载统计和执行历史
  useEffect(() => {
    if (state.selectedWorkflow) {
      getTaskStatistics(state.selectedWorkflow.id);
      loadExecutionHistory(state.selectedWorkflow.id);
    } else {
      // 清空执行历史
      setState(prev => ({ ...prev, executionHistory: [], selectedWorkflowTasks: [] }));
    }
  }, [state.selectedWorkflow, getTaskStatistics, loadExecutionHistory]);

  return {
    ...state,
    loadAccounts,
    switchAccount,
    loadWorkspaces,
    switchWorkspace,
    refreshWorkspaces,
    loadWorkflows,
    refreshWorkflows,
    executeWorkflow,
    loadExecutionHistory,
    setSelectedWorkflow,
    refreshTasks,
    createTask,
    updateTask,
    deleteTask,
    executeTask,
    getTaskStatistics,
    addEventLog,
    clearEventLogs,
    getEventLogs,
    clearError,
    resetState,
  };
};

export default useCoZone;
