'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  Chip,
  Paper,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Replay as ReplayIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { generationRecordsApi, tasksApi, type GenerationRecord } from '@/lib/api';
import { useAria2WebSocket } from '@/hooks/useAria2WebSocket';

interface GenerationRecordsDialogProps {
  open: boolean;
  onClose: () => void;
  onReimport?: (record: GenerationRecord) => void;
  onOpenDownloadManager?: (taskId?: string) => void;
}

/**
 * 生成记录对话框组件
 */
export function GenerationRecordsDialog({ open, onClose, onReimport, onOpenDownloadManager }: GenerationRecordsDialogProps) {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<GenerationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载生成记录列表
  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await generationRecordsApi.list({ limit: 100 });
      setRecords(response.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载生成记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开对话框时加载记录
  useEffect(() => {
    if (open) {
      loadRecords();
    }
  }, [open]);

  // 处理记录选择
  const handleSelectRecord = (record: GenerationRecord) => {
    setSelectedRecord(record);
  };

  // 处理重新导入
  const handleReimport = () => {
    if (selectedRecord && onReimport) {
      onReimport(selectedRecord);
      onClose();
    }
  };

  // 处理删除记录
  const handleDeleteRecord = async (record: GenerationRecord, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发列表项选择

    if (!confirm(`确定要删除生成记录 "${record.rule_group_title || '未命名'}" 吗？`)) {
      return;
    }

    try {
      await generationRecordsApi.delete(record.record_id);

      // 如果删除的是当前选中的记录，清空选中状态
      if (selectedRecord?.record_id === record.record_id) {
        setSelectedRecord(null);
        setDownloads([]);
      }

      // 重新加载列表
      await loadRecords();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 打开下载管理器
  const handleOpenDownloads = () => {
    if (onOpenDownloadManager) {
      onOpenDownloadManager(selectedRecord?.task_id);
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'downloading':
      case 'processing':
        return 'info';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '等待中',
      downloading: '下载中',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '900px',
        },
      }}
    >
      {/* 对话框标题栏 */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          py: 1.5,
        }}
      >
        生成记录
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={loadRecords} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <IconButton edge="end" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* 对话框内容 */}
      <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex' }}>
        {/* 左侧：记录列表 */}
        <Paper
          sx={{
            width: 350,
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            borderRadius: 0,
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              共 {records.length} 条记录
            </Typography>
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && (
            <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
              {records.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    暂无生成记录
                  </Typography>
                </Box>
              ) : (
                records.map((record) => (
                  <ListItem
                    key={record.record_id}
                    disablePadding
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        size="small"
                        onClick={(e) => handleDeleteRecord(record, e)}
                        sx={{
                          color: 'error.main',
                          '&:hover': {
                            backgroundColor: 'error.light',
                            color: 'error.contrastText',
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemButton
                      selected={selectedRecord?.record_id === record.record_id}
                      onClick={() => handleSelectRecord(record)}
                      sx={{ pr: 6 }} // 为删除按钮留出空间
                    >
                      <ListItemText
                        primary={record.rule_group_title || '未命名规则组'}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" component="span" display="block">
                              {new Date(record.created_at).toLocaleString()}
                            </Typography>
                            <Box component="span">
                              <Chip
                                label={getStatusText(record.status)}
                                color={getStatusColor(record.status) as any}
                                size="small"
                              />
                            </Box>
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          )}
        </Paper>

        {/* 右侧：记录详情和下载列表 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedRecord ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                请选择一条生成记录查看详情
              </Typography>
            </Box>
          ) : (
            <>
              {/* 记录信息 */}
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {selectedRecord.rule_group_title || '未命名规则组'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      记录ID: {selectedRecord.record_id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      创建时间: {new Date(selectedRecord.created_at).toLocaleString()}
                    </Typography>
                    {selectedRecord.draft_name && (
                      <Typography variant="body2" color="text.secondary">
                        草稿名称: {selectedRecord.draft_name}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                    onClick={handleReimport}
                    size="small"
                  >
                    重新导入
                  </Button>
                </Box>

                <Chip
                  label={getStatusText(selectedRecord.status)}
                  color={getStatusColor(selectedRecord.status) as any}
                  size="small"
                />
              </Box>

              {/* 下载管理按钮 */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  下载管理
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    {selectedRecord.task_id
                      ? '点击下方按钮打开下载管理器查看和管理此任务的下载文件'
                      : '此记录暂无关联的下载任务'}
                  </Typography>
                  {selectedRecord.task_id && (
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={handleOpenDownloads}
                      size="large"
                    >
                      打开下载管理器
                    </Button>
                  )}
                </Box>
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
