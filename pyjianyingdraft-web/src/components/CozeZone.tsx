'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  AccountTree as WorkflowIcon,
  Assessment as MonitorIcon,
} from '@mui/icons-material';
import { CozeZoneTabData } from '@/types/coze';
import { useCoZone } from '@/hooks/useCoZone';
import CozeZoneToolbar from './CozeZoneToolbar';
import WorkflowPanel from './WorkflowPanel';
import AccountManager from './AccountManager';
import WorkflowMonitor from './WorkflowMonitor';

interface CozeZoneProps {
  tab: CozeZoneTabData;
  onTabUpdate?: (tabId: string, updates: Partial<CozeZoneTabData>) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: 'workflow' | 'monitor';
  value: 'workflow' | 'monitor';
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`coze-zone-tabpanel-${index}`}
      aria-labelledby={`coze-zone-tab-${index}`}
      style={{ height: '100%', display: value === index ? 'flex' : 'none', flexDirection: 'column' }}
    >
      {value === index && children}
    </div>
  );
}

const CozeZone: React.FC<CozeZoneProps> = ({ tab, onTabUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState<'workflow' | 'monitor'>('workflow');
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  const {
    // 状态
    accounts,
    currentAccount,
    workspaces,
    currentWorkspace,
    workflows,
    executions,
    executionHistory,
    loading,
    error,
    refreshing,
    executing,
    selectedWorkflow,

    // 账号管理
    addAccount,
    switchAccount,
    deleteAccount,
    updateAccount,
    validateAccount,

    // 工作空间管理
    loadWorkspaces,
    switchWorkspace,
    refreshWorkspaces,

    // 工作流管理
    loadWorkflows,
    refreshWorkflows,
    executeWorkflow,
    pollExecutionStatus,
    loadExecutionHistory,
    setSelectedWorkflow,

    // 工具方法
    clearError,
    resetState,
    getClient,
  } = useCoZone(tab.id);

  // 显示消息
  const showMessage = useCallback((message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // 关闭消息
  const closeSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // 处理子标签页切换
  const handleSubTabChange = useCallback((event: React.SyntheticEvent, newValue: 'workflow' | 'monitor') => {
    setActiveSubTab(newValue);
    if (onTabUpdate) {
      onTabUpdate(tab.id, { activeSubTab: newValue });
    }
  }, [tab.id, onTabUpdate]);

  // 处理账号管理器
  const handleAccountManager = useCallback(() => {
    setAccountManagerOpen(true);
  }, []);

  const handleAccountManagerClose = useCallback(() => {
    setAccountManagerOpen(false);
  }, []);

  // 处理账号切换
  const handleAccountSwitch = useCallback(async (accountId: string) => {
    try {
      await switchAccount(accountId);
      showMessage('账号切换成功', 'success');
    } catch (error) {
      showMessage('账号切换失败', 'error');
    }
  }, [switchAccount, showMessage]);

  // 处理工作空间切换
  const handleWorkspaceSwitch = useCallback((workspaceId: string) => {
    switchWorkspace(workspaceId);
    showMessage('工作空间切换成功', 'success');
  }, [switchWorkspace, showMessage]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    try {
      await refreshWorkflows();
      await refreshWorkspaces();
      showMessage('刷新成功', 'success');
    } catch (error) {
      console.error(error)
      showMessage('刷新失败', 'error');
    }
  }, [refreshWorkflows, refreshWorkspaces, showMessage]);

  // 处理工作流执行
  const handleWorkflowExecute = useCallback(async (workflowId: string, parameters?: Record<string, any>) => {
    try {
      await executeWorkflow(workflowId, parameters);
      showMessage('工作流执行已启动', 'success');
    } catch (error) {
      showMessage('工作流执行失败', 'error');
    }
  }, [executeWorkflow, showMessage]);

  
  // 处理账号添加
  const handleAccountAdd = useCallback(async (accountData: any) => {
    try {
      await addAccount(accountData);
      showMessage('账号添加成功', 'success');
    } catch (error) {
      showMessage('账号添加失败', 'error');
    }
  }, [addAccount, showMessage]);

  // 处理账号删除
  const handleAccountDelete = useCallback((accountId: string) => {
    deleteAccount(accountId);
    showMessage('账号删除成功', 'success');
  }, [deleteAccount, showMessage]);

  // 处理账号更新
  const handleAccountUpdate = useCallback((accountId: string, updates: any) => {
    updateAccount(accountId, updates);
    showMessage('账号更新成功', 'success');
  }, [updateAccount, showMessage]);

  // 清除错误
  const handleErrorClose = useCallback(() => {
    clearError();
  }, [clearError]);

  // 更新 tab 数据
  useEffect(() => {
    if (onTabUpdate) {
      onTabUpdate(tab.id, {
        accounts,
        workspaces,
        workflows,
        executions,
        executionHistory,
        selectedWorkflow: selectedWorkflow || undefined,
        refreshing,
        executing,
        error,
      });
    }
  }, [
    tab.id,
    onTabUpdate,
    accounts,
    workspaces,
    workflows,
    executions,
    executionHistory,
    selectedWorkflow,
    refreshing,
    executing,
    error,
  ]);

  // 同步初始状态
  useEffect(() => {
    setActiveSubTab(tab.activeSubTab || 'workflow');
  }, [tab.activeSubTab]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <CozeZoneToolbar
        accounts={accounts}
        currentAccount={currentAccount}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        refreshing={refreshing}
        onAccountSwitch={handleAccountSwitch}
        onWorkspaceSwitch={handleWorkspaceSwitch}
        onRefresh={handleRefresh}
        onAccountManager={handleAccountManager}
      />

      {/* 错误提示 */}
      {error && (
        <Alert
          severity="error"
          onClose={handleErrorClose}
          sx={{ m: 1, mt: 0 }}
        >
          {error}
        </Alert>
      )}

      {/* 子标签页 */}
      <Paper
        square
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Tabs
          value={activeSubTab}
          onChange={handleSubTabChange}
          aria-label="Coze Zone 子标签页"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': {
              minHeight: 48,
              py: 1,
            },
          }}
        >
          <Tab
            value="workflow"
            label="工作流"
            icon={<WorkflowIcon />}
            iconPosition="start"
            disabled={!currentWorkspace}
          />
          <Tab
            value="monitor"
            label="工作流监控"
            icon={<MonitorIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* 内容区域 */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* 加载状态 */}
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1000,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={40} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                加载中...
              </Typography>
            </Box>
          </Box>
        )}

        {/* 空状态 */}
        {!currentAccount && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              请先配置 Coze 账号
            </Typography>
            <Typography variant="body2" color="text.secondary">
              点击右上角的"账号管理"按钮添加账号
            </Typography>
          </Box>
        )}

        {!currentWorkspace && currentAccount && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              请选择工作空间
            </Typography>
            <Typography variant="body2" color="text.secondary">
              在上方工具栏中选择要使用的工作空间
            </Typography>
          </Box>
        )}

        {/* 内容面板 */}
        {currentAccount && currentWorkspace && (
          <>
            <TabPanel value="workflow" index="workflow">
              <WorkflowPanel
                workflows={workflows}
                executions={executions}
                executionHistory={executionHistory}
                selectedWorkflow={selectedWorkflow}
                executing={executing}
                onWorkflowSelect={setSelectedWorkflow}
                onWorkflowExecute={handleWorkflowExecute}
                onExecutionHistoryLoad={loadExecutionHistory}
              />
            </TabPanel>

            <TabPanel value="monitor" index="monitor">
              <WorkflowMonitor
                workflows={workflows}
                selectedWorkflow={selectedWorkflow}
                onWorkflowSelect={setSelectedWorkflow}
              />
            </TabPanel>
          </>
        )}
      </Box>

      {/* 账号管理对话框 */}
      <AccountManager
        open={accountManagerOpen}
        accounts={accounts}
        onClose={handleAccountManagerClose}
        onAccountAdd={handleAccountAdd}
        onAccountDelete={handleAccountDelete}
        onAccountUpdate={handleAccountUpdate}
        onAccountValidate={validateAccount}
      />

      {/* 消息提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CozeZone;