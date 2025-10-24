'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  LinearProgress,
  IconButton,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useAria2WebSocket } from '@/hooks/useAria2WebSocket';
import type { Aria2DownloadGroup, Aria2Download } from '@/types/aria2';

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化速度
 */
function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/**
 * 格式化时间
 */
function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '未知';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}时${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

/**
 * 获取状态颜色
 */
function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
  switch (status) {
    case 'complete':
      return 'success';
    case 'error':
      return 'error';
    case 'active':
      return 'info';
    case 'paused':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * 获取状态文本
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    active: '下载中',
    waiting: '等待中',
    paused: '已暂停',
    error: '失败',
    complete: '已完成',
    removed: '已移除',
  };
  return statusMap[status] || status;
}

/**
 * Aria2 下载管理器组件
 */
export function Aria2DownloadManager() {
  const {
    connected,
    groups,
    selectedGroupDownloads,
    loading,
    error,
    getGroups,
    getGroupDownloads,
    pauseDownload,
    resumeDownload,
    removeDownload,
  } = useAria2WebSocket();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [downloadDir, setDownloadDir] = useState<string>('');
  // 用于存储上一次的数据,避免刷新闪烁
  const prevGroupsRef = useRef<Aria2DownloadGroup[]>([]);
  const prevDownloadsRef = useRef<Aria2Download[]>([]);

  // 初始化:获取组列表和下载目录
  useEffect(() => {
    if (connected) {
      getGroups();
      fetchDownloadDir();
    }
  }, [connected]);

  // 获取下载目录
  const fetchDownloadDir = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/aria2/config/download-dir`);
      if (response.ok) {
        const data = await response.json();
        setDownloadDir(data.download_dir || '');
      }
    } catch (error) {
      console.error('获取下载目录失败:', error);
    }
  };

  // 保存当前数据到ref
  useEffect(() => {
    if (groups.length > 0) {
      prevGroupsRef.current = groups;
    }
  }, [groups]);

  useEffect(() => {
    if (selectedGroupDownloads.length > 0) {
      prevDownloadsRef.current = selectedGroupDownloads;
    }
  }, [selectedGroupDownloads]);

  // 自动刷新组列表(每 3 秒) - 优化版本,避免UI闪烁
  useEffect(() => {
    if (connected) {
      const interval = setInterval(() => {
        // 静默刷新,不触发loading状态
        getGroups();
        if (selectedGroupId) {
          getGroupDownloads(selectedGroupId);
        }
      }, 3000);
      setRefreshInterval(interval);

      return () => {
        clearInterval(interval);
      };
    }
  }, [connected, selectedGroupId]);

  // 选择组
  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    getGroupDownloads(groupId);
  };

  // 刷新
  const handleRefresh = () => {
    getGroups();
    if (selectedGroupId) {
      getGroupDownloads(selectedGroupId);
    }
  };

  // 打开下载文件夹
  const handleOpenDownloadFolder = async () => {
    if (!downloadDir) {
      alert('下载目录未配置');
      return;
    }
    try {
      if (window.electron?.fs?.openFolder) {
        await window.electron.fs.openFolder(downloadDir);
      } else {
        alert('此功能仅在Electron环境下可用');
      }
    } catch (error) {
      console.error('打开文件夹失败:', error);
      alert('打开文件夹失败');
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

  // 使用当前数据或上一次数据,避免闪烁
  const displayGroups = groups.length > 0 ? groups : prevGroupsRef.current;
  const displayDownloads = selectedGroupDownloads.length > 0 ? selectedGroupDownloads : prevDownloadsRef.current;

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 左侧:组列表 */}
      <Paper
        sx={{
          width: 300,
          display: 'flex',
          flexDirection: 'column',
          borderRight: 1,
          borderColor: 'divider',
          borderRadius: 0,
        }}
      >
        {/* 头部 */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">下载组列表</Typography>
          <Tooltip title="打开下载文件夹">
            <IconButton size="small" onClick={handleOpenDownloadFolder}>
              <FolderOpenIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 组列表 */}
        <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          {displayGroups.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                暂无下载组
              </Typography>
            </Box>
          ) : (
            displayGroups.map((group) => (
              <ListItem key={group.groupId} disablePadding>
                <ListItemButton
                  selected={selectedGroupId === group.groupId}
                  onClick={() => handleSelectGroup(group.groupId)}
                >
                  <ListItemText
                    primary={group.groupName || '未命名'}
                    secondary={
                      <>
                        <Typography variant="caption" display="block">
                          {group.completedDownloads}/{group.totalDownloads} 已完成
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={group.progressPercent}
                          sx={{ mt: 0.5 }}
                        />
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                          {formatFileSize(group.downloadedSize)} / {formatFileSize(group.totalSize)} ({group.progressPercent.toFixed(1)}%)
                        </Typography>
                        {group.downloadSpeed > 0 && (
                          <Typography variant="caption" display="block">
                            速度: {formatSpeed(group.downloadSpeed)} | ETA: {formatTime(group.etaSeconds)}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      {/* 右侧:下载任务列表 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 头部 */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            {selectedGroupId ? '下载任务' : '请选择一个下载组'}
          </Typography>
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* 任务列表 */}
        {selectedGroupId && (
          <List sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {displayDownloads.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  该组没有下载任务
                </Typography>
              </Box>
            ) : (
              displayDownloads.map((download) => {
                const progress = download.totalLength > 0
                  ? (download.completedLength / download.totalLength) * 100
                  : 0;

                // 获取文件路径
                const filePath = download.files && download.files.length > 0
                  ? download.files[0].path
                  : '';

                return (
                  <Paper key={download.gid} sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {filePath ? filePath.split(/[/\\]/).pop() : `GID: ${download.gid}`}
                        </Typography>
                        <Chip
                          label={getStatusText(download.status)}
                          color={getStatusColor(download.status)}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>

                      {/* 控制按钮 */}
                      <Box>
                        {download.status === 'complete' && filePath && (
                          <>
                            <Tooltip title="打开文件">
                              <IconButton size="small" onClick={() => handleOpenFile(filePath)}>
                                <InsertDriveFileIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="打开文件位置">
                              <IconButton size="small" onClick={() => handleShowInFolder(filePath)}>
                                <FolderIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {download.status === 'active' && (
                          <IconButton size="small" onClick={() => pauseDownload(download.gid)}>
                            <PauseIcon />
                          </IconButton>
                        )}
                        {download.status === 'paused' && (
                          <IconButton size="small" onClick={() => resumeDownload(download.gid)}>
                            <PlayArrowIcon />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => removeDownload(download.gid)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* 进度条 */}
                    <LinearProgress variant="determinate" value={progress} sx={{ my: 1 }} />

                    {/* 详细信息 */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="caption">
                        {formatFileSize(download.completedLength)} / {formatFileSize(download.totalLength)} ({progress.toFixed(1)}%)
                      </Typography>
                      {download.downloadSpeed > 0 && (
                        <Typography variant="caption">
                          速度: {formatSpeed(download.downloadSpeed)}
                        </Typography>
                      )}
                    </Box>

                    {/* 文件路径 */}
                    {filePath && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}>
                        {filePath}
                      </Typography>
                    )}

                    {/* 错误信息 */}
                    {download.errorCode && download.errorCode !== '0' && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {download.errorMessage || `错误代码: ${download.errorCode}`}
                      </Alert>
                    )}
                  </Paper>
                );
              })
            )}
          </List>
        )}
      </Box>

    </Box>
  );
}

export default Aria2DownloadManager;
