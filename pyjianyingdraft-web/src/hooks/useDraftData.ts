'use client';

import { useCallback } from 'react';
import { draftApi, materialsApi, type AllMaterialsResponse } from '@/lib/api';
import type { RuleGroup } from '@/types/rule';

const cloneTestData = (data: any): any =>
  JSON.parse(JSON.stringify(data));

export const useDraftData = () => {
  /**
   * 加载草稿数据
   */
  const loadDraftData = useCallback(async (
    tabId: string,
    draftPath: string,
    updateTab: (tabId: string, updates: any) => void
  ) => {
    // 更新tab状态为loading
    updateTab(tabId, { loading: true, error: null });

    try {
      // 1. 验证文件
      const validation = await draftApi.validate(draftPath);
      if (!validation.valid) {
        throw new Error(validation.message || '草稿文件无效');
      }

      // 2. 获取草稿基础信息
      const info = await draftApi.getInfo(draftPath);
      const raw = await draftApi.getRaw(draftPath);

      // 3. 获取素材信息
      let mats: AllMaterialsResponse | null = null;
      let flatMaterials: any[] = [];

      try {
        mats = await materialsApi.getAll(draftPath);
        flatMaterials = Object.values(mats).flatMap((category) => category?.items || []);
      } catch (err) {
        console.warn('获取素材信息失败:', err);
      }

      // 4. 获取草稿规则组
      let ruleGroups: RuleGroup[] = [];
      try {
        const response = await draftApi.getDraftRuleGroups(draftPath);
        ruleGroups = Array.isArray(response.rule_groups) ? response.rule_groups : [];
      } catch (err) {
        console.warn('获取草稿规则组失败:', err);
      }

      // 更新tab数据
      const normalizedRuleGroups = ruleGroups.map(group => ({
        ...group,
        rules: Array.isArray(group.rules) ? group.rules.map(rule => ({ ...rule })) : [],
      }));

      updateTab(tabId, {
        draftInfo: info,
        tracks: info.tracks || [],
        materials: flatMaterials,
        rawDraft: raw,
        materialCategories: mats,
        ruleGroups: normalizedRuleGroups,
        loading: false,
        error: null,
      });

      console.log('草稿加载成功:', info);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载草稿失败';

      updateTab(tabId, {
        loading: false,
        error: errorMessage,
      });

      console.error('加载草稿错误:', err);
    }
  }, []);

  /**
   * 处理测试数据选择
   */
  const handleTestDataSelect = useCallback((
    testDataId: string,
    label: string,
    onTest: (testData: any) => Promise<any> | any,
    context?: {
      ruleGroupId?: string;
      ruleGroup?: any;
      materials?: any[];
      rawSegments?: any[];
      rawMaterials?: any[];
      useRawSegmentsHint?: boolean;
      initialTestData?: any;
    },
    createTab: (tab: any) => void,
    findExistingTab: (type: any, identifier: string) => any,
    setActiveTabId: (id: string) => void
  ) => {
    // 检查是否已经打开
    const existingTab = findExistingTab('test_data', testDataId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const testDataContext = context
      ? {
          ...context,
          initialTestData: context.initialTestData
            ? cloneTestData(context.initialTestData)
            : context.initialTestData,
        }
      : undefined;

    // 创建新tab
    const newTabId = `test-${Date.now()}`;
    const newTab = {
      id: newTabId,
      label: `Test: ${label}`,
      type: 'test_data' as const,
      testDataId,
      onTestData: onTest,
      testDataContext,
      loading: false,
      error: null,
    };

    createTab(newTab);
    setActiveTabId(newTabId);
  }, []);

  /**
   * 处理文件差异视图选择
   */
  const handleFileDiffSelect = useCallback((
    filePath: string,
    createTab: (tab: any) => void,
    findExistingTab: (type: any, identifier: string) => any,
    setActiveTabId: (id: string) => void
  ) => {
    // 检查是否已经打开
    const existingTab = findExistingTab('file_diff', filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // 创建新tab
    const newTabId = `diff-${Date.now()}`;
    const newTab = {
      id: newTabId,
      label: `Diff: ${filePath.split('/').pop()}`,
      type: 'file_diff' as const,
      filePath,
      loading: false,
      error: null,
    };

    createTab(newTab);
    setActiveTabId(newTabId);
  }, []);

  /**
   * 处理草稿选择
   */
  const handleDraftSelect = useCallback((
    draftPath: string,
    draftName: string,
    createTab: (tab: any) => void,
    findExistingTab: (type: any, identifier: string) => any,
    setActiveTabId: (id: string) => void,
    loadDraftData: (tabId: string, draftPath: string) => void
  ) => {
    // 检查是否已经打开
    const existingTab = findExistingTab('draft_editor', draftPath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // 创建新tab
    const newTabId = `draft-${Date.now()}`;
    const newTab = {
      id: newTabId,
      label: draftName,
      type: 'draft_editor' as const,
      draftPath,
      draftInfo: null,
      tracks: [],
      materials: [],
      rawDraft: null,
      materialCategories: null,
      ruleGroups: null,
      loading: false,
      error: null,
    };

    createTab(newTab);
    setActiveTabId(newTabId);

    // 加载草稿数据
    loadDraftData(newTabId, draftPath);
  }, []);

  return {
    loadDraftData,
    handleTestDataSelect,
    handleFileDiffSelect,
    handleDraftSelect,
  };
};