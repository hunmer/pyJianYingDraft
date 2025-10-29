'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { CozeZoneTabData } from '@/types/coze';

export interface TabData {
  id: string;
  label: string;
  type: 'draft_editor' | 'file_diff' | 'test_data' | 'coze_zone';
  // 草稿编辑器相关字段
  draftPath?: string;
  draftInfo?: any | null;
  tracks?: any[];
  materials?: any[];
  rawDraft?: Record<string, any> | null;
  materialCategories?: any | null;
  ruleGroups?: any[] | null;
  // 文件差异相关字段
  filePath?: string;
  // 测试数据相关字段
  testDataId?: string;
  onTestData?: (testData: any) => Promise<any> | any;
  testDataContext?: {
    ruleGroupId?: string;
    ruleGroup?: any;
    materials?: any[];
    rawSegments?: any[];
    rawMaterials?: any[];
    useRawSegmentsHint?: boolean;
    initialTestData?: any;
  };
  // Coze Zone 相关字段
  accountId?: string;
  workspaceId?: string;
  accounts?: any[];
  workspaces?: any[];
  workflows?: any[];
  files?: any[];
  executions?: any[];
  selectedWorkflow?: any;
  executionHistory?: any[];
  refreshing?: boolean;
  executing?: boolean;
  uploading?: boolean;

  // 通用字段
  loading: boolean;
  error: string | null;
}

export interface UseTabsResult {
  tabs: TabData[];
  activeTabId: string | null;
  activeTab: TabData | undefined;
  setActiveTabId: (id: string | null) => void;
  createTab: (tab: Omit<TabData, 'loading' | 'error'>) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  refreshTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabData>) => void;
  findExistingTab: (type: TabData['type'], identifier: string) => TabData | undefined;
  createCozeZoneTab: (accountId?: string) => void;
}

export const useTabs = (): UseTabsResult => {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // 获取当前激活的tab
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // 查找已存在的tab
  const findExistingTab = useCallback((type: TabData['type'], identifier: string) => {
    if (type === 'draft_editor') {
      return tabs.find(tab => tab.type === type && tab.draftPath === identifier);
    } else if (type === 'file_diff') {
      return tabs.find(tab => tab.type === type && tab.filePath === identifier);
    } else if (type === 'test_data') {
      return tabs.find(tab => tab.type === type && tab.testDataId === identifier);
    } else if (type === 'coze_zone') {
      return tabs.find(tab => tab.type === type && tab.accountId === identifier);
    }
    return undefined;
  }, [tabs]);

  // 创建新tab
  const createTab = useCallback((tabData: Omit<TabData, 'loading' | 'error'>) => {
    const newTab: TabData = {
      ...tabData,
      loading: false,
      error: null,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);

    return newTab;
  }, []);

  // 关闭tab
  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);

      // 如果关闭的是当前tab,切换到其他tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const closedIndex = prev.findIndex(tab => tab.id === tabId);
          const nextTab = newTabs[Math.min(closedIndex, newTabs.length - 1)];
          setActiveTabId(nextTab.id);
        } else {
          setActiveTabId(null);
        }
      }

      return newTabs;
    });
  }, [activeTabId]);

  // 关闭其他标签页
  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs(prev => {
      const targetTab = prev.find(tab => tab.id === tabId);
      if (!targetTab) return prev;

      setActiveTabId(tabId);
      return [targetTab];
    });
  }, []);

  // 刷新标签页
  const refreshTab = useCallback((tabId: string) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId
        ? { ...tab, loading: false, error: null }
        : tab
    ));
  }, []);

  // 更新tab
  const updateTab = useCallback((tabId: string, updates: Partial<TabData>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);

  // 创建 Coze Zone tab
  const createCozeZoneTab = useCallback((accountId?: string) => {
    const generateTabId = () => `coze_zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tabId = generateTabId();

    const newTab: TabData = {
      id: tabId,
      label: 'Coze Zone',
      type: 'coze_zone',
      accountId: accountId || 'default',
      workspaceId: '',
      accounts: [],
      workspaces: [],
      workflows: [],
      files: [],
      executions: [],
      executionHistory: [],
      refreshing: false,
      executing: false,
      uploading: false,
      loading: false,
      error: null,
    };

    setTabs(prev => {
      const updatedTabs = [...prev, newTab];
      // 保存到 localStorage
      const serializableTabs = updatedTabs.map(tab => {
        const { onTestData, ...rest } = tab;
        return rest;
      });
      localStorage.setItem('editorTabs', JSON.stringify(serializableTabs));
      return updatedTabs;
    });

    setActiveTabId(tabId);
    localStorage.setItem('activeTabId', tabId);
  }, []);

  // 从localStorage恢复tabs
  useEffect(() => {
    const savedTabs = localStorage.getItem('editorTabs');
    const savedActiveTabId = localStorage.getItem('activeTabId');

    if (savedTabs) {
      try {
        const parsedTabs: TabData[] = JSON.parse(savedTabs);
        setTabs(parsedTabs);

        if (savedActiveTabId && parsedTabs.some(t => t.id === savedActiveTabId)) {
          setActiveTabId(savedActiveTabId);
        } else if (parsedTabs.length > 0) {
          setActiveTabId(parsedTabs[0].id);
        }
      } catch (e) {
        console.error('恢复tabs失败:', e);
      }
    }
  }, []);

  // 保存tabs到localStorage
  useEffect(() => {
    if (tabs.length > 0) {
      // 序列化tabs时，需要处理不可序列化的字段
      const serializableTabs = tabs.map(tab => {
        // 移除函数字段，保留其他可序列化的数据
        const { onTestData, ...rest } = tab;
        return rest;
      });
      localStorage.setItem('editorTabs', JSON.stringify(serializableTabs));
    } else {
      localStorage.removeItem('editorTabs');
    }
  }, [tabs]);

  // 保存activeTabId到localStorage
  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('activeTabId', activeTabId);
    }
  }, [activeTabId]);

  return {
    tabs,
    activeTabId,
    activeTab,
    setActiveTabId,
    createTab,
    closeTab,
    closeOtherTabs,
    refreshTab,
    updateTab,
    findExistingTab,
    createCozeZoneTab,
  };
};