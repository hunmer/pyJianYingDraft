import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  Aria2DownloadGroup,
  Aria2Download,
  Aria2Config,
  DownloadGroupsResponse,
  GroupDownloadsResponse,
} from '@/types/aria2';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UseAria2WebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  groups: Aria2DownloadGroup[];
  selectedGroupDownloads: Aria2Download[];
  config: Aria2Config | null;
  loading: boolean;
  error: string | null;

  // 方法
  getGroups: () => void;
  getGroupDownloads: (groupId: string) => void;
  getConfig: () => void;
  updateConfig: (aria2Path: string) => Promise<void>;
  pauseDownload: (gid: string) => Promise<void>;
  resumeDownload: (gid: string) => Promise<void>;
  removeDownload: (gid: string) => Promise<void>;
}

export function useAria2WebSocket(): UseAria2WebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [groups, setGroups] = useState<Aria2DownloadGroup[]>([]);
  const [selectedGroupDownloads, setSelectedGroupDownloads] = useState<Aria2Download[]>([]);
  const [config, setConfig] = useState<Aria2Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 来存储回调函数，避免在依赖中频繁变化
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 创建 Socket.IO 连接
    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // 连接事件
    newSocket.on('connect', () => {
      console.log('Aria2 WebSocket 已连接');
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Aria2 WebSocket 已断开');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Aria2 WebSocket 连接错误:', err);
      setError('WebSocket 连接失败');
      setConnected(false);
    });

    // ===== 监听 Aria2 事件 =====

    // 获取组列表响应
    newSocket.on('aria2_groups', (data: DownloadGroupsResponse) => {
      setGroups(data.groups);
      setLoading(false);
    });

    newSocket.on('aria2_groups_error', (data: { error: string }) => {
      setError(data.error);
      setLoading(false);
    });

    // 获取组内下载任务响应
    newSocket.on('group_downloads', (data: GroupDownloadsResponse) => {
      setSelectedGroupDownloads(data.downloads);
      setLoading(false);
    });

    newSocket.on('group_downloads_error', (data: { error: string }) => {
      setError(data.error);
      setLoading(false);
    });

    // 获取配置响应
    newSocket.on('aria2_config', (data: Aria2Config) => {
      setConfig(data);
      setLoading(false);
    });

    newSocket.on('aria2_config_error', (data: { error: string }) => {
      setError(data.error);
      setLoading(false);
    });

    // 更新配置响应
    newSocket.on('aria2_config_updated', (data: { message: string; aria2Path: string }) => {
      console.log(data.message);
      setError(null);
      setLoading(false);
      // 重新获取配置
      newSocket.emit('get_aria2_config', {});
    });

    newSocket.on('update_aria2_config_error', (data: { error: string }) => {
      setError(data.error);
      setLoading(false);
    });

    // 下载控制响应
    newSocket.on('download_paused', (data: { gid: string }) => {
      console.log('下载已暂停:', data.gid);
      setError(null);
    });

    newSocket.on('pause_download_error', (data: { error: string }) => {
      setError(data.error);
    });

    newSocket.on('download_resumed', (data: { gid: string }) => {
      console.log('下载已恢复:', data.gid);
      setError(null);
    });

    newSocket.on('resume_download_error', (data: { error: string }) => {
      setError(data.error);
    });

    newSocket.on('download_removed', (data: { gid: string }) => {
      console.log('下载已移除:', data.gid);
      setError(null);
      // 刷新当前组的下载列表
      setSelectedGroupDownloads(prev => prev.filter(d => d.gid !== data.gid));
    });

    newSocket.on('remove_download_error', (data: { error: string }) => {
      setError(data.error);
    });

    // 清理函数
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 获取组列表
  const getGroups = useCallback(() => {
    if (!socketRef.current) return;
    setLoading(true);
    setError(null);
    socketRef.current.emit('get_aria2_groups', {});
  }, []);

  // 获取组内下载任务
  const getGroupDownloads = useCallback((groupId: string) => {
    if (!socketRef.current) return;
    setLoading(true);
    setError(null);
    socketRef.current.emit('get_group_downloads', { group_id: groupId });
  }, []);

  // 获取配置
  const getConfig = useCallback(() => {
    if (!socketRef.current) return;
    setLoading(true);
    setError(null);
    socketRef.current.emit('get_aria2_config', {});
  }, []);

  // 更新配置
  const updateConfig = useCallback(async (aria2Path: string) => {
    if (!socketRef.current) return;
    setLoading(true);
    setError(null);
    socketRef.current.emit('update_aria2_config', { aria2_path: aria2Path });
  }, []);

  // 暂停下载
  const pauseDownload = useCallback(async (gid: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('pause_download', { gid });
  }, []);

  // 恢复下载
  const resumeDownload = useCallback(async (gid: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('resume_download', { gid });
  }, []);

  // 移除下载
  const removeDownload = useCallback(async (gid: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('remove_download', { gid });
  }, []);

  return {
    socket,
    connected,
    groups,
    selectedGroupDownloads,
    config,
    loading,
    error,
    getGroups,
    getGroupDownloads,
    getConfig,
    updateConfig,
    pauseDownload,
    resumeDownload,
    removeDownload,
  };
}
