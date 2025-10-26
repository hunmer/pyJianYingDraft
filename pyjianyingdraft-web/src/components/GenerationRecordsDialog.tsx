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
} from '@mui/icons-material';
import { generationRecordsApi, tasksApi, type GenerationRecord } from '@/lib/api';
import { useAria2WebSocket } from '@/hooks/useAria2WebSocket';
import { DownloadList } from './DownloadList';
import type { Aria2Download } from '@/types/aria2';

interface GenerationRecordsDialogProps {
  open: boolean;
  onClose: () => void;
  onReimport?: (record: GenerationRecord) => void;
}

/**
 * 生成记录对话框组件
 */
export function GenerationRecordsDialog({ open, onClose, onReimport }: GenerationRecordsDialogProps) {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<GenerationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Aria2Download[]>([]);

  const {
    connected,
    getGroupDownloads,
    pauseDownload,
    resumeDownload,
    removeDownload,
  } = useAria2WebSocket();

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

  // 选择记录后加载下载信息
  useEffect(() => {
    if (selectedRecord && selectedRecord.task_id) {
      loadDownloads(selectedRecord.task_id);
    }
  }, [selectedRecord]);

  // 加载下载信息
  const loadDownloads = async (taskId: string) => {
    try {
      // 获取任务详情
      const taskInfo = await tasksApi.get(taskId);

      // 如果有batch_id，从Aria2获取下载列表
      if (taskInfo.task_id && connected) {
        const groupDownloads = await getGroupDownloads(taskInfo.task_id);
        setDownloads(groupDownloads);
      }
    } catch (err) {
      console.error('加载下载信息失败:', err);
    }
  };

  // 处理记录选择
  const handleSelectRecord = (record: GenerationRecord) => {
    setSelectedRecord(record);
    setDownloads([]);
  };

  // 处理重新导入
  const handleReimport = () => {
    if (selectedRecord && onReimport) {
      onReimport(selectedRecord);
      onClose();
    }
  };

  // 打开文件
  const handleOpenFile = async (filePath: string) => {
    try {
      if (window.electron?.fs?.openFile) {
        await window.electron.fs.openFile(filePath);
      } else {
        alert('此功能仅在Electron环境下可用');
      }
    } catch (error) {
      console.error('打开文件失败:', error);
      alert('打开文件失败');
    }
  };

  // 打开文件所在位置
  const handleShowInFolder = async (filePath: string) => {
    try {
      if (window.electron?.fs?.showInFolder) {
        await window.electron.fs.showInFolder(filePath);
      } else {
        alert('此功能仅在Electron环境下可用');
      }
    } catch (error) {
      console.error('打开文件位置失败:', error);
      alert('打开文件位置失败');
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
                  <ListItem key={record.record_id} disablePadding>
                    <ListItemButton
                      selected={selectedRecord?.record_id === record.record_id}
                      onClick={() => handleSelectRecord(record)}
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

              {/* 下载列表 */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  下载文件
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {!connected ? (
                  <Alert severity="info">
                    Aria2未连接，无法显示下载信息
                  </Alert>
                ) : (
                  <DownloadList
                    downloads={downloads}
                    onPause={pauseDownload}
                    onResume={resumeDownload}
                    onRemove={removeDownload}
                    onOpenFile={handleOpenFile}
                    onShowInFolder={handleShowInFolder}
                  />
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
