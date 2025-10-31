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

  // 选中的数据
  selectedWorkflow: CozeWorkflow | null;
}

interface UseCoZoneResult extends UseCoZoneState {
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

export const useCoZone = (accountId: string = 'default'): UseCoZoneResult => {
  const [state, setState] = useState<UseCoZoneState>({
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
      selectedWorkflow: null,
    });
  }, []);

  // ==================== 工作空间管理 ====================

  const loadWorkspaces = useCallback(async (accId: string = accountId) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await api.coze.getWorkspaces(accId);
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
  }, [accountId, handleError]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setState(prev => {
      const workspace = prev.workspaces.find(w => w.id === workspaceId);
      if (workspace) {
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

  const refreshWorkspaces = useCallback(async (accId: string = accountId) => {
    setState(prev => ({ ...prev, refreshing: true }));
    await loadWorkspaces(accId);
    setState(prev => ({ ...prev, refreshing: false }));
  }, [accountId, loadWorkspaces]);

  // ==================== 工作流管理 ====================

  const loadWorkflows = useCallback(async (workspaceId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // TODO: 实现后端 API 获取工作流列表
      console.warn('loadWorkflows: 需要实现后端 API');
      const workflows: CozeWorkflow[] = [];

      setState(prev => ({ ...prev, workflows, loading: false }));
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  const refreshWorkflows = useCallback(async () => {
    if (!state.currentWorkspace) return;

    setState(prev => ({ ...prev, refreshing: true }));
    await loadWorkflows(state.currentWorkspace.id);
    setState(prev => ({ ...prev, refreshing: false }));
  }, [state.currentWorkspace, loadWorkflows]);

  const loadExecutionHistory = useCallback(async (workflowId?: string) => {
    try {
      if (!state.currentWorkspace) return;

      // 使用后端 API
      const response = await api.coze.getWorkflowHistory(
        workflowId || '',
        accountId,
        50,
        1
      );

      const history: WorkflowExecution[] = response.history || [];
      setState(prev => ({ ...prev, executionHistory: history }));
    } catch (error) {
      console.error('加载执行历史失败:', error);
    }
  }, [state.currentWorkspace, accountId]);

  const executeWorkflow = useCallback(async (
    workflowId: string,
    parameters?: Record<string, any>
  ): Promise<ExecuteWorkflowResponse> => {
    try {
      if (!state.currentWorkspace) {
        throw new Error('请先选择工作空间');
      }

      setState(prev => ({ ...prev, executing: true, error: null }));

      // 使用后端 API 执行任务
      const response = await api.coze.executeTask({
        workflowId,
        inputParameters: parameters || {},
        saveAsTask: true,
        taskName: `工作流执行 - ${new Date().toLocaleString()}`,
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

  // 当前工作空间变化时，加载对应数据
  useEffect(() => {
    if (state.currentWorkspace) {
      loadWorkflows(state.currentWorkspace.id);
      loadExecutionHistory();
      refreshTasks();
    }
  }, [state.currentWorkspace]);

  // 选中工作流变化时，更新任务列表和统计
  useEffect(() => {
    if (state.selectedWorkflow) {
      const workflowTasks = state.tasks.filter(task => task.workflow_id === state.selectedWorkflow?.id);
      setState(prev => ({
        ...prev,
        selectedWorkflowTasks: workflowTasks,
      }));

      getTaskStatistics(state.selectedWorkflow.id);
    }
  }, [state.selectedWorkflow, state.tasks]);

  return {
    ...state,
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
