/**
 * useAria2WebSocket Hook
 *
 * A下载组管理相关功能，使用 REST API 替代 WebSocket
 */

import { useEffect, useRef, useState, useCallback } from 'react';

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

