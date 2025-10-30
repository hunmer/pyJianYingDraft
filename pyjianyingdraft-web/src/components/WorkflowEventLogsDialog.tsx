'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { WorkflowEventLog } from '@/types/coze';

interface WorkflowEventLogsDialogProps {
  open: boolean;
  onClose: () => void;
  eventLogs: WorkflowEventLog[];
}

const WorkflowEventLogsDialog: React.FC<WorkflowEventLogsDialogProps> = ({
  open,
  onClose,
  eventLogs,
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterWorkflow, setFilterWorkflow] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 获取所有工作流ID
  const workflows = useMemo(() => {
    const workflowMap = new Map<string, string>();
    eventLogs.forEach(log => {
      if (!workflowMap.has(log.workflowId)) {
        workflowMap.set(log.workflowId, log.workflowName || log.workflowId);
      }
    });
    return Array.from(workflowMap.entries());
  }, [eventLogs]);

  // 过滤事件日志
  const filteredLogs = useMemo(() => {
    return eventLogs.filter(log => {
      if (filterLevel !== 'all' && log.level !== filterLevel) {
        return false;
      }
      if (filterWorkflow !== 'all' && log.workflowId !== filterWorkflow) {
        return false;
      }
      return true;
    });
  }, [eventLogs, filterLevel, filterWorkflow]);

  // 切换展开状态
  const toggleExpand = (logId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // 获取级别图标
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <InfoIcon fontSize="small" color="info" />;
      case 'warning':
        return <WarningIcon fontSize="small" color="warning" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      case 'success':
        return <SuccessIcon fontSize="small" color="success" />;
      default:
        return <InfoIcon fontSize="small" />;
    }
  };

  // 获取级别颜色
  const getLevelColor = (level: string): 'info' | 'warning' | 'error' | 'success' | 'default' => {
    switch (level) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      default:
        return 'default';
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">事件日志</Typography>
          <Chip label={`共 ${filteredLogs.length} 条`} size="small" />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 过滤器 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            select
            label="级别"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            size="small"
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="info">信息</MenuItem>
            <MenuItem value="warning">警告</MenuItem>
            <MenuItem value="error">错误</MenuItem>
            <MenuItem value="success">成功</MenuItem>
          </TextField>

          <TextField
            select
            label="工作流"
            value={filterWorkflow}
            onChange={(e) => setFilterWorkflow(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">全部</MenuItem>
            {workflows.map(([id, name]) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* 事件日志表格 */}
        {filteredLogs.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              暂无事件日志
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width={40}></TableCell>
                  <TableCell width={100}>级别</TableCell>
                  <TableCell width={180}>时间</TableCell>
                  <TableCell width={150}>工作流</TableCell>
                  <TableCell width={200}>事件类型</TableCell>
                  <TableCell>消息</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleExpand(log.id)}
                        >
                          {expandedRows.has(log.id) ? (
                            <ExpandLessIcon fontSize="small" />
                          ) : (
                            <ExpandMoreIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getLevelIcon(log.level)}
                          label={log.level}
                          size="small"
                          color={getLevelColor(log.level)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {formatTimestamp(log.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {log.workflowName || log.workflowId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.event}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.message}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* 展开的详细信息 */}
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0 }}>
                        <Collapse in={expandedRows.has(log.id)} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 2, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              详细信息
                            </Typography>

                            {log.executeId && (
                              <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  执行 ID: {log.executeId}
                                </Typography>
                              </Box>
                            )}

                            {log.data && (
                              <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                  事件数据:
                                </Typography>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 1,
                                    bgcolor: 'grey.900',
                                    color: 'grey.100',
                                    maxHeight: 200,
                                    overflow: 'auto',
                                  }}
                                >
                                  <pre
                                    style={{
                                      margin: 0,
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {JSON.stringify(log.data, null, 2)}
                                  </pre>
                                </Paper>
                              </Box>
                            )}

                            {log.details && (
                              <Box>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                  完整事件对象:
                                </Typography>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 1,
                                    bgcolor: 'grey.900',
                                    color: 'grey.100',
                                    maxHeight: 200,
                                    overflow: 'auto',
                                  }}
                                >
                                  <pre
                                    style={{
                                      margin: 0,
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </Paper>
                              </Box>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowEventLogsDialog;
