/**
 * useAria2WebSocket Hook
 *
 * A下载组管理相关功能，使用 REST API 替代 WebSocket
 */

import { useState, useCallback } from 'react';

import type {
  Aria2DownloadGroup,
  Aria2Download,
  Aria2Config,
  DownloadGroupsResponse,
  GroupDownloadsResponse,
} from '@/types/aria2';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UseAria2WebSocketReturn {
  connected: boolean;
  groups: Aria2DownloadGroup[];
  selectedGroupDownloads: Aria2Download[];
  selectedGroupTestData: { [key: string]: any } | null;
  config: Aria2Config | null;
  loading: boolean;
  error: string | null;

  // 方法
  getGroups: () => Promise<void>;
  getGroupDownloads: (groupId: string) => Promise<void>;
  getConfig: () => Promise<void>;
  updateConfig: (aria2Path: string) => Promise<void>;
  pauseDownload: (gid: string) => Promise<void>;
  resumeDownload: (gid: string) => Promise<void>;
  removeDownload: (gid: string) => Promise<void>;
  retryFailedDownloads: (batchId: string) => Promise<void>;
}

export function useAria2WebSocket(): UseAria2WebSocketReturn {
  const [connected, setConnected] = useState(true);
  const [groups, setGroups] = useState<Aria2DownloadGroup[]>([]);
  const [selectedGroupDownloads, setSelectedGroupDownloads] = useState<Aria2Download[]>([]);
  const [selectedGroupTestData, setSelectedGroupTestData] = useState<{ [key: string]: any } | null>(null);
  const [config, setConfig] = useState<Aria2Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取组列表
  const getGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/groups`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: DownloadGroupsResponse = await response.json();
      setGroups(data.groups);
    } catch (e: any) {
      setError(e.message || '获取下载组失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取组内下载任务
  const getGroupDownloads = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/groups/${groupId}/downloads`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: GroupDownloadsResponse = await response.json();
      setSelectedGroupDownloads(data.downloads);
      setSelectedGroupTestData(data.testData || null);
    } catch (e: any) {
      setError(e.message || '获取下载任务失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取配置
  const getConfig = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/config`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setConfig({
        aria2Path: data.aria2_path,
        rpcPort: data.rpc_port,
        rpcSecret: data.rpc_secret,
        downloadDir: data.download_dir,
        maxConcurrentDownloads: data.max_concurrent_downloads,
      });
      setConnected(true);
    } catch (e: any) {
      setConnected(false);
      setError(e.message || '获取配置失败');
    }
  }, []);

  // 更新配置
  const updateConfig = useCallback(async (aria2Path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aria2_path: aria2Path }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // 更新成功后重新获取配置
      await getConfig();
    } catch (e: any) {
      setError(e.message || '更新配置失败');
    } finally {
      setLoading(false);
    }
  }, [getConfig]);

  // 暂停下载
  const pauseDownload = useCallback(async (gid: string) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/downloads/${gid}/pause`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e: any) {
      setError(e.message || '暂停下载失败');
    }
  }, []);

  // 恢复下载
  const resumeDownload = useCallback(async (gid: string) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/downloads/${gid}/resume`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e: any) {
      setError(e.message || '恢复下载失败');
    }
  }, []);

  // 移除下载
  const removeDownload = useCallback(async (gid: string) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/downloads/${gid}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // 从本地列表中移除
      setSelectedGroupDownloads(prev => prev.filter(d => d.gid !== gid));
    } catch (e: any) {
      setError(e.message || '移除下载失败');
    }
  }, []);

  // 重试失败的下载
  const retryFailedDownloads = useCallback(async (batchId: string) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/aria2/downloads/retry-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e: any) {
      setError(e.message || '重试失败下载出错');
    }
  }, []);

  return {
    connected,
    groups,
    selectedGroupDownloads,
    selectedGroupTestData,
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
    retryFailedDownloads,
  };
}
