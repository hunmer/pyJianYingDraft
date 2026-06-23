'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button, Tooltip, ProgressBar, toast } from '@heroui/react';
import {
  Pause as PauseIcon,
  Play as PlayArrowIcon,
  Trash2 as DeleteIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  File as InsertDriveFileIcon,
  Image as ImageIcon,
  FileVideo as VideoFileIcon,
  FileAudio as AudioFileIcon,
  FileText as DescriptionIcon,
  AlertTriangle as ErrorIcon,
  Link as LinkIcon,
  Eraser as DeleteSweepIcon,
  LayoutGrid as ViewModuleIcon,
  List as ViewListIcon,
} from 'lucide-react';
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
 * 获取状态 class
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

interface Aria2DownloadManagerProps {
  initialGroupId?: string;
}

/**
 * Aria2 下载管理器组件
 */
export function Aria2DownloadManager({ initialGroupId }: Aria2DownloadManagerProps = {}) {
  const {
    connected,
    groups,
    selectedGroupDownloads,
    selectedGroupTestData,
    loading,
    error,
    getGroups,
    getGroupDownloads,
    pauseDownload,
    resumeDownload,
    removeDownload,
    retryFailedDownloads,
  } = useAria2WebSocket();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [downloadDir, setDownloadDir] = useState<string>('');
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  // 当提供initialGroupId时,自动选择对应的组
  useEffect(() => {
    if (initialGroupId && groups.length > 0 && !selectedGroupId) {
      const targetGroup = groups.find(g => g.groupId === initialGroupId);
      if (targetGroup) {
        handleSelectGroup(initialGroupId);
      }
    }
  }, [initialGroupId, groups, selectedGroupId]);

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
      toast.danger('下载目录未配置');
      return;
    }
    try {
      if (window.electron?.fs?.openFolder) {
        await window.electron.fs.openFolder(downloadDir);
      } else {
        toast.danger('此功能仅在Electron环境下可用');
      }
    } catch (error) {
      console.error('打开文件夹失败:', error);
      toast.danger('打开文件夹失败');
    }
  };

  // 打开文件所在位置
  const handleShowInFolder = async (filePath: string) => {
    try {
      if (window.electron?.fs?.showInFolder) {
        await window.electron.fs.showInFolder(filePath);
      } else {
        toast.danger('此功能仅在Electron环境下可用');
      }
    } catch (error) {
      console.error('打开文件位置失败:', error);
      toast.danger('打开文件位置失败');
    }
  };

  // 打开文件
  const handleOpenFile = async (filePath: string) => {
    try {
      if (window.electron?.fs?.openFile) {
        await window.electron.fs.openFile(filePath);
      } else {
        toast.danger('此功能仅在Electron环境下可用');
      }
    } catch (error) {
      console.error('打开文件失败:', error);
      toast.danger('打开文件失败');
    }
  };

  // 删除组
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/aria2/groups/${groupToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 如果删除的是当前选中的组,清除选中状态
        if (selectedGroupId === groupToDelete) {
          setSelectedGroupId(null);
        }
        // 刷新组列表
        getGroups();
        setDeleteGroupDialogOpen(false);
        setGroupToDelete(null);
      } else {
        const data = await response.json();
        toast.danger(`删除失败: ${data.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除组失败:', error);
      toast.danger('删除组失败');
    }
  };

  // 打开删除组对话框
  const handleOpenDeleteGroupDialog = (groupId: string) => {
    setGroupToDelete(groupId);
    setDeleteGroupDialogOpen(true);
  };

  // 关闭删除组对话框
  const handleCloseDeleteGroupDialog = () => {
    setDeleteGroupDialogOpen(false);
    setGroupToDelete(null);
  };

  // 清空所有下载组
  const handleClearAllGroups = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/aria2/groups/clear-all`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // 清除选中状态
        setSelectedGroupId(null);
        // 清空ref缓存,让UI立即更新为空列表
        prevGroupsRef.current = [];
        prevDownloadsRef.current = [];
        // 刷新组列表
        getGroups();
        setClearAllDialogOpen(false);
        toast.success(`成功清空 ${data.deleted_count} 个下载组`);
      } else {
        const data = await response.json();
        toast.danger(`清空失败: ${data.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('清空所有组失败:', error);
      toast.danger('清空所有组失败');
    }
  };

  // 使用当前数据或上一次数据,避免闪烁
  const displayGroups = groups.length > 0 ? groups : prevGroupsRef.current;
  const displayDownloads = selectedGroupDownloads.length > 0 ? selectedGroupDownloads : prevDownloadsRef.current;

  // 重试失败任务（依赖 displayDownloads，需在其之后定义）
  const handleRetryFailedDownloads = async () => {
    if (!selectedGroupId) return;

    const failedDownloads = displayDownloads.filter(d => d.status === 'error');
    if (failedDownloads.length === 0) {
      toast.danger('当前没有失败的下载任务');
      return;
    }

    try {
      // 调用重试失败下载的API
      await retryFailedDownloads(selectedGroupId);
      toast.success(`正在重新下载 ${failedDownloads.length} 个失败任务`);
      // 延迟刷新下载列表，给Aria2一些时间处理
      setTimeout(() => {
        getGroupDownloads(selectedGroupId);
      }, 1000);
    } catch (error) {
      console.error('重试失败任务出错:', error);
      toast.danger('重试失败任务出错');
    }
  };

  // 导出所有下载链接
  const handleExportDownloadLinks = () => {
    if (!selectedGroupId) return;

    const links: string[] = [];

    // 优先从testData中提取链接
    if (selectedGroupTestData) {
      // 遍历testData的所有字段，提取URL
      const extractUrls = (obj: any) => {
        if (!obj) return;

        if (typeof obj === 'string') {
          // 检查是否为HTTP/HTTPS链接
          if (obj.startsWith('http://') || obj.startsWith('https://')) {
            links.push(obj);
          }
        } else if (Array.isArray(obj)) {
          obj.forEach(item => extractUrls(item));
        } else if (typeof obj === 'object') {
          Object.values(obj).forEach(value => extractUrls(value));
        }
      };

      extractUrls(selectedGroupTestData);
    }

    // 如果testData中没有链接，则从下载任务中提取
    if (links.length === 0) {
      displayDownloads.forEach((download) => {
        if (download.files && download.files.length > 0) {
          download.files.forEach((file) => {
            if (file.uris && file.uris.length > 0) {
              file.uris.forEach((uri) => {
                if (uri.uri) {
                  links.push(uri.uri);
                }
              });
            }
          });
        }
      });
    }

    if (links.length === 0) {
      toast.danger('没有可导出的下载链接');
      return;
    }

    // 去重
    const uniqueLinks = Array.from(new Set(links));

    // 创建文本内容
    const content = uniqueLinks.join('\n');

    // 创建下载
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `download-links-${selectedGroupId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 左侧:组列表 */}
      <div className="w-[300px] flex flex-col border-r border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]">
        {/* 头部 */}
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <div className="text-base font-semibold">下载组列表</div>
          <div className="flex gap-1">
            {selectedGroupId && (
              <Tooltip delay={0}>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => handleOpenDeleteGroupDialog(selectedGroupId)}
                  className="text-red-600"
                >
                  <DeleteIcon size={18} />
                </Button>
                <Tooltip.Content>删除当前组</Tooltip.Content>
              </Tooltip>
            )}
            {displayGroups.length > 0 && (
              <Tooltip delay={0}>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => setClearAllDialogOpen(true)}
                  className="text-red-600"
                >
                  <DeleteSweepIcon size={18} />
                </Button>
                <Tooltip.Content>清空所有下载组</Tooltip.Content>
              </Tooltip>
            )}
            <Tooltip delay={0}>
              <Button isIconOnly variant="ghost" size="sm" onPress={handleOpenDownloadFolder}>
                <FolderOpenIcon size={18} />
              </Button>
              <Tooltip.Content>打开下载文件夹</Tooltip.Content>
            </Tooltip>
          </div>
        </div>

        {/* 组列表 */}
        <div className="flex-1 overflow-auto">
          {displayGroups.length === 0 ? (
            <div className="p-4 text-center">
              <span className="text-sm text-[var(--muted-foreground)]">暂无下载组</span>
            </div>
          ) : (
            displayGroups.map((group) => (
              <button
                key={group.groupId}
                onClick={() => handleSelectGroup(group.groupId)}
                className={`w-full text-left px-4 py-2 border-b border-[var(--border)] hover:bg-[var(--muted)] ${
                  selectedGroupId === group.groupId ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : ''
                }`}
              >
                <div className="font-medium text-sm">{group.groupName || '未命名'}</div>
                <div className="block text-xs opacity-80">
                  {group.completedDownloads}/{group.totalDownloads} 已完成
                </div>
                <ProgressBar
                  aria-label="组进度"
                  value={group.progressPercent}
                  className="my-1"
                />
                <div className="block text-xs opacity-80">
                  {formatFileSize(group.downloadedSize)} / {formatFileSize(group.totalSize)} ({group.progressPercent.toFixed(1)}%)
                </div>
                {group.downloadSpeed > 0 && (
                  <div className="block text-xs opacity-80">
                    速度: {formatSpeed(group.downloadSpeed)} | ETA: {formatTime(group.etaSeconds)}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右侧:下载任务列表 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <div className="text-base font-semibold">
            {selectedGroupId ? '下载任务' : '请选择一个下载组'}
          </div>
          {selectedGroupId && (
            <div className="flex gap-2 items-center">
              {/* 视图切换 */}
              <div className="flex border border-[var(--border)] rounded-md overflow-hidden">
                <Tooltip delay={0}>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-transparent'}`}
                  >
                    <ViewModuleIcon size={18} />
                  </button>
                  <Tooltip.Content>网格视图</Tooltip.Content>
                </Tooltip>
                <Tooltip delay={0}>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-transparent'}`}
                  >
                    <ViewListIcon size={18} />
                  </button>
                  <Tooltip.Content>列表视图</Tooltip.Content>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                size="sm"
                onPress={handleRetryFailedDownloads}
                className="text-red-600 border-red-300"
              >
                <ErrorIcon size={16} className="mr-1" />
                处理失败任务
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={handleExportDownloadLinks}
              >
                <LinkIcon size={16} className="mr-1" />
                导出下载链接
              </Button>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="m-4 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* 任务列表 */}
        {selectedGroupId && (
          <div className="flex-1 overflow-auto p-4 pb-10">
            {displayDownloads.length === 0 ? (
              <div className="text-center p-8">
                <span className="text-sm text-[var(--muted-foreground)]">该组没有下载任务</span>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                    <div
                      key={download.gid}
                      className="bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-md flex flex-col h-full overflow-hidden"
                    >
                      {/* 卡片封面 */}
                      <div
                        className="w-full flex items-center justify-center bg-[var(--muted)] relative overflow-hidden"
                        style={{ aspectRatio: '9 / 16' }}
                      >
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
                        <Tooltip delay={0}>
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded ${getStatusClass(download.status)}`}
                          >
                            {getStatusText(download.status)}
                          </span>
                          <Tooltip.Content>
                            {download.errorCode && download.errorCode !== '0'
                              ? download.errorMessage || `错误: ${download.errorCode}`
                              : ''}
                          </Tooltip.Content>
                        </Tooltip>
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
                        <ProgressBar aria-label="下载进度" value={progress} className="mb-2" />

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
                      </div>

                      {/* 卡片操作按钮 */}
                      <div className="flex justify-between items-center px-3 pb-3 pt-1">
                        <div className="flex gap-1">
                          {download.status === 'active' && (
                            <Tooltip delay={0}>
                              <Button isIconOnly variant="ghost" size="sm" onPress={() => pauseDownload(download.gid)}>
                                <PauseIcon size={18} />
                              </Button>
                              <Tooltip.Content>暂停</Tooltip.Content>
                            </Tooltip>
                          )}
                          {download.status === 'paused' && (
                            <Tooltip delay={0}>
                              <Button isIconOnly variant="ghost" size="sm" onPress={() => resumeDownload(download.gid)}>
                                <PlayArrowIcon size={18} />
                              </Button>
                              <Tooltip.Content>继续</Tooltip.Content>
                            </Tooltip>
                          )}
                          {download.status === 'complete' && filePath && (
                            <>
                              <Tooltip delay={0}>
                                <Button isIconOnly variant="ghost" size="sm" onPress={() => handleOpenFile(filePath)}>
                                  <InsertDriveFileIcon size={18} />
                                </Button>
                                <Tooltip.Content>打开文件</Tooltip.Content>
                              </Tooltip>
                              <Tooltip delay={0}>
                                <Button isIconOnly variant="ghost" size="sm" onPress={() => handleShowInFolder(filePath)}>
                                  <FolderIcon size={18} />
                                </Button>
                                <Tooltip.Content>打开文件位置</Tooltip.Content>
                              </Tooltip>
                            </>
                          )}
                        </div>
                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            onPress={() => removeDownload(download.gid)}
                            className="text-red-600"
                          >
                            <DeleteIcon size={18} />
                          </Button>
                          <Tooltip.Content>删除</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // 列表视图
              <div className="w-full">
                {displayDownloads.map((download, idx) => {
                  const progress = download.totalLength > 0
                    ? (download.completedLength / download.totalLength) * 100
                    : 0;

                  const filePath = download.files && download.files.length > 0
                    ? download.files[0].path
                    : '';

                  const fileName = filePath ? filePath.split(/[/\\]/).pop() : `GID: ${download.gid}`;

                  return (
                    <React.Fragment key={download.gid}>
                      <div className="flex flex-col py-4">
                        <div className="flex items-center mb-1">
                          {/* 文件图标/预览图 */}
                          <div className="mr-2 w-20 h-20 flex items-center justify-center bg-[var(--muted)] rounded-md overflow-hidden flex-shrink-0">
                            {isImageFile(filePath) && (
                              <img
                                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/files/preview?file_path=${encodeURIComponent(filePath)}`}
                                alt={fileName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // 图片加载失败时显示图标
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = '';
                                    const iconDiv = document.createElement('div');
                                    iconDiv.style.display = 'flex';
                                    iconDiv.style.alignItems = 'center';
                                    iconDiv.style.justifyContent = 'center';
                                    iconDiv.style.height = '100%';
                                    parent.appendChild(iconDiv);
                                  }
                                }}
                              />
                            )}
                            {!isImageFile(filePath) && getFileIcon(filePath)}
                          </div>

                          {/* 文件信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-0.5">
                              <div
                                className="flex-1 mr-2 text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                                title={fileName}
                              >
                                {fileName}
                              </div>

                              {/* 状态标签 */}
                              <Tooltip delay={0}>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded ${getStatusClass(download.status)}`}
                                >
                                  {getStatusText(download.status)}
                                </span>
                                <Tooltip.Content>
                                  {download.errorCode && download.errorCode !== '0'
                                    ? download.errorMessage || `错误: ${download.errorCode}`
                                    : ''}
                                </Tooltip.Content>
                              </Tooltip>
                            </div>

                            {/* 进度条 */}
                            <ProgressBar aria-label="下载进度" value={progress} className="mb-2" />

                            {/* 下载信息 */}
                            <div className="flex gap-4 flex-wrap">
                              <span className="text-xs text-[var(--muted-foreground)]">
                                {formatFileSize(download.completedLength)} / {formatFileSize(download.totalLength)}
                              </span>
                              <span className="text-xs text-[var(--muted-foreground)]">
                                {progress.toFixed(1)}%
                              </span>
                              {download.downloadSpeed > 0 && (
                                <span className="text-xs text-[var(--accent)]">
                                  {formatSpeed(download.downloadSpeed)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex gap-1 ml-2">
                            {download.status === 'active' && (
                              <Tooltip delay={0}>
                                <Button isIconOnly variant="ghost" size="sm" onPress={() => pauseDownload(download.gid)}>
                                  <PauseIcon size={18} />
                                </Button>
                                <Tooltip.Content>暂停</Tooltip.Content>
                              </Tooltip>
                            )}
                            {download.status === 'paused' && (
                              <Tooltip delay={0}>
                                <Button isIconOnly variant="ghost" size="sm" onPress={() => resumeDownload(download.gid)}>
                                  <PlayArrowIcon size={18} />
                                </Button>
                                <Tooltip.Content>继续</Tooltip.Content>
                              </Tooltip>
                            )}
                            {download.status === 'complete' && filePath && (
                              <>
                                <Tooltip delay={0}>
                                  <Button isIconOnly variant="ghost" size="sm" onPress={() => handleOpenFile(filePath)}>
                                    <InsertDriveFileIcon size={18} />
                                  </Button>
                                  <Tooltip.Content>打开文件</Tooltip.Content>
                                </Tooltip>
                                <Tooltip delay={0}>
                                  <Button isIconOnly variant="ghost" size="sm" onPress={() => handleShowInFolder(filePath)}>
                                    <FolderIcon size={18} />
                                  </Button>
                                  <Tooltip.Content>打开文件位置</Tooltip.Content>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip delay={0}>
                              <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => removeDownload(download.gid)}
                                className="text-red-600"
                              >
                                <DeleteIcon size={18} />
                              </Button>
                              <Tooltip.Content>删除</Tooltip.Content>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                      <div className="border-b border-[var(--border)]" />
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 删除组确认对话框 */}
      {deleteGroupDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleCloseDeleteGroupDialog}
        >
          <div
            className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl max-w-md w-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold">确认删除</h2>
              <button onClick={handleCloseDeleteGroupDialog} className="text-xl">×</button>
            </div>
            <div className="p-4">
              <p className="text-sm">
                确定要删除此下载组吗?此操作将删除该组的所有下载任务记录,但不会删除已下载的文件。
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
              <Button variant="ghost" onPress={handleCloseDeleteGroupDialog}>取消</Button>
              <Button variant="danger" onPress={handleDeleteGroup}>删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* 清空所有组确认对话框 */}
      {clearAllDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setClearAllDialogOpen(false)}
        >
          <div
            className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl max-w-md w-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold">确认清空所有下载组</h2>
              <button onClick={() => setClearAllDialogOpen(false)} className="text-xl">×</button>
            </div>
            <div className="p-4">
              <p className="text-sm">
                确定要清空所有下载组吗?此操作将删除所有下载组及其下载任务记录,但不会删除已下载的文件。
              </p>
              <p className="mt-2 text-sm font-bold text-red-600">
                ⚠️ 此操作不可撤销!
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
              <Button variant="ghost" onPress={() => setClearAllDialogOpen(false)}>取消</Button>
              <Button variant="danger" onPress={handleClearAllGroups}>清空所有</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Aria2DownloadManager;
