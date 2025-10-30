'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
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

interface WorkflowEventLogPanelProps {
  eventLogs: WorkflowEventLog[];
  workflowId?: string;
  workflowName?: string;
  height?: string | number;
}

const WorkflowEventLogPanel: React.FC<WorkflowEventLogPanelProps> = ({
  eventLogs,
  workflowId,
  workflowName,
  height = '100%',
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 过滤当前工作流的事件日志
  const filteredLogs = useMemo(() => {
    if (!workflowId) return eventLogs;
    return eventLogs.filter(log => log.workflowId === workflowId);
  }, [eventLogs, workflowId]);

  // 缓存日志计数，避免每次渲染重新计算
  const logCount = useMemo(() => filteredLogs.length, [filteredLogs.length]);

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
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* 头部信息 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Chip
          label={`共 ${logCount} 条`}
          size="small"
          color="primary"
        />
        {workflowName && (
          <Chip
            label={workflowName}
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        )}
      </Box>

      {/* 事件日志表格 */}
      {filteredLogs.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            border: '1px dashed',
            borderColor: 'grey.300',
            borderRadius: 1,
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
          sx={{
            flex: 1,
            height: 'calc(100% - 60px)', // 减去头部高度
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell width={80}>级别</TableCell>
                <TableCell width={160}>时间</TableCell>
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
                    <TableCell colSpan={5} sx={{ py: 0 }}>
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
    </Box>
  );
};

export default WorkflowEventLogPanel;