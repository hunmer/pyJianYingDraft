'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  CozeAccount,
  CozeWorkspace,
  CozeWorkflow,
  WorkflowExecution,
  WorkflowExecutionStatus,
  CozeZoneTabData,
} from '@/types/coze';
import { CozeApiClient, CozeApiError, CozeErrorCode } from '@/lib/coze-api';

interface UseCoZoneState {
  // 基础数据
  accounts: CozeAccount[];
  currentAccount: CozeAccount | null;
  workspaces: CozeWorkspace[];
  currentWorkspace: CozeWorkspace | null;
  workflows: CozeWorkflow[];
  executions: WorkflowExecution[];
  executionHistory: WorkflowExecution[];

  // 状态
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  executing: boolean;

  // 选中的数据
  selectedWorkflow: CozeWorkflow | null;
  activeSubTab: 'workflow';
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
  executeWorkflow: (workflowId: string, parameters?: Record<string, any>) => Promise<void>;
  pollExecutionStatus: (executionId: string) => Promise<void>;
  loadExecutionHistory: (workflowId?: string) => Promise<void>;
  setSelectedWorkflow: (workflow: CozeWorkflow | null) => void;

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
    loading: false,
    error: null,
    refreshing: false,
    executing: false,
    selectedWorkflow: null,
    activeSubTab: 'workflow',
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
      uploading: false,
      selectedWorkflow: null,
      activeSubTab: 'workflow',
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

  const pollExecutionStatus = useCallback(async (executionId: string) => {
    if (!clientRef.current || !state.currentWorkspace) return;

    const poll = async () => {
      try {
        const execution = await clientRef.current!.getWorkflowExecutionStatus(
          state.currentWorkspace!.id,
          executionId
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

  const executeWorkflow = useCallback(async (workflowId: string, parameters?: Record<string, any>) => {
    try {
      if (!clientRef.current || !state.currentWorkspace) {
        throw new Error('请先选择工作空间');
      }

      setState(prev => ({ ...prev, executing: true, error: null }));

      const response = await clientRef.current.executeWorkflow(state.currentWorkspace.id, {
        workflow_id: workflowId,
        parameters,
        stream: false,
      });

      // 开始轮询执行状态
      if (response.data?.id) {
        await pollExecutionStatus(response.data.id);
      }

      setState(prev => ({ ...prev, executing: false }));
    } catch (error) {
      setState(prev => ({ ...prev, executing: false }));
      handleError(error);
    }
  }, [state.currentWorkspace, handleError, pollExecutionStatus]);

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
    };
  }, []);

  // 当前账号或工作空间变化时，加载对应数据
  useEffect(() => {
    if (state.currentAccount && state.currentWorkspace) {
      loadWorkflows(state.currentWorkspace.id);
      loadExecutionHistory();
    }
  }, [state.currentAccount, state.currentWorkspace, loadWorkflows, loadExecutionHistory]);

  return {
    ...state,
    addAccount,
    switchAccount,
    deleteAccount,
    updateAccount,
    validateAccount,
    loadWorkspaces,
    switchWorkspace,
    refreshWorkspaces,
    loadWorkflows,
    refreshWorkflows,
    executeWorkflow,
    pollExecutionStatus,
    loadExecutionHistory,
    setSelectedWorkflow,
    clearError,
    resetState,
    getClient,
  };
};