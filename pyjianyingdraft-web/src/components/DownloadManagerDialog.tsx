'use client';

import React, { lazy, Suspense, useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Box,
  CircularProgress,
  Chip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAria2WebSocket } from '@/hooks/useAria2WebSocket';

// 异步加载下载管理器组件
const Aria2DownloadManager = lazy(() =>
  import('@/components/Aria2DownloadManager').then((module) => ({
    default: module.Aria2DownloadManager,
  }))
);

interface DownloadManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 下载管理 Dialog 组件
 * 使用异步加载避免阻塞主页面
 */
export function DownloadManagerDialog({ open, onClose }: DownloadManagerDialogProps) {
  const {
    connected,
    config,
    loading,
    getGroups,
    getConfig,
    updateConfig,
  } = useAria2WebSocket();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aria2PathInput, setAria2PathInput] = useState('');

  useEffect(() => {
    if (connected && open) {
      getGroups();
      getConfig();
    }
  }, [connected, open, getGroups, getConfig]);

  useEffect(() => {
    if (config) {
      setAria2PathInput(config.aria2Path || '');
    }
  }, [config]);

  const handleRefresh = () => {
    getGroups();
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };

  const handleSaveSettings = async () => {
    if (aria2PathInput.trim()) {
      await updateConfig(aria2PathInput.trim());
      setSettingsOpen(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: '800px',
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
            fontWeight: 600,
          }}
        >
          下载管理
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* 连接状态 */}
            <Chip
              label={connected ? '已连接' : '未连接'}
              color={connected ? 'success' : 'error'}
              size="small"
            />
            <IconButton size="small" onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <IconButton size="small" onClick={handleOpenSettings}>
              <SettingsIcon />
            </IconButton>
            <IconButton edge="end" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        {/* 对话框内容 */}
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {open && (
            <Suspense
              fallback={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <CircularProgress />
                </Box>
              }
            >
              <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                <Aria2DownloadManager />
              </Box>
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* 设置对话框 */}
      <Dialog open={settingsOpen} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
        <DialogTitle>Aria2 设置</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Aria2 路径"
            value={aria2PathInput}
            onChange={(e) => setAria2PathInput(e.target.value)}
            placeholder="例如: D:\aria2"
            helperText="请输入 aria2c.exe 所在的目录路径"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSettings}>取消</Button>
          <Button
            onClick={handleSaveSettings}
            variant="contained"
            disabled={!aria2PathInput.trim()}
          >
            保存并重启 Aria2
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
