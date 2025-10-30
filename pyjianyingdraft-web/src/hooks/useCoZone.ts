'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * API基础配置 - 添加fallback机制防止undefined
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
import {
  CozeAccount,
  CozeWorkspace,
  CozeWorkflow,
  WorkflowExecution,
  WorkflowExecutionStatus,
  CozeZoneTabData,
  ExecuteWorkflowResponse,
  WorkflowEventLog,
  Task,
  TaskStatus,
  ExecutionStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
  ExecuteTaskRequest,
  TaskFilter,
  TaskListResponse,
  TaskStatistics,
} from '@/types/coze';
import { CozeApiClient, CozeApiError, CozeErrorCode } from '@/lib/coze-api';
import { WorkflowEvent, WorkflowEventType, WorkflowEventInterrupt } from '@coze/api';

interface UseCoZoneState {
  // 基础数据
  accounts: CozeAccount[];
  currentAccount: CozeAccount | null;
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
  // 账号管理
  addAccount: (account: Omit<CozeAccount, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  deleteAccount: (accountId: string) => void;
  updateAccount: (accountId: string, updates: Partial<CozeAccount>) => void;
  validateAccount: (apiKey: string, baseUrl?: string) => Promise<boolean>;

  // 工作空间管理
  loadWorkspaces: (accountId: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;

  // 工作流管理
  loadWorkflows: (workspaceId: string) => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  executeWorkflow: (workflowId: string, parameters?: Record<string, any>, onEvent?: (event: any) => void) => Promise<ExecuteWorkflowResponse>;
  pollExecutionStatus: (executionId: string) => Promise<void>;
  loadExecutionHistory: (workflowId?: string) => Promise<void>;
  setSelectedWorkflow: (workflow: CozeWorkflow | null) => void;

  // 任务管理
  refreshTasks: (workflowId?: string) => Promise<void>;
  createTask: (taskData: CreateTaskRequest) => Promise<Task>;
  updateTask: (taskId: string, updates: UpdateTaskRequest) => Promise<Task>;
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
  getClient: () => CozeApiClient | null;
}

const STORAGE_KEYS = {
  ACCOUNTS: 'coze_accounts',
  CURRENT_ACCOUNT: 'coze_current_account',
  CURRENT_WORKSPACE: 'coze_current_workspace',
};

export const useCoZone = (tabId?: string): UseCoZoneResult => {
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
    selectedWorkflow: null,
  });

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clientRef = useRef<CozeApiClient | null>(null);

  // 从 localStorage 恢复数据
  useEffect(() => {
    const savedAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    const savedCurrentAccount = localStorage.getItem(STORAGE_KEYS.CURRENT_ACCOUNT);
    const savedCurrentWorkspace = localStorage.getItem(STORAGE_KEYS.CURRENT_WORKSPACE);

    if (savedAccounts) {
      try {
        const accounts = JSON.parse(savedAccounts);
        setState(prev => ({ ...prev, accounts }));
      } catch (e) {
        console.error('恢复账号列表失败:', e);
      }
    }

    if (savedCurrentAccount) {
      try {
        const currentAccount = JSON.parse(savedCurrentAccount);
        setState(prev => ({ ...prev, currentAccount }));
        // 创建 API 客户端
        clientRef.current = new CozeApiClient(currentAccount.apiKey, currentAccount.baseUrl);
      } catch (e) {
        console.error('恢复当前账号失败:', e);
      }
    }

    if (savedCurrentWorkspace) {
      try {
        const currentWorkspace = JSON.parse(savedCurrentWorkspace);
        setState(prev => ({ ...prev, currentWorkspace }));
      } catch (e) {
        console.error('恢复当前工作空间失败:', e);
      }
    }
  }, []);

  // 保存数据到 localStorage
  const saveAccounts = useCallback((accounts: CozeAccount[] | ((prev: CozeAccount[]) => CozeAccount[])) => {
    setState(prev => {
      const newAccounts = typeof accounts === 'function' ? accounts(prev.accounts) : accounts;
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(newAccounts));
      return { ...prev, accounts: newAccounts };
    });
  }, []);

  const saveCurrentAccount = useCallback((account: CozeAccount | null) => {
    if (account) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ACCOUNT, JSON.stringify(account));
      clientRef.current = new CozeApiClient(account.apiKey, account.baseUrl);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ACCOUNT);
      clientRef.current = null;
    }
    setState(prev => ({ ...prev, currentAccount: account }));
  }, []);

  const saveCurrentWorkspace = useCallback((workspace: CozeWorkspace | null) => {
    if (workspace) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_WORKSPACE, JSON.stringify(workspace));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_WORKSPACE);
    }
    setState(prev => ({ ...prev, currentWorkspace: workspace }));
  }, []);

  // 错误处理
  const handleError = useCallback((error: any) => {
    console.error('CoZone 错误:', error);

    let errorMessage = '操作失败';
    if (error instanceof CozeApiError) {
      errorMessage = error.getUserFriendlyMessage();
    } else if (error instanceof Error) {
      errorMessage = error.message;
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
      files: [],
      executions: [],
      executionHistory: [],
      loading: false,
      error: null,
      refreshing: false,
      executing: false,
      selectedWorkflow: null,
    });
  }, []);

  // 获取当前客户端
  const getClient = useCallback(() => {
    return clientRef.current;
  }, []);

  // ==================== 基础工具函数 ====================

  const validateAccount = useCallback(async (apiKey: string, baseUrl?: string): Promise<boolean> => {
    try {
      const client = new CozeApiClient(apiKey, baseUrl);
      return await client.testConnection();
    } catch (error) {
      console.error('账号验证失败:', error);
      return false;
    }
  }, []);

  // ==================== 工作空间管理 ====================

  const loadWorkspaces = useCallback(async (accountId: string) => {
    try {
      setState(prev => {
        const account = prev.accounts.find(acc => acc.id === accountId);
        if (!account) {
          throw new Error('账号不存在');
        }
        return { ...prev, loading: true, error: null };
      });

      const account = state.accounts.find(acc => acc.id === accountId);
      if (!account) {
        throw new Error('账号不存在');
      }

      const client = new CozeApiClient(account.apiKey, account.baseUrl);
      const workspaces = await client.getWorkspaces();

      setState(current => ({
        ...current,
        workspaces,
        loading: false,
        // 如果当前工作空间不在列表中，清除选择
        currentWorkspace: current.currentWorkspace && workspaces.find(w => w.id === current.currentWorkspace?.id)
          ? current.currentWorkspace
          : null
      }));
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      handleError(error);
    }
  }, [handleError, state.accounts]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setState(prev => {
      const workspace = prev.workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        saveCurrentWorkspace(workspace);
        // 切换工作空间时清除数据
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
  }, [saveCurrentWorkspace]);

  const refreshWorkspaces = useCallback(async () => {
    if (!state.currentAccount) return;

    setState(prev => ({ ...prev, refreshing: true }));
    await loadWorkspaces(state.currentAccount.id);
    setState(prev => ({ ...prev, refreshing: false }));
  }, [state.currentAccount, loadWorkspaces]);

  // ==================== 工作流管理辅助函数 ====================

  const loadExecutionHistory = useCallback(async (workflowId?: string) => {
    try {
      if (!clientRef.current || !state.currentWorkspace) return;

      const history = await clientRef.current.getWorkflowExecutionHistory(
        state.currentWorkspace.id,
        workflowId,
        50,
        1
      );

      setState(prev => ({ ...prev, executionHistory: history }));
    } catch (error) {
      console.error('加载执行历史失败:', error);
    }
  }, [state.currentWorkspace]);

  const pollExecutionStatus = useCallback(async (executionId: string, workflowId?: string) => {
    if (!clientRef.current || !state.currentWorkspace) return;

    const poll = async () => {
      try {
        const execution = await clientRef.current!.getWorkflowExecutionStatus(
          state.currentWorkspace!.id,
          executionId,
          workflowId
        );

        setState(prev => ({
          ...prev,
          executions: prev.executions.map(e => e.id === executionId ? execution : e),
        }));

        // 如果执行完成，停止轮询
        if (execution.status === WorkflowExecutionStatus.SUCCESS ||
            execution.status === WorkflowExecutionStatus.FAILED ||
            execution.status === WorkflowExecutionStatus.CANCELLED) {
          if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }
          // 加载执行历史
          await loadExecutionHistory();
        } else {
          // 继续轮询
          pollingTimerRef.current = setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('轮询执行状态失败:', error);
        if (pollingTimerRef.current) {
          clearTimeout(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }
    };

    // 开始轮询
    poll();
  }, [state.currentWorkspace, loadExecutionHistory]);

  // ==================== 账号管理 ====================

  const addAccount = useCallback(async (accountData: Omit<CozeAccount, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // 验证 API 密钥
      const isValid = await validateAccount(accountData.apiKey, accountData.baseUrl);
      if (!isValid) {
        throw new Error('API 密钥验证失败，请检查配置');
      }

      const newAccount: CozeAccount = {
        ...accountData,
        id: `account_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveAccounts(prev => [...prev, newAccount]);
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      handleError(error);
    }
  }, [validateAccount, saveAccounts, handleError]);

  const updateAccount = useCallback((accountId: string, updates: Partial<CozeAccount>) => {
    saveAccounts(prev => {
      const updatedAccounts = prev.map(account =>
        account.id === accountId
          ? { ...account, ...updates, updatedAt: new Date().toISOString() }
          : account
      );

      // 如果更新的是当前账号，也要更新当前账号
      if (state.currentAccount?.id === accountId) {
        const updatedAccount = updatedAccounts.find(acc => acc.id === accountId);
        if (updatedAccount) {
          saveCurrentAccount(updatedAccount);
        }
      }

      return updatedAccounts;
    });
  }, [state.currentAccount, saveAccounts, saveCurrentAccount]);

  const switchAccount = useCallback(async (accountId: string) => {
    try {
      setState(prev => {
        const account = prev.accounts.find(acc => acc.id === accountId);
        if (!account) {
          throw new Error('账号不存在');
        }

        saveCurrentAccount(account);
        loadWorkspaces(accountId);
        return { ...prev, loading: true };
      });
    } catch (error) {
      handleError(error);
    }
  }, [saveCurrentAccount, loadWorkspaces, handleError]);

  const deleteAccount = useCallback((accountId: string) => {
    saveAccounts(prev => {
      const updatedAccounts = prev.filter(acc => acc.id !== accountId);

      // 如果删除的是当前账号，清除当前状态
      if (state.currentAccount?.id === accountId) {
        saveCurrentAccount(null);
        saveCurrentWorkspace(null);
        setState(current => ({
          ...current,
          workspaces: [],
          workflows: [],
          executions: [],
          executionHistory: [],
          selectedWorkflow: null,
        }));
      }

      return updatedAccounts;
    });
  }, [state.currentAccount, saveAccounts, saveCurrentAccount]);

  // ==================== 工作流管理 ====================

  const loadWorkflows = useCallback(async (workspaceId: string) => {
    try {
      if (!clientRef.current) {
        throw new Error('API 客户端未初始化');
      }

      setState(prev => ({ ...prev, loading: true, error: null }));
      const workflows = await clientRef.current.getWorkflows(workspaceId);
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

  // 使用 useRef 来存储事件日志，避免频繁的状态更新
  const eventLogsRef = useRef<WorkflowEventLog[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 事件日志管理方法 - 使用防抖机制减少状态更新频率
  const addEventLog = useCallback((event: WorkflowEventLog) => {
    eventLogsRef.current = [...eventLogsRef.current, event];

    // 清除之前的定时器
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // 设置新的定时器来批量更新状态
    updateTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        eventLogs: [...eventLogsRef.current], // 创建新的数组引用
      }));
      updateTimeoutRef.current = null;
    }, 100); // 100ms 防抖延迟，给用户更好的响应体验
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

  // 将 WorkflowEvent 转换为 WorkflowEventLog
  const convertEventToLog = useCallback((
    event: WorkflowEvent,
    workflowId: string,
    executeId?: string,
    workflowName?: string
  ): WorkflowEventLog => {
    const timestamp = new Date().toISOString();

    let level: 'info' | 'warning' | 'error' | 'success' = 'info';
    let message = '';

    switch (event.event) {
      case WorkflowEventType.INTERRUPT:
        level = 'warning';
        message = `工作流需要用户输入: ${(event as WorkflowEventInterrupt).interrupt_data.type}`;
        break;
      case WorkflowEventType.MESSAGE:
        level = 'info';
        const eventData = event as any;
        if (eventData.data) {
          if (eventData.data.node_title) {
            message = `工作流消息 - ${eventData.data.node_title}`;
          } else if (eventData.data.node_type) {
            message = `工作流消息 - ${eventData.data.node_type}`;
          } else {
            message = '工作流消息';
          }
        } else {
          message = '工作流消息';
        }
        break;
      default:
        if (event.event.includes('started')) {
          level = 'info';
          message = '开始执行';
        } else if (event.event.includes('finished') || event.event.includes('completed')) {
          level = 'success';
          message = '执行完成';
        } else if (event.event.includes('error') || event.event.includes('failed')) {
          level = 'error';
          message = '执行失败';
        }
        break;
    }

    return {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      executeId,
      workflowId,
      workflowName,
      event: event.event,
      data: event.data,
      timestamp,
      level,
      message,
      details: event,
    };
  }, []);

  const executeWorkflow = useCallback(async (
    workflowId: string,
    parameters?: Record<string, any>,
    onEvent?: (event: any) => void
  ): Promise<ExecuteWorkflowResponse> => {
    try {
      if (!clientRef.current || !state.currentWorkspace) {
        throw new Error('请先选择工作空间');
      }

      setState(prev => ({ ...prev, executing: true, error: null }));

      // 获取工作流名称用于日志
      const workflow = state.workflows.find(w => w.id === workflowId);
      const workflowName = workflow?.name || workflowId;

      // 添加开始执行日志
      addEventLog({
        id: `log_${Date.now()}_start`,
        workflowId,
        workflowName,
        event: 'workflow_execution_start',
        data: { parameters },
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '开始执行工作流',
      });

      // 使用流式执行
      const response = await clientRef.current.executeWorkflowStream(
        state.currentWorkspace.id,
        {
          workflow_id: workflowId,
          parameters,
        },
        (event: WorkflowEvent) => {
          // 将每个事件转换为日志并添加到状态中
          const eventLog = convertEventToLog(event, workflowId, undefined, workflowName);
          addEventLog(eventLog);

          // 如果有外部回调，也调用它
          if (onEvent) {
            onEvent(event);
          }
        }
      );

      // 添加完成日志
      addEventLog({
        id: `log_${Date.now()}_end`,
        executeId: response.data?.id,
        workflowId,
        workflowName,
        event: 'workflow_execution_complete',
        data: response.data,
        timestamp: new Date().toISOString(),
        level: response.status === 'success' ? 'success' : 'error',
        message: response.status === 'success' ? '工作流执行成功' : '工作流执行失败',
      });

      // 对于流式执行，将结果添加到执行列表
      if (response.data) {
        const execution: WorkflowExecution = {
          id: response.data.id,
          workflow_id: workflowId,
          workflow_name: workflowName,
          status: response.data.status,
          input_data: response.data.input_data,
          output_data: response.data.output_data,
          created_time: response.data.created_time,
          completed_time: new Date().toISOString(),
        };

        setState(prev => ({
          ...prev,
          executions: [...prev.executions, execution],
        }));

        // 加载执行历史
        await loadExecutionHistory();
      }

      setState(prev => ({ ...prev, executing: false }));

      // 返回执行结果给调用者
      return response;
    } catch (error) {
      // 添加错误日志
      addEventLog({
        id: `log_${Date.now()}_error`,
        workflowId,
        event: 'workflow_execution_error',
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        level: 'error',
        message: '工作流执行出错',
      });

      setState(prev => ({ ...prev, executing: false }));
      handleError(error);
      throw error;
    }
  }, [state.currentWorkspace, state.workflows, handleError, loadExecutionHistory, addEventLog, convertEventToLog]);

  const setSelectedWorkflow = useCallback((workflow: CozeWorkflow | null) => {
    setState(prev => ({ ...prev, selectedWorkflow: workflow }));
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

  // ==================== 任务管理方法 ====================

  // 刷新任务列表
  const refreshTasks = useCallback(async (workflowId?: string) => {
    setState(prev => ({ ...prev, taskLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/coze/tasks${workflowId ? `?workflow_id=${workflowId}` : ''}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TaskListResponse = await response.json();

      setState(prev => ({
        ...prev,
        tasks: data.tasks,
        taskLoading: false,
      }));

      // 如果��定了工作流ID，更新选中工作流的任务列表
      if (workflowId) {
        const workflowTasks = data.tasks.filter(task => task.workflow_id === workflowId);
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

  // 创建任务
  const createTask = useCallback(async (taskData: CreateTaskRequest): Promise<Task> => {
    setState(prev => ({ ...prev, taskLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/coze/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newTask: Task = await response.json();

      setState(prev => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
        taskLoading: false,
      }));

      // 如果是当前选中工作流的任务，更新选中工作流的任务列表
      if (state.selectedWorkflow && newTask.workflow_id === state.selectedWorkflow.id) {
        setState(prev => ({
          ...prev,
          selectedWorkflowTasks: [newTask, ...prev.selectedWorkflowTasks],
        }));
      }

      return newTask;

    } catch (error) {
      setState(prev => ({
        ...prev,
        taskLoading: false,
        error: error instanceof Error ? error.message : '创建任务失败',
      }));
      throw error;
    }
  }, [state.selectedWorkflow]);

  // 更新任务
  const updateTask = useCallback(async (taskId: string, updates: UpdateTaskRequest): Promise<Task> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coze/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const updatedTask: Task = await response.json();

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

  // 删除任务
  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coze/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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

  // 执行任务
  const executeTask = useCallback(async (requestData: ExecuteTaskRequest) => {
    setState(prev => ({
      ...prev,
      taskExecuting: requestData.task_id || 'new',
      error: null
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/coze/tasks/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // 刷新任务列表以获取最新状态
      await refreshTasks(requestData.workflow_id);

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

  // 获取任务统计
  const getTaskStatistics = useCallback(async (workflowId?: string) => {
    try {
      const url = workflowId
        ? `${API_BASE_URL}/api/coze/tasks/statistics?workflow_id=${workflowId}`
        : `${API_BASE_URL}/api/coze/tasks/statistics`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const statistics: TaskStatistics = await response.json();

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

  // 当前账号或工作空间变化时，加载对应数据
  useEffect(() => {
    if (state.currentAccount && state.currentWorkspace) {
      loadWorkflows(state.currentWorkspace.id);
      loadExecutionHistory();
      refreshTasks(); // 加载所有任务
    }
  }, [state.currentAccount, state.currentWorkspace, loadWorkflows, loadExecutionHistory, refreshTasks]);

  // 选中工作流变化时，更新任务列表和统计
  useEffect(() => {
    if (state.selectedWorkflow) {
      // 筛选当前工作流的任务
      const workflowTasks = state.tasks.filter(task => task.workflow_id === state.selectedWorkflow?.id);
      setState(prev => ({
        ...prev,
        selectedWorkflowTasks: workflowTasks,
      }));

      // 获取统计信息
      getTaskStatistics(state.selectedWorkflow.id);
    }
  }, [state.selectedWorkflow, state.tasks, getTaskStatistics]);

  return {
    ...state,
    addAccount,
    switchAccount,
    deleteAccount,
    updateAccount,
    validateAccount,
    loadWorkspaces,
    switchWorkspace,
    refreshWorkflows,
    loadWorkflows,
    refreshWorkflows,
    executeWorkflow,
    pollExecutionStatus,
    loadExecutionHistory,
    setSelectedWorkflow,
    addEventLog,
    clearEventLogs,
    getEventLogs,
    clearError,
    resetState,
    getClient,
    // 任务管理方法
    refreshTasks,
    createTask,
    updateTask,
    deleteTask,
    executeTask,
    getTaskStatistics,
  };
};
