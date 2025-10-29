'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Grid2 as Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  ClearAll as ClearAllIcon,
  MarkEmailRead as MarkReadIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { CozeWorkflow } from '@/types/coze';
import { useCozeMonitoring } from '@/hooks/useCozeMonitoring';
import DataDisplayGrid from './DataDisplayGrid';

interface WorkflowMonitorProps {
  workflows: CozeWorkflow[];
  selectedWorkflow: CozeWorkflow | null;
  onWorkflowSelect: (workflow: CozeWorkflow) => void;
}

interface StartMonitorDialogProps {
  open: boolean;
  workflow: CozeWorkflow | null;
  clientId: string;
  onClose: () => void;
  onConfirm: (clientId: string) => void;
}

const StartMonitorDialog: React.FC<StartMonitorDialogProps> = ({
  open,
  workflow,
  clientId,
  onClose,
  onConfirm,
}) => {
  const [localClientId, setLocalClientId] = useState(clientId);

  const handleConfirm = () => {
    if (localClientId.trim()) {
      onConfirm(localClientId.trim());
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        启动工作流监控
        {workflow && ` - ${workflow.name}`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label="客户端ID (Client ID)"
            placeholder="输入唯一的客户端标识符"
            value={localClientId}
            onChange={(e) => setLocalClientId(e.target.value)}
            helperText="此ID将用于识别和接收来自Coze插件的数据"
            margin="normal"
          />
          {workflow && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>工作流:</strong> {workflow.name}
              </Typography>
              <Typography variant="body2">
                <strong>ID:</strong> {workflow.id}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                监控启动后，系统将接收所有发送到此客户端ID的Coze数据。
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!localClientId.trim()}>
          启动监控
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const WorkflowMonitor: React.FC<WorkflowMonitorProps> = ({
  workflows,
  selectedWorkflow,
  onWorkflowSelect,
}) => {
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedWorkflowForMonitor, setSelectedWorkflowForMonitor] = useState<CozeWorkflow | null>(null);
  const [tempClientId, setTempClientId] = useState('');

  const {
    monitoredWorkflows,
    isMonitoring,
    totalDataReceived,
    unreadDataCount,
    startMonitoring,
    stopMonitoring,
    stopAllMonitoring,
    markAllAsRead,
    clearData,
    selectWorkflow,
    getFilteredData,
  } = useCozeMonitoring();

  const filteredData = getFilteredData();

  // 处理启动监控
  const handleStartMonitoring = async (workflow?: CozeWorkflow) => {
    const workflowToMonitor = workflow || selectedWorkflow;
    if (!workflowToMonitor) {
      return;
    }

    setSelectedWorkflowForMonitor(workflowToMonitor);
    setTempClientId(`client_${workflowToMonitor.id}_${Date.now()}`);
    setStartDialogOpen(true);
  };

  const handleConfirmStartMonitoring = async (clientId: string) => {
    if (selectedWorkflowForMonitor) {
      try {
        await startMonitoring(
          clientId,
          selectedWorkflowForMonitor.id,
          selectedWorkflowForMonitor.name
        );

        // 自动选择这个工作流进行过滤
        selectWorkflow(selectedWorkflowForMonitor.id);
      } catch (error) {
        console.error('启动监控失败:', error);
      }
    }
  };

  // 处理停止监控
  const handleStopMonitoring = async (clientId: string) => {
    try {
      await stopMonitoring(clientId);
    } catch (error) {
      console.error('停止监控失败:', error);
    }
  };

  // 处理停止所有监控
  const handleStopAllMonitoring = async () => {
    try {
      await stopAllMonitoring();
    } catch (error) {
      console.error('停止所有监控失败:', error);
    }
  };

  // 处理工作流选择
  const handleWorkflowSelect = (workflowId: string) => {
    selectWorkflow(workflowId);
    const workflow = workflows.find(w => w.id === workflowId);
    if (workflow) {
      onWorkflowSelect(workflow);
    }
  };

  // 获取当前选中的监控工作流
  const getCurrentMonitoredWorkflow = () => {
    return monitoredWorkflows.find(w => w.workflowId === selectedWorkflow?.id);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* 头部工具栏 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {/* 工作流选择 */}
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>选择工作流</InputLabel>
                <Select
                  value={String(selectedWorkflow?.id || '')}
                  label="选择工作流"
                  onChange={(e) => handleWorkflowSelect(String(e.target.value))}
                >
                  {workflows.map((workflow) => (
                    <MenuItem key={workflow.id} value={String(workflow.id)}>
                      {workflow.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 监控控制按钮 */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<StartIcon />}
                  onClick={() => handleStartMonitoring()}
                  disabled={!selectedWorkflow}
                  size="small"
                >
                  启动监控
                </Button>

                {monitoredWorkflows.length > 0 && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleStopAllMonitoring}
                    size="small"
                  >
                    停止所有
                  </Button>
                )}

                <Button
                  variant="outlined"
                  startIcon={<MarkReadIcon />}
                  onClick={() => markAllAsRead()}
                  disabled={unreadDataCount === 0}
                  size="small"
                >
                  标记已读
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<ClearAllIcon />}
                  onClick={() => clearData()}
                  disabled={filteredData.length === 0}
                  size="small"
                >
                  清除数据
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 监控状态和统计 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* 监控状态 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                监控状态
                <Badge
                  badgeContent={isMonitoring ? '运行中' : '已停止'}
                  color={isMonitoring ? 'success' : 'default'}
                  sx={{ ml: 2 }}
                />
              </Typography>

              {monitoredWorkflows.length === 0 ? (
                <Alert severity="info">
                  请选择工作流并启动监控以开始接收Coze插件数据
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {monitoredWorkflows.map((workflow) => (
                    <Box
                      key={`${workflow.clientId}_${workflow.workflowId}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {workflow.workflowName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Client ID: {workflow.clientId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          数据: {workflow.dataCount} 条 |
                          启动: {new Date(workflow.startedAt).toLocaleTimeString()}
                        </Typography>
                      </Box>

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleStopMonitoring(workflow.clientId)}
                      >
                        <StopIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 数据统计 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                数据统计
              </Typography>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {totalDataReceived}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      总接收数据
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color={unreadDataCount > 0 ? 'warning' : 'text.secondary'}>
                      {unreadDataCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      未读数据
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {filteredData.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  正在显示 {filteredData.length} 条数据
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 数据展示区域 */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, padding: 0, '&:last-child': { pb: 0 } }}>
          <DataDisplayGrid
            data={filteredData}
            monitoredWorkflows={monitoredWorkflows}
            onWorkflowSelect={handleWorkflowSelect}
          />
        </CardContent>
      </Card>

      {/* 启动监控对话框 */}
      <StartMonitorDialog
        open={startDialogOpen}
        workflow={selectedWorkflowForMonitor}
        clientId={tempClientId}
        onClose={() => setStartDialogOpen(false)}
        onConfirm={handleConfirmStartMonitoring}
      />
    </Box>
  );
};

export default WorkflowMonitor;