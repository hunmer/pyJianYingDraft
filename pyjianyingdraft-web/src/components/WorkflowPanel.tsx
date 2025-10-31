'use client';

import React, { useState, useMemo  } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  History as HistoryIcon,
  Speed as StatusIcon,
  Code as CodeIcon,
  Schedule as ScheduleIcon,
  ListAlt as EventLogIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { CozeWorkflow, WorkflowExecution, WorkflowExecutionStatus, WorkflowEventLog, CreateTaskRequest } from '@/types/coze';
import WorkflowCard from './WorkflowCard';
import WorkflowExecutionDialog from './WorkflowExecutionDialog';
import WorkflowEventLogsDialog from './WorkflowEventLogsDialog';

interface WorkflowPanelProps {
  workflows: CozeWorkflow[];
  executions: WorkflowExecution[];
  executionHistory: WorkflowExecution[];
  selectedWorkflow: CozeWorkflow | null;
  executing: boolean;
  eventLogs: WorkflowEventLog[];
  onWorkflowSelect: (workflow: CozeWorkflow | null) => void;
  onWorkflowExecute: (workflowId: string, parameters?: Record<string, any>, onEvent?: (event: any) => void) => Promise<any>;
  onExecutionHistoryLoad: (workflowId: string) => void;
  onEventLogsClear: () => void;
  onCreateTask?: (taskData: CreateTaskRequest) => Promise<any>;
  onCreateAndExecuteTask?: (taskData: CreateTaskRequest) => Promise<any>;
  onOpenWorkflowInNewTab?: (workflow: CozeWorkflow) => void; // 打开为新标签页的回调
  accountId?: string; // 账号ID，用于后端API调用
  workspaceId?: string;
}

const WorkflowPanel: React.FC<WorkflowPanelProps> = ({
  workflows,
  executions,
  executionHistory,
  selectedWorkflow,
  executing,
  eventLogs,
  onWorkflowSelect,
  onWorkflowExecute,
  onExecutionHistoryLoad,
  onEventLogsClear,
  onCreateTask,
  onCreateAndExecuteTask,
  onOpenWorkflowInNewTab,
  accountId = 'default',
  workspaceId,
}) => {
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [eventLogsDialogOpen, setEventLogsDialogOpen] = useState(false);
  const [selectedWorkflowForHistory, setSelectedWorkflowForHistory] = useState<CozeWorkflow | null>(null);

  const handleExecuteClick = (workflow: CozeWorkflow) => {
    onWorkflowSelect(workflow);
    setExecutionDialogOpen(true);
  };

  const handleExecutionDialogClose = () => {
    setExecutionDialogOpen(false);
  };

  const handleExecutionConfirm = async (parameters?: Record<string, any>, onEvent?: (event: any) => void) => {
    if (selectedWorkflow) {
      try {
        await onWorkflowExecute(selectedWorkflow.id, parameters, onEvent);
      } catch (error) {
        console.error('工作流执行失败:', error);
      }
    }
    // 不立即关闭对话框，让用户看到执行结果
    // setExecutionDialogOpen(false);
  };

  const handleHistoryClick = (workflow: CozeWorkflow) => {
    setSelectedWorkflowForHistory(workflow);
    onExecutionHistoryLoad(workflow.id);
    setHistoryDialogOpen(true);
  };

  const handleHistoryDialogClose = () => {
    setHistoryDialogOpen(false);
    setSelectedWorkflowForHistory(null);
  };

  const handleEventLogsClick = () => {
    setEventLogsDialogOpen(true);
  };

  const handleEventLogsDialogClose = () => {
    setEventLogsDialogOpen(false);
  };

  const handleClearEventLogs = () => {
    if (eventLogs.length === 0) {
      return;
    }
    onEventLogsClear();
  };

  const getStatusColor = (status: WorkflowExecutionStatus) => {
    switch (status) {
      case WorkflowExecutionStatus.RUNNING:
        return 'warning';
      case WorkflowExecutionStatus.SUCCESS:
        return 'success';
      case WorkflowExecutionStatus.FAILED:
        return 'error';
      case WorkflowExecutionStatus.CANCELLED:
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: WorkflowExecutionStatus) => {
    switch (status) {
      case WorkflowExecutionStatus.RUNNING:
        return '运行中';
      case WorkflowExecutionStatus.SUCCESS:
        return '成功';
      case WorkflowExecutionStatus.FAILED:
        return '失败';
      case WorkflowExecutionStatus.CANCELLED:
        return '已取消';
      default:
        return '未知';
    }
  };

  const getRunningExecutionsCount = () => {
    return executions.filter(e => e.status === WorkflowExecutionStatus.RUNNING).length;
  };

  // 事件日志计数现在由后端管理，不再展示在badge上
  // const eventLogsCount = useMemo(() => eventLogs.length, [eventLogs.length]);

  // 缓存运行中的执行计数
  const runningExecutionsCount = useMemo(() => {
    return executions.filter(e => e.status === WorkflowExecutionStatus.RUNNING).length;
  }, [executions]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* 头部信息 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" component="h2">
          工作流管理
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 运行中的任务计数 */}
          <Badge badgeContent={runningExecutionsCount} color="warning">
            <Tooltip title="运行中的工作流">
              <IconButton size="small">
                <StatusIcon />
              </IconButton>
            </Tooltip>
          </Badge>

          {/* 事件日志按钮 */}
          <Tooltip title="事件日志">
            <IconButton size="small" onClick={handleEventLogsClick}>
              <EventLogIcon />
            </IconButton>
          </Tooltip>

          {/* 清除事件日志按钮 - 仅在有日志时显示 */}
          {eventLogs.length > 0 && (
            <Tooltip title="清除事件日志">
              <IconButton size="small" onClick={handleClearEventLogs}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* 历史记录按钮 */}
          <Tooltip title="执行历史">
            <IconButton size="small" onClick={() => setHistoryDialogOpen(true)}>
              <HistoryIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 正在执行的任务 */}
      {executions.filter(e => e.status === WorkflowExecutionStatus.RUNNING).length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            正在执行
          </Typography>
          <Grid container spacing={1}>
            {executions
              .filter(e => e.status === WorkflowExecutionStatus.RUNNING)
              .map((execution) => (
                <Grid item xs={12} sm={6} md={4} key={execution.id}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LinearProgress sx={{ flex: 1 }} />
                        <Chip
                          label="运行中"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {execution.workflow_name || execution.workflow_id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        开始时间: {new Date(execution.created_time).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Box>
      )}

      {/* 工作流列表 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {workflows.length === 0 ? (
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
              暂无工作流
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              当前工作空间中没有可用的工作流<br />
              请在 Coze 平台中创建工作流后刷新
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {workflows.map((workflow) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={workflow.id}>
                <WorkflowCard
                  workflow={workflow}
                  isSelected={selectedWorkflow?.id === workflow.id}
                  isExecuting={executions.some(e =>
                    e.workflow_id === workflow.id && e.status === WorkflowExecutionStatus.RUNNING
                  )}
                  onExecute={() => handleExecuteClick(workflow)}
                  onHistory={() => handleHistoryClick(workflow)}
                  onSelect={() => onWorkflowSelect(workflow)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* 执行对话框 */}
      <WorkflowExecutionDialog
        open={executionDialogOpen}
        workflow={selectedWorkflow}
        onClose={handleExecutionDialogClose}
        onExecute={onWorkflowExecute}
        onCancel={handleExecutionDialogClose}
        onCreateTask={onCreateTask}
        onCreateAndExecuteTask={onCreateAndExecuteTask}
        onOpenInNewTab={onOpenWorkflowInNewTab ? (workflow) => {
          handleExecutionDialogClose();
          onOpenWorkflowInNewTab(workflow);
        } : undefined}
        accountId={accountId}
        workspaceId={workspaceId}
        eventLogs={eventLogs}
      />

      {/* 执行历史对话框 */}
      <Dialog
        open={historyDialogOpen}
        onClose={handleHistoryDialogClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle>
          {selectedWorkflowForHistory
            ? `${selectedWorkflowForHistory.name} - 执行历史`
            : '工作流执行历史'
          }
        </DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          {executionHistory.length === 0 ? (
            <Box
              sx={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                暂无执行记录
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              {executionHistory.map((execution) => (
                <Card key={execution.id} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {execution.workflow_name || execution.workflow_id}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(execution.created_time).toLocaleString()}
                          </Typography>
                          {execution.completed_time && (
                            <>
                              <Typography variant="caption" color="text.secondary">
                                - {new Date(execution.completed_time).toLocaleString()}
                              </Typography>
                              {execution.duration && (
                                <Typography variant="caption" color="text.secondary">
                                  ({(execution.duration / 1000).toFixed(2)}s)
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </Box>
                      <Chip
                        label={getStatusText(execution.status)}
                        size="small"
                        color={getStatusColor(execution.status) as any}
                        variant="outlined"
                      />
                    </Box>

                    {execution.error_message && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                        错误: {execution.error_message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleHistoryDialogClose}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 事件日志对话框 */}
      <WorkflowEventLogsDialog
        open={eventLogsDialogOpen}
        onClose={handleEventLogsDialogClose}
      />
    </Box>
  );
};

export default React.memo(WorkflowPanel);