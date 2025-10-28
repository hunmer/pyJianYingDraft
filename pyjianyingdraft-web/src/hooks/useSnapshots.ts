import { useState, useEffect, useCallback } from 'react';

export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  data: any;
  description?: string;
}

interface UseSnapshotsOptions {
  storageKey: string;
  maxSnapshots?: number;
  autoSaveCurrent?: boolean;
}

export function useSnapshots({
  storageKey,
  maxSnapshots = 10,
  autoSaveCurrent = true,
}: UseSnapshotsOptions) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [currentData, setCurrentData] = useState<any>(null);
  const currentStorageKey = `${storageKey}-current`;
  const snapshotsStorageKey = `${storageKey}-snapshots`;

  // 加载快照列表
  const loadSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(snapshotsStorageKey);
      if (stored) {
        const loadedSnapshots = JSON.parse(stored) as Snapshot[];
        setSnapshots(loadedSnapshots);
      }
    } catch (err) {
      console.error('[useSnapshots] 加载快照列表失败:', err);
    }
  }, [snapshotsStorageKey]);

  // 加载当前数据
  const loadCurrentData = useCallback(() => {
    try {
      const stored = localStorage.getItem(currentStorageKey);
      if (stored) {
        const data = JSON.parse(stored);
        setCurrentData(data);
        return data;
      }
    } catch (err) {
      console.error('[useSnapshots] 加载当前数据失败:', err);
    }
    return null;
  }, [currentStorageKey]);

  // 保存当前数据
  const saveCurrentData = useCallback((data: any) => {
    try {
      localStorage.setItem(currentStorageKey, JSON.stringify(data));
      setCurrentData(data);
    } catch (err) {
      console.error('[useSnapshots] 保存当前数据失败:', err);
      throw err;
    }
  }, [currentStorageKey]);

  // 创建快照
  const createSnapshot = useCallback((name: string, data: any, description?: string) => {
    try {
      const newSnapshot: Snapshot = {
        id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        timestamp: Date.now(),
        data,
        description,
      };

      let updatedSnapshots = [...snapshots, newSnapshot];

      // 限制快照数量
      if (updatedSnapshots.length > maxSnapshots) {
        updatedSnapshots = updatedSnapshots.slice(-maxSnapshots);
      }

      localStorage.setItem(snapshotsStorageKey, JSON.stringify(updatedSnapshots));
      setSnapshots(updatedSnapshots);

      return newSnapshot;
    } catch (err) {
      console.error('[useSnapshots] 创建快照失败:', err);
      throw err;
    }
  }, [snapshots, maxSnapshots, snapshotsStorageKey]);

  // 恢复快照
  const restoreSnapshot = useCallback((snapshotId: string) => {
    try {
      const snapshot = snapshots.find(s => s.id === snapshotId);
      if (!snapshot) {
        throw new Error('快照不存在');
      }

      saveCurrentData(snapshot.data);
      return snapshot.data;
    } catch (err) {
      console.error('[useSnapshots] 恢复快照失败:', err);
      throw err;
    }
  }, [snapshots, saveCurrentData]);

  // 删除快照
  const deleteSnapshot = useCallback((snapshotId: string) => {
    try {
      const updatedSnapshots = snapshots.filter(s => s.id !== snapshotId);
      localStorage.setItem(snapshotsStorageKey, JSON.stringify(updatedSnapshots));
      setSnapshots(updatedSnapshots);
    } catch (err) {
      console.error('[useSnapshots] 删除快照失败:', err);
      throw err;
    }
  }, [snapshots, snapshotsStorageKey]);

  // 清空所有快照
  const clearAllSnapshots = useCallback(() => {
    try {
      localStorage.removeItem(snapshotsStorageKey);
      setSnapshots([]);
    } catch (err) {
      console.error('[useSnapshots] 清空快照失败:', err);
      throw err;
    }
  }, [snapshotsStorageKey]);

  // 重命名快照
  const renameSnapshot = useCallback((snapshotId: string, newName: string) => {
    try {
      const updatedSnapshots = snapshots.map(s =>
        s.id === snapshotId ? { ...s, name: newName } : s
      );
      localStorage.setItem(snapshotsStorageKey, JSON.stringify(updatedSnapshots));
      setSnapshots(updatedSnapshots);
    } catch (err) {
      console.error('[useSnapshots] 重命名快照失败:', err);
      throw err;
    }
  }, [snapshots, snapshotsStorageKey]);

  // 初始化加载
  useEffect(() => {
    loadSnapshots();
    loadCurrentData();
  }, [loadSnapshots, loadCurrentData]);

  // 自动保存当前数据
  useEffect(() => {
    if (autoSaveCurrent && currentData !== null) {
      try {
        localStorage.setItem(currentStorageKey, JSON.stringify(currentData));
      } catch (err) {
        console.error('[useSnapshots] 自动保存失败:', err);
      }
    }
  }, [currentData, autoSaveCurrent, currentStorageKey]);

  return {
    snapshots,
    currentData,
    loadSnapshots,
    loadCurrentData,
    saveCurrentData,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    clearAllSnapshots,
    renameSnapshot,
  };
}
