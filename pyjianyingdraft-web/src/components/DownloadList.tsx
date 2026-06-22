'use client';

import React from 'react';
import { Button, Tooltip, ProgressBar } from '@heroui/react';
import {
  Pause as PauseIcon,
  Play as PlayArrowIcon,
  Trash2 as DeleteIcon,
  File as InsertDriveFileIcon,
  Folder as FolderIcon,
  Image as ImageIcon,
  FileVideo as VideoFileIcon,
  FileAudio as AudioFileIcon,
  FileText as DescriptionIcon,
} from 'lucide-react';
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
 * 获取状态颜色 class
 */
function getStatusClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'bg-green-100 text-green-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'active':
      return 'bg-blue-100 text-blue-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
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
  if (isImageFile(filePath)) return <ImageIcon size={80} className="text-[var(--accent)]" />;
  if (isVideoFile(filePath)) return <VideoFileIcon size={80} className="text-purple-500" />;
  if (isAudioFile(filePath)) return <AudioFileIcon size={80} className="text-green-500" />;
  return <DescriptionIcon size={80} className="text-[var(--muted-foreground)]" />;
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
      <div className="text-center p-8">
        <span className="text-sm text-[var(--muted-foreground)]">暂无下载任务</span>
      </div>
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          <div
            key={download.gid}
            className="bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-md flex flex-col h-full overflow-hidden"
          >
            {/* 卡片封面 */}
            <div className="h-[200px] flex items-center justify-center bg-[var(--muted)] relative overflow-hidden">
              {isImage && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={fileName}
                  className="w-full h-full object-cover"
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
                <div className="text-center">{getFileIcon(filePath)}</div>
              )}

              {/* 状态标签 */}
              <span
                className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded ${getStatusClass(download.status)}`}
              >
                {getStatusText(download.status)}
              </span>
            </div>

            {/* 卡片内容 */}
            <div className="flex-1 p-3 pb-1">
              <div
                className="mb-2 text-sm font-medium overflow-hidden text-ellipsis"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
                title={fileName}
              >
                {fileName}
              </div>

              {/* 进度条 */}
              <ProgressBar
                aria-label="下载进度"
                value={progress}
                className="mb-2"
              />

              {/* 下载信息 */}
              <div className="block text-xs text-[var(--muted-foreground)]">
                {formatFileSize(download.completedLength)} / {formatFileSize(download.totalLength)}
              </div>
              <div className="block text-xs text-[var(--muted-foreground)]">
                {progress.toFixed(1)}%
              </div>
              {download.downloadSpeed > 0 && (
                <div className="block text-xs text-[var(--accent)]">
                  {formatSpeed(download.downloadSpeed)}
                </div>
              )}

              {/* 错误信息 */}
              {download.errorCode && download.errorCode !== '0' && (
                <div className="mt-2 p-2 rounded-md border border-red-300 bg-red-50 text-red-800 text-xs">
                  {download.errorMessage || `错误: ${download.errorCode}`}
                </div>
              )}
            </div>

            {/* 卡片操作按钮 */}
            <div className="flex justify-between items-center px-3 pb-3 pt-1">
              <div className="flex gap-1">
                {download.status === 'active' && onPause && (
                  <Tooltip delay={0}>
                    <Button isIconOnly variant="ghost" size="sm" onPress={() => onPause(download.gid)}>
                      <PauseIcon size={18} />
                    </Button>
                    <Tooltip.Content>暂停</Tooltip.Content>
                  </Tooltip>
                )}
                {download.status === 'paused' && onResume && (
                  <Tooltip delay={0}>
                    <Button isIconOnly variant="ghost" size="sm" onPress={() => onResume(download.gid)}>
                      <PlayArrowIcon size={18} />
                    </Button>
                    <Tooltip.Content>继续</Tooltip.Content>
                  </Tooltip>
                )}
                {download.status === 'complete' && filePath && (
                  <>
                    {onOpenFile && (
                      <Tooltip delay={0}>
                        <Button isIconOnly variant="ghost" size="sm" onPress={() => onOpenFile(filePath)}>
                          <InsertDriveFileIcon size={18} />
                        </Button>
                        <Tooltip.Content>打开文件</Tooltip.Content>
                      </Tooltip>
                    )}
                    {onShowInFolder && (
                      <Tooltip delay={0}>
                        <Button isIconOnly variant="ghost" size="sm" onPress={() => onShowInFolder(filePath)}>
                          <FolderIcon size={18} />
                        </Button>
                        <Tooltip.Content>打开文件位置</Tooltip.Content>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>
              {onRemove && (
                <Tooltip delay={0}>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    onPress={() => onRemove(download.gid)}
                    className="text-red-600"
                  >
                    <DeleteIcon size={18} />
                  </Button>
                  <Tooltip.Content>删除</Tooltip.Content>
                </Tooltip>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
