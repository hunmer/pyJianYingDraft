'use client';

import React from 'react';
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  LinearProgress,
  IconButton,
  Chip,
  Typography,
  Alert,
  Tooltip,
  Grid,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import DescriptionIcon from '@mui/icons-material/Description';
import type { Aria2Download } from '@/types/aria2';

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

interface DownloadListProps {
  downloads: Aria2Download[];
  onPause?: (gid: string) => void;
  onResume?: (gid: string) => void;
  onRemove?: (gid: string) => void;
  onOpenFile?: (filePath: string) => void;
  onShowInFolder?: (filePath: string) => void;
}

/**
 * 下载列表组件
 *
 * 显示Aria2下载任务的卡片网格列表
 */
export function DownloadList({
  downloads,
  onPause,
  onResume,
  onRemove,
  onOpenFile,
  onShowInFolder,
}: DownloadListProps) {
  if (!downloads || downloads.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          暂无下载任务
        </Typography>
      </Box>
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  return (
    <Grid container spacing={2}>
      {downloads.map((download) => {
        const progress = download.totalLength > 0
          ? (download.completedLength / download.totalLength) * 100
          : 0;

        // 获取文件路径
        const filePath = download.files && download.files.length > 0
          ? download.files[0].path
          : '';

        const fileName = filePath ? filePath.split(/[/\\]/).pop() : `GID: ${download.gid}`;
        const isImage = filePath && isImageFile(filePath);
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
                  {download.status === 'active' && onPause && (
                    <Tooltip title="暂停">
                      <IconButton size="small" onClick={() => onPause(download.gid)}>
                        <PauseIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {download.status === 'paused' && onResume && (
                    <Tooltip title="继续">
                      <IconButton size="small" onClick={() => onResume(download.gid)}>
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {download.status === 'complete' && filePath && (
                    <>
                      {onOpenFile && (
                        <Tooltip title="打开文件">
                          <IconButton size="small" onClick={() => onOpenFile(filePath)}>
                            <InsertDriveFileIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onShowInFolder && (
                        <Tooltip title="打开文件位置">
                          <IconButton size="small" onClick={() => onShowInFolder(filePath)}>
                            <FolderIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Box>
                {onRemove && (
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={() => onRemove(download.gid)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </CardActions>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
