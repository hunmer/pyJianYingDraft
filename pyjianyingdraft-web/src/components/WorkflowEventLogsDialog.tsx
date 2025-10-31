'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  CircularProgress,
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
import api from '@/lib/api';

interface WorkflowEventLogsDialogProps {
  open: boolean;
  onClose: () => void;
}

const WorkflowEventLogsDialog: React.FC<WorkflowEventLogsDialogProps> = ({
  open,
  onClose,
}) => {
  const [eventLogs, setEventLogs] = useState<WorkflowEventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterWorkflow, setFilterWorkflow] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const LIMIT = 200; // 每次加载200条

  // 加载事件日志
  const loadEventLogs = useCallback(async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
      setEventLogs([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = reset ? 0 : offset;
      const result = await api.coze.getEventLogs({
        limit: LIMIT,
        offset: currentOffset,
        workflowId: filterWorkflow !== 'all' ? filterWorkflow : undefined,
        level: filterLevel !== 'all' ? filterLevel : undefined,
      });

      if (reset) {
        setEventLogs(result.logs);
      } else {
        setEventLogs(prev => [...prev, ...result.logs]);
      }

      setHasMore(result.has_more);
      setTotal(result.total);
      setOffset(currentOffset + result.logs.length);
    } catch (error) {
      console.error('加载事件日志失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset, filterLevel, filterWorkflow]);

  // 监听打开状态，加载数据
  useEffect(() => {
    if (open) {
      loadEventLogs(true);
    }
  }, [open]);

  // 监听筛选条件变化
  useEffect(() => {
    if (open) {
      loadEventLogs(true);
    }
  }, [filterLevel, filterWorkflow]);

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

  // 滚动事件处理
  const handleScroll = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // 当滚动到底部100px以内时加载更多
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadEventLogs(false);
    }
  }, [loadingMore, hasMore, loadEventLogs]);

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
          <Chip label={`已加载 ${eventLogs.length} / 共 ${total} 条`} size="small" />
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
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
            }}
          >
            <CircularProgress />
          </Box>
        ) : eventLogs.length === 0 ? (
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
          <TableContainer 
            component={Paper} 
            variant="outlined"
            ref={tableContainerRef}
            onScroll={handleScroll}
            sx={{ maxHeight: 'calc(80vh - 250px)', overflow: 'auto' }}
          >
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
                {eventLogs.map((log) => (
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
            {loadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!hasMore && eventLogs.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  已加载全部日志
                </Typography>
              </Box>
            )}
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
