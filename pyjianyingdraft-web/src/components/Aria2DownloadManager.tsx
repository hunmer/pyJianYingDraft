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
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Grid,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import DescriptionIcon from '@mui/icons-material/Description';
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
 * 判断文件是否为图片格式
 */
function isImageFile(filePath: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'];
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}

/**
 * 判断文件是否为视频格式
 */
function isVideoFile(filePath: string): boolean {
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return videoExtensions.includes(ext);
}

/**
 * 判断文件是否为音频格式
 */
function isAudioFile(filePath: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'];
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return audioExtensions.includes(ext);
}

/**
 * 获取文件类型图标
 */
function getFileIcon(filePath: string) {
  if (isImageFile(filePath)) return <ImageIcon sx={{ fontSize: 80, color: 'primary.main' }} />;
  if (isVideoFile(filePath)) return <VideoFileIcon sx={{ fontSize: 80, color: 'secondary.main' }} />;
  if (isAudioFile(filePath)) return <AudioFileIcon sx={{ fontSize: 80, color: 'success.main' }} />;
  return <DescriptionIcon sx={{ fontSize: 80, color: 'text.secondary' }} />;
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

        {/* 任务列表 - 卡片网格布局 */}
        {selectedGroupId && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {displayDownloads.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  该组没有下载任务
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {displayDownloads.map((download) => {
                  const progress = download.totalLength > 0
                    ? (download.completedLength / download.totalLength) * 100
                    : 0;

                  // 获取文件路径
                  const filePath = download.files && download.files.length > 0
                    ? download.files[0].path
                    : '';

                  const fileName = filePath ? filePath.split(/[/\\]/).pop() : `GID: ${download.gid}`;
                  const isImage = filePath && isImageFile(filePath);
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                  const previewUrl = isImage ? `${apiUrl}/api/files/preview?file_path=${encodeURIComponent(filePath)}` : '';

                  return (
                    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={download.gid}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* 卡片封面 */}
                        <Box
                          sx={{
                            height: 200,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'grey.100',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {isImage && previewUrl ? (
                            <CardMedia
                              component="img"
                              image={previewUrl}
                              alt={fileName}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                // 图片加载失败时显示图标
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '';
                                  const iconContainer = document.createElement('div');
                                  iconContainer.style.display = 'flex';
                                  iconContainer.style.alignItems = 'center';
                                  iconContainer.style.justifyContent = 'center';
                                  iconContainer.style.height = '100%';
                                  parent.appendChild(iconContainer);
                                }
                              }}
                            />
                          ) : (
                            <Box sx={{ textAlign: 'center' }}>
                              {getFileIcon(filePath)}
                            </Box>
                          )}

                          {/* 状态标签 */}
                          <Chip
                            label={getStatusText(download.status)}
                            color={getStatusColor(download.status)}
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                            }}
                          />
                        </Box>

                        {/* 卡片内容 */}
                        <CardContent sx={{ flex: 1, pb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              mb: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                            title={fileName}
                          >
                            {fileName}
                          </Typography>

                          {/* 进度条 */}
                          <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />

                          {/* 下载信息 */}
                          <Typography variant="caption" display="block" color="text.secondary">
                            {formatFileSize(download.completedLength)} / {formatFileSize(download.totalLength)}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {progress.toFixed(1)}%
                          </Typography>
                          {download.downloadSpeed > 0 && (
                            <Typography variant="caption" display="block" color="primary">
                              {formatSpeed(download.downloadSpeed)}
                            </Typography>
                          )}

                          {/* 错误信息 */}
                          {download.errorCode && download.errorCode !== '0' && (
                            <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                              <Typography variant="caption">
                                {download.errorMessage || `错误: ${download.errorCode}`}
                              </Typography>
                            </Alert>
                          )}
                        </CardContent>

                        {/* 卡片操作按钮 */}
                        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                          <Box>
                            {download.status === 'active' && (
                              <Tooltip title="暂停">
                                <IconButton size="small" onClick={() => pauseDownload(download.gid)}>
                                  <PauseIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            {download.status === 'paused' && (
                              <Tooltip title="继续">
                                <IconButton size="small" onClick={() => resumeDownload(download.gid)}>
                                  <PlayArrowIcon />
                                </IconButton>
                              </Tooltip>
                            )}
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
                          </Box>
                          <Tooltip title="删除">
                            <IconButton size="small" onClick={() => removeDownload(download.gid)} color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        )}
      </Box>

    </Box>
  );
}

export default Aria2DownloadManager;
