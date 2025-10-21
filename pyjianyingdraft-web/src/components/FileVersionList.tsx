'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { fileWatchApi, type WatchedFileInfo } from '@/lib/api';

interface FileVersionListProps {
  /** 当前选择的文件路径 */
  selectedFilePath?: string;
  /** 文件选择回调 */
  onFileSelect?: (filePath: string) => void;
}

/**
 * 文件版本列表组件
 * 显示监控的文件列表，支持添加、删除、开始/停止监控
 */
export default function FileVersionList({
  selectedFilePath,
  onFileSelect,
}: FileVersionListProps) {
  const [watchedFiles, setWatchedFiles] = useState<WatchedFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newWatchName, setNewWatchName] = useState('');

  /**
   * 加载监控文件列表
   */
  const loadWatchedFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files = await fileWatchApi.getWatchedFiles();
      setWatchedFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadWatchedFiles();
  }, [loadWatchedFiles]);

  /**
   * 添加监控文件
   */
  const handleAddWatch = async () => {
    if (!newFilePath.trim()) {
      setError('请输入文件路径');
      return;
    }

    try {
      await fileWatchApi.addWatch(newFilePath, newWatchName || undefined);
      setAddDialogOpen(false);
      setNewFilePath('');
      setNewWatchName('');
      await loadWatchedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加监控失败');
    }
  };

  /**
   * 移除监控文件
   */
  const handleRemoveWatch = async (filePath: string) => {
    try {
      await fileWatchApi.removeWatch(filePath);
      await loadWatchedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除监控失败');
    }
  };

  /**
   * 切换监控状态
   */
  const handleToggleWatch = async (file: WatchedFileInfo) => {
    try {
      if (file.is_watching) {
        await fileWatchApi.stopWatch(file.file_path);
      } else {
        await fileWatchApi.startWatch(file.file_path);
      }
      await loadWatchedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换监控状态失败');
    }
  };

  /**
   * 选择文件
   */
  const handleSelectFile = (filePath: string) => {
    onFileSelect?.(filePath);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6">文件版本</Typography>
        <Box>
          <Tooltip title="刷新">
            <IconButton size="small" onClick={loadWatchedFiles}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="添加文件">
            <IconButton size="small" onClick={() => setAddDialogOpen(true)}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* 加载中 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 文件列表 */}
      {!loading && (
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {watchedFiles.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                暂无监控文件
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                sx={{ mt: 2 }}
              >
                添加文件
              </Button>
            </Box>
          )}

          {watchedFiles.map((file) => (
            <React.Fragment key={file.file_path}>
              <ListItem
                disablePadding
                secondaryAction={
                  <Box>
                    <Tooltip title={file.is_watching ? '停止监控' : '开始监控'}>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleToggleWatch(file)}
                        color={file.is_watching ? 'success' : 'default'}
                      >
                        {file.is_watching ? <StopIcon /> : <PlayIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveWatch(file.file_path)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemButton
                  selected={selectedFilePath === file.file_path}
                  onClick={() => handleSelectFile(file.file_path)}
                >
                  <ListItemIcon>
                    <FileIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" noWrap>
                          {file.watch_name}
                        </Typography>
                        {file.is_watching && (
                          <Chip label="监控中" size="small" color="success" />
                        )}
                      </Box>
                    }
                    secondary={
                      <React.Fragment>
                        <Typography variant="caption" display="block" noWrap>
                          {file.file_path}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          版本: {file.total_versions} | 最新: v{file.latest_version}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                </ListItemButton>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      )}

      {/* 添加文件对话框 */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>添加监控文件</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="文件路径"
            type="text"
            fullWidth
            variant="outlined"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            placeholder="例如: D:\path\to\file.json"
            helperText="请输入要监控的文件的绝对路径"
          />
          <TextField
            margin="dense"
            label="监控名称（可选）"
            type="text"
            fullWidth
            variant="outlined"
            value={newWatchName}
            onChange={(e) => setNewWatchName(e.target.value)}
            placeholder="默认使用文件名"
            helperText="给这个监控起一个便于识别的名称"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>取消</Button>
          <Button onClick={handleAddWatch} variant="contained">
            添加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
