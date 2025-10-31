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
  Assignment as TaskIcon,
} from '@mui/icons-material';
import { CozeZoneTabData, CreateTaskRequest } from '@/types/coze';
import { useCoZone } from '@/hooks/useCoZone';
import CozeZoneToolbar from './CozeZoneToolbar';
import WorkflowPanel from './WorkflowPanel';
import WorkflowMonitor from './WorkflowMonitor';
import TaskManagementPanel from './TaskManagementPanel';

interface CozeZoneProps {
  tab: CozeZoneTabData;
  onTabUpdate?: (tabId: string, updates: Partial<CozeZoneTabData>) => void;
  onCreateWorkflowExecutionTab?: (workflow: any, callbacks: {
    onExecute: (workflowId: string, parameters: Record<string, any>, onStreamEvent?: (event: any) => void) => Promise<any>;
    onCancel: () => void;
    onCreateTask?: (taskData: any) => Promise<any>;
    onCreateAndExecuteTask?: (taskData: any) => Promise<any>;
  }) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: 'workflow' | 'monitor' | 'tasks';
  value: 'workflow' | 'monitor' | 'tasks';
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

const CozeZone: React.FC<CozeZoneProps> = ({ tab, onTabUpdate, onCreateWorkflowExecutionTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'workflow' | 'monitor' | 'tasks'>('workflow');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  const {
    // 账号状态
    accounts,
    currentAccount,

    // 状态
    workspaces,
    currentWorkspace,
    workflows,
    executions,
    executionHistory,
    eventLogs,
    loading,
    error,
    refreshing,
    executing,
    selectedWorkflow,

    // 账号管理
    switchAccount,

    // 工作空间管理
    loadWorkspaces,
    switchWorkspace,
    refreshWorkspaces,

    // 工作流管理
    loadWorkflows,
    refreshWorkflows,
    executeWorkflow,
    loadExecutionHistory,
    setSelectedWorkflow,

    // 事件日志管理
    addEventLog,
    clearEventLogs,
    getEventLogs,

    // 工具方法
    clearError,
    resetState,
  } = useCoZone(); // 不传参数，从 localStorage 恢复或使用默认

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
  }, []);

  // 处理账号切换
  const handleAccountSwitch = useCallback((accountId: string) => {
    switchAccount(accountId);
    showMessage('账号切换成功', 'success');
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
  const handleWorkflowExecute = useCallback(async (
    workflowId: string,
    parameters?: Record<string, any>,
    onStreamEvent?: (event: WorkflowStreamEvent) => void
  ) => {
    try {
      const response = await executeWorkflow(workflowId, parameters, onStreamEvent);
      showMessage('工作流执行已启动', 'success');
      return response;
    } catch (error) {
      showMessage('工作流执行失败', 'error');
      throw error;
    }
  }, [executeWorkflow, showMessage]);

  // 处理创建任务（不执行）
  const handleCreateTask = useCallback(async (taskData: CreateTaskRequest) => {
    try {
      // 导入 API 客户端
      const api = (await import('@/lib/api')).default;

      // 创建任务请求
      const task = await api.coze.createTask(taskData);

      showMessage('任务创建成功', 'success');
      return task;
    } catch (error: any) {
      showMessage(`任务创建失败: ${error.message}`, 'error');
      throw error;
    }
  }, [showMessage]);

  // 处理创建并执行任务
  const handleCreateAndExecuteTask = useCallback(async (taskData: CreateTaskRequest) => {
    try {
      // 导入 API 客户端
      const api = (await import('@/lib/api')).default;

      // 执行任务（会自动创建任务）
      const result = await api.coze.executeTask({
        workflowId: taskData.workflowId,
        inputParameters: taskData.inputParameters,
        saveAsTask: true,
        taskName: taskData.name,
        taskDescription: taskData.description,
      });

      showMessage('任务创建并执行成功', 'success');
      return result;
    } catch (error: any) {
      showMessage(`任务执行失败: ${error.message}`, 'error');
      throw error;
    }
  }, [showMessage]);


  // 清除错误
  const handleErrorClose = useCallback(() => {
    clearError();
  }, [clearError]);

  // 更新 tab 数据
  useEffect(() => {
    if (onTabUpdate) {
      onTabUpdate(tab.id, {
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
    workspaces,
    workflows,
    executions,
    executionHistory,
    selectedWorkflow,
    refreshing,
    executing,
    error,
  ]);

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
          variant="fullWidth"
          aria-label="Coze Zone 子标签页"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': {
              minHeight: 48,
              py: 1,
              flex: 1,
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
          <Tab
            value="tasks"
            label="任务管理"
            icon={<TaskIcon />}
            iconPosition="start"
            disabled={!currentWorkspace}
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
        {!currentWorkspace && (
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
              {workspaces.length === 0
                ? '请确保后端 config.json 中已配置 Coze API Token'
                : '在上方工具栏中选择要使用的工作空间'
              }
            </Typography>
          </Box>
        )}

        {/* 内容面板 */}
        {currentWorkspace && (
          <>
            <TabPanel value={activeSubTab} index="workflow">
              <WorkflowPanel
                workflows={workflows}
                executions={executions}
                executionHistory={executionHistory}
                selectedWorkflow={selectedWorkflow}
                executing={executing}
                eventLogs={eventLogs}
                onWorkflowSelect={setSelectedWorkflow}
                onWorkflowExecute={handleWorkflowExecute}
                onCreateTask={handleCreateTask}
                onCreateAndExecuteTask={handleCreateAndExecuteTask}
                onExecutionHistoryLoad={loadExecutionHistory}
                onEventLogsClear={clearEventLogs}
                onOpenWorkflowInNewTab={onCreateWorkflowExecutionTab ? (workflow) => {
                  onCreateWorkflowExecutionTab(workflow, {
                    onExecute: handleWorkflowExecute,
                    onCancel: () => {},
                    onCreateTask: handleCreateTask,
                    onCreateAndExecuteTask: handleCreateAndExecuteTask,
                  });
                } : undefined}
                accountId={currentAccount}
                workspaceId={currentWorkspace?.id}
              />
            </TabPanel>

            <TabPanel value={activeSubTab} index="monitor">
              <WorkflowMonitor
                workflows={workflows}
                selectedWorkflow={selectedWorkflow}
                onWorkflowSelect={setSelectedWorkflow}
              />
            </TabPanel>

            <TabPanel value={activeSubTab} index="tasks">
              <TaskManagementPanel
                workflowId={selectedWorkflow?.id}
                onTaskExecute={(task) => {
                  // 可以在这里处理任务执行后的逻辑，比如刷新工作流状态
                  console.log('任务已执行:', task);
                }}
              />
            </TabPanel>
          </>
        )}
      </Box>

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
