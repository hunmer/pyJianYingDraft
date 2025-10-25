'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Drawer,
  Tabs,
  List,
  Tab,
  Paper,
  Alert,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Divider,
  Menu,
  MenuItem,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  PlayArrow,
  Videocam,
  AudioFile,
  Info,
  ClearAll,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import DraftList from '@/components/DraftList';
import FileVersionList from '@/components/FileVersionList';
import FileDiffViewer from '@/components/FileDiffViewer';
import TimelineEditor from '@/components/Timeline';
import TestDataEditor from '@/components/TestDataEditor';
import { draftApi, tracksApi, materialsApi, type AllMaterialsResponse } from '@/lib/api';
import type { DraftInfo, TrackInfo, MaterialInfo } from '@/types/draft';
import type { RuleGroup, TestData, RuleGroupTestRequest } from '@/types/rule';
import { EXAMPLE_TEST_DATA } from '@/config/defaultRules';

// Tab数据接口
interface TabData {
  id: string;
  label: string;
  type: 'draft_editor' | 'file_diff' | 'test_data';
  // 草稿编辑器相关字段
  draftPath?: string;
  draftInfo?: DraftInfo | null;
  tracks?: TrackInfo[];
  materials?: MaterialInfo[];
  rawDraft?: Record<string, any> | null;
  materialCategories?: AllMaterialsResponse | null;
  ruleGroups?: RuleGroup[] | null;
  // 文件差异相关字段
  filePath?: string;
  // 测试数据相关字段
  testDataId?: string;
  onTestData?: (testData: TestData) => Promise<any> | any;
  testDataContext?: {
    ruleGroupId?: string;
    ruleGroup?: RuleGroup;
    materials?: MaterialInfo[];
    rawSegments?: any[];
    rawMaterials?: any[];
    useRawSegmentsHint?: boolean;
    initialTestData?: TestData;
  };
  // 通用字段
  loading: boolean;
  error: string | null;
}

const DRAWER_WIDTH = 280;

const cloneTestData = (data: TestData): TestData =>
  JSON.parse(JSON.stringify(data)) as TestData;

const TEST_DATA_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  data: TestData;
}> = [
  {
    id: 'example',
    label: '示例测试数据',
    description: '包含基础轨道与素材条目，可用于快速演示测试流程',
    data: cloneTestData(EXAMPLE_TEST_DATA),
  },
  {
    id: 'audio-focus',
    label: '音频轨道示例',
    description: '包含独立的视频与音频轨道，便于校验音频规则',
    data: {
      tracks: [
        { id: 'video_track', title: '视频轨道', type: 'video' },
        { id: 'audio_track', title: '音频轨道', type: 'audio' },
      ],
      items: [
        {
          type: 'video_clip',
          data: { track: 'video_track', start: 0, duration: 8, name: '视频片段' },
        },
        {
          type: 'audio_clip',
          data: { track: 'audio_track', start: 0, duration: 8, name: '背景音乐' },
        },
      ],
    },
  },
];

/**
 * 主页面 - 草稿编辑器
 */
export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // 左侧栏Tab状态 (0: 草稿列表, 1: 文件版本)
  const [leftTabValue, setLeftTabValue] = useState<number>(0);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    tabId: string;
  } | null>(null);
  const [allRuleGroups, setAllRuleGroups] = useState<RuleGroup[]>([]);
  const [loadingRuleGroups, setLoadingRuleGroups] = useState<boolean>(false);
  const [ruleGroupsError, setRuleGroupsError] = useState<string | null>(null);

  const handleRuleGroupsUpdate = useCallback((tabId: string, groups: RuleGroup[]) => {
    const normalized = groups.map(group => ({
      ...group,
      rules: Array.isArray(group.rules) ? group.rules.map(rule => ({ ...rule })) : [],
    }));
    setTabs(prev =>
      prev.map(tab => (tab.id === tabId ? { ...tab, ruleGroups: normalized } : tab)),
    );
  }, []);

  
  // 处理测试数据视图选择
  const handleTestDataSelect = useCallback((
    testDataId: string,
    label: string,
    onTest: (testData: any) => Promise<any> | any,
    context?: {
      ruleGroupId?: string;
      ruleGroup?: any;
      materials?: MaterialInfo[];
      rawSegments?: any[];
      rawMaterials?: any[];
      useRawSegmentsHint?: boolean;
      fullRequestPayload?: any;
      initialTestData?: TestData;
    }
  ) => {
    // 检查是否已经打开
    const existingTab = tabs.find(tab => tab.type === 'test_data' && tab.testDataId === testDataId);
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
    const newTab: TabData = {
      id: newTabId,
      label: `Test: ${label}`,
      type: 'test_data',
      testDataId,
      onTestData: onTest,
      testDataContext,
      loading: false,
      error: null,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  }, [tabs]);


  const handleOpenTestDataPreset = useCallback(
    (preset: (typeof TEST_DATA_PRESETS)[number]) => {
      const presetId = `preset-${preset.id}-${Date.now()}`;
      handleTestDataSelect(
        presetId,
        `预设: ${preset.label}`,
        async () => Promise.resolve(),
        {
          initialTestData: cloneTestData(preset.data),
        },
      );
    },
    [handleTestDataSelect],
  );

  // 处理文件差异视图选择
  const handleFileDiffSelect = useCallback((filePath: string) => {
    // 检查是否已经打开
    const existingTab = tabs.find(tab => tab.type === 'file_diff' && tab.filePath === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // 创建新tab
    const newTabId = `diff-${Date.now()}`;
    const newTab: TabData = {
      id: newTabId,
      label: `Diff: ${filePath.split('/').pop()}`,
      type: 'file_diff',
      filePath,
      loading: false,
      error: null,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  }, [tabs]);

  // 从后端加载所有规则组(从所有草稿目录收集)
  useEffect(() => {
    const loadRuleGroups = async () => {
      setLoadingRuleGroups(true);
      setRuleGroupsError(null);
      try {
        const response = await draftApi.getAllRuleGroups();
        setAllRuleGroups(response.rule_groups || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '加载规则组失败';
        setRuleGroupsError(errorMessage);
        console.error('加载规则组错误:', err);
      } finally {
        setLoadingRuleGroups(false);
      }
    };

    loadRuleGroups();

    // 从localStorage恢复tabs
    const savedTabs = localStorage.getItem('editorTabs');
    const savedActiveTabId = localStorage.getItem('activeTabId');

    if (savedTabs) {
      try {
        const parsedTabs: TabData[] = JSON.parse(savedTabs);

        // 为test_data类型的tab恢复onTestData回调函数(因为函数无法序列化)
        const restoredTabs = parsedTabs.map(tab => {
          if (tab.type === 'test_data' && !tab.onTestData) {
            // 创建一个使用保存的元数据的回调函数
            const onTestData = async (testData: TestData) => {
              console.log('[恢复的tab] 执行测试回调,testDataId:', tab.testDataId);

              // 检查是否有必要的元数据
              if (!tab.testDataContext?.ruleGroup) {
                throw new Error('缺少规则组信息，无法提交测试');
              }

              // 使用保存的元数据构建请求载荷
              const requestPayload: RuleGroupTestRequest = {
                ruleGroup: tab.testDataContext.ruleGroup,
                materials: tab.testDataContext.materials || [],
                testData,
                segment_styles: undefined,
                use_raw_segments: tab.testDataContext.useRawSegmentsHint || false,
                raw_segments: tab.testDataContext.rawSegments,
                raw_materials: tab.testDataContext.rawMaterials,
                draft_config: {
                  canvas_config: {
                    canvas_width: 1920,
                    canvas_height: 1080,
                  },
                  config: {
                    maintrack_adsorb: false,
                  },
                  fps: 30,
                },
              };

              // 提交异步任务
              const { tasksApi } = await import('@/lib/api');
              const response = await tasksApi.submit(requestPayload);
              console.log('[恢复的tab] 任务已提交:', response.task_id);

              // 返回包含task_id和完整请求载荷的响应，供TestDataEditor显示进度和下载
              return {
                ...response,
                ...requestPayload,
              };
            };

            return {
              ...tab,
              onTestData,
            };
          }
          return tab;
        });

        setTabs(restoredTabs);
        console.log('[页面恢复] 恢复了', restoredTabs.length, '个tabs');

        if (savedActiveTabId && restoredTabs.some(t => t.id === savedActiveTabId)) {
          setActiveTabId(savedActiveTabId);
        } else if (restoredTabs.length > 0) {
          setActiveTabId(restoredTabs[0].id);
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

  /**
   * 加载草稿数据
   */
  const loadDraftData = useCallback(async (tabId: string, draftPath: string) => {
    // 更新tab状态为loading
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, loading: true, error: null } : tab
    ));

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
      let flatMaterials: MaterialInfo[] = [];

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

      setTabs(prev => prev.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              draftInfo: info,
              tracks: info.tracks || [],
              materials: flatMaterials,
              rawDraft: raw,
              materialCategories: mats,
              ruleGroups: normalizedRuleGroups,
              loading: false,
              error: null,
            }
          : tab
      ));

      console.log('草稿加载成功:', info);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载草稿失败';

      setTabs(prev => prev.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              loading: false,
              error: errorMessage,
            }
          : tab
      ));

      console.error('加载草稿错误:', err);
    }
  }, []);

  /**
   * 处理草稿选择
   */
  const handleDraftSelect = useCallback((draftPath: string, draftName: string) => {
    // 检查是否已经打开
    const existingTab = tabs.find(tab => tab.type === 'draft_editor' && tab.draftPath === draftPath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // 创建新tab
    const newTabId = `draft-${Date.now()}`;
    const newTab: TabData = {
      id: newTabId,
      label: draftName,
      type: 'draft_editor',
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

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);

    // 加载草稿数据
    loadDraftData(newTabId, draftPath);
  }, [tabs, loadDraftData]);

  /**
   * 关闭tab
   */
  const handleCloseTab = useCallback((tabId: string) => {
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

  // 处理右键菜单打开
  const handleTabContextMenu = useCallback((event: React.MouseEvent, tabId: string) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            tabId,
          }
        : null,
    );
  }, [contextMenu]);

  // 关闭右键菜单
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 关闭其他标签页
  const handleCloseOtherTabs = useCallback((tabId: string) => {
    setTabs(prev => {
      const targetTab = prev.find(tab => tab.id === tabId);
      if (!targetTab) return prev;

      setActiveTabId(tabId);
      return [targetTab];
    });
    handleContextMenuClose();
  }, [handleContextMenuClose]);

  // 刷新标签页
  const handleRefreshTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // 根据tab类型执行刷新操作
    if (tab.type === 'draft_editor' && tab.draftPath) {
      // 重新加载草稿数据
      loadDraftData(tabId, tab.draftPath);
    } else if (tab.type === 'file_diff' && tab.filePath) {
      // 文件diff视图会通过FileDiffViewer组件内部的loadVersions自动刷新
      // 这里我们强制触发一次刷新,通过修改tab的key
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, loading: false, error: null }
          : t
      ));
    } else if (tab.type === 'test_data') {
      // 测试数据视图刷新 - 重置错误状态
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, error: null }
          : t
      ));
    }

    handleContextMenuClose();
  }, [tabs, loadDraftData, handleContextMenuClose]);

  /**
   * 切换tab
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTabId(newValue);
  };

  // 获取当前激活的tab
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 左侧边栏 */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* 左侧栏Tabs */}
        <Tabs
          value={leftTabValue}
          onChange={(_, newValue) => setLeftTabValue(newValue)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="草稿列表" />
          <Tab label="文件版本" />
          <Tab label="规则组" />
        </Tabs>

        {/* Tab内容 */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ 
            display: leftTabValue === 0 ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'auto'
          }}>
            <DraftList
              onDraftSelect={handleDraftSelect}
              onRulesUpdated={() => {
                if (activeTab?.draftPath) {
                  loadDraftData(activeTab.id, activeTab.draftPath);
                }
              }}
              selectedDraftPath={activeTab?.draftPath}
            />
          </Box>
          <Box sx={{ 
            display: leftTabValue === 1 ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'auto'
          }}>
            <FileVersionList
              selectedFilePath={tabs.find(t => t.id === activeTabId && t.type === 'file_diff')?.filePath}
              onFileSelect={handleFileDiffSelect}
            />
          </Box>
          <Box sx={{ 
            display: leftTabValue === 2 ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'auto',
            p: 2
          }}>
            {loadingRuleGroups ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                <CircularProgress />
              </Box>
            ) : ruleGroupsError ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {ruleGroupsError}
              </Alert>
            ) : allRuleGroups.length ? (
              <List dense>
                {allRuleGroups.map((group: any) => (
                  <ListItemButton
                    key={group.id}
                    onClick={() => {
                      handleTestDataSelect(
                        `${group.id}`,
                        `规则组: ${group.title}`,
                        async () => Promise.resolve(),
                        {
                          ruleGroupId: group.id,
                          ruleGroup: group,
                        }
                      );
                    }}
                    sx={{
                      mb: 1,
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                  >
                    <ListItemText
                      primary={group.title}
                      secondary={
                        <>
                          {group.rules.length} 条规则
                          {group.draft_name && (
                            <>
                              {' • '}
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  color: 'text.secondary',
                                  fontStyle: 'italic'
                                }}
                              >
                                来自: {group.draft_name}
                              </Typography>
                            </>
                          )}
                        </>
                      }
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  当前没有可用的规则组
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* 主内容区 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: drawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          transition: 'width 0.2s',
          overflow: 'hidden',
        }}
      >
        {/* 顶部工具栏 */}
        <Paper
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            px: 2,
            py: 1,
          }}
        >
          <IconButton
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Tooltip title="下载管理">
            <IconButton
              onClick={() => window.location.href = '/downloads'}
              sx={{ mr: 2 }}
              color="primary"
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>

          {/* Tabs */}
          {tabs.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <Tabs
                value={activeTabId || false}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  maxWidth: '100%',
                  '& .MuiTabs-flexContainer': {
                    gap: 0.5,
                  },
                  '& .MuiTabs-scroller': {
                    overflow: 'auto !important',
                  },
                }}
              >
                {tabs.map(tab => (
                  <Tab
                    key={tab.id}
                    value={tab.id}
                    onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                    sx={{
                      minWidth: 120,
                      maxWidth: 200,
                      flex: '0 0 auto',
                      '& .MuiTab-wrapper': {
                        width: '100%',
                      }
                    }}
                    label={
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        width: '100%',
                        overflow: 'hidden'
                      }}>
                        <Box
                          component="span"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0
                          }}
                        >
                          {tab.label}
                        </Box>
                        <Box
                          component="span"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            ml: 0.5,
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </Box>
                      </Box>
                    }
                  />
                ))}
              </Tabs>
            </Box>
          )}
        </Paper>

        {/* 内容区域 */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {/* 文件版本Diff视图 */}
          {activeTab?.type === 'file_diff' && (
            <FileDiffViewer filePath={activeTab.filePath!} />
          )}

          {/* 测试数据视图 */}
          {activeTab?.type === 'test_data' && activeTab.onTestData && (
            <TestDataEditor
              testDataId={activeTab.testDataId!}
              onTest={activeTab.onTestData}
              ruleGroupId={activeTab.testDataContext?.ruleGroupId}
              ruleGroup={activeTab.testDataContext?.ruleGroup}
              materials={activeTab.testDataContext?.materials}
              rawSegments={activeTab.testDataContext?.rawSegments}
              rawMaterials={activeTab.testDataContext?.rawMaterials}
              useRawSegmentsHint={activeTab.testDataContext?.useRawSegmentsHint}
              initialTestData={activeTab.testDataContext?.initialTestData}
            />
          )}

          {/* 草稿选择提示 */}
          {!activeTab && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Typography variant="h6" color="text.secondary">
                请从左侧选择一个草稿开始编辑
              </Typography>
            </Box>
          )}

          {activeTab && activeTab.loading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {activeTab && activeTab.error && (
            <Alert severity="error" onClose={() => {
              setTabs(prev => prev.map(tab =>
                tab.id === activeTab.id ? { ...tab, error: null } : tab
              ));
            }}>
              {activeTab.error}
            </Alert>
          )}

          {/* 草稿编辑器内容 */}
          {activeTab?.type === 'draft_editor' && activeTab.draftInfo && !activeTab.loading && !activeTab.error && (
            <>
              {/* 草稿信息卡片 */}
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Info color="primary" />
                          <Typography variant="h6">分辨率</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {activeTab.draftInfo.width} × {activeTab.draftInfo.height}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {activeTab.draftInfo.fps} FPS
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <PlayArrow color="primary" />
                          <Typography variant="h6">时长</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {activeTab.draftInfo.duration_seconds.toFixed(2)}s
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(activeTab.draftInfo.duration / 1000000).toFixed(0)} 微秒
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Videocam color="primary" />
                          <Typography variant="h6">轨道</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {activeTab.draftInfo.track_count}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(activeTab.tracks || []).filter(t => t.type === 'video').length} 视频 /{' '}
                          {(activeTab.tracks || []).filter(t => t.type === 'audio').length} 音频 /{' '}
                          {(activeTab.tracks || []).filter(t => t.type === 'text').length} 文本
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <AudioFile color="primary" />
                          <Typography variant="h6">素材</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {(activeTab.materials || []).length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(activeTab.materials || []).filter(m => m.type === 'video').length} 视频 /{' '}
                          {(activeTab.materials || []).filter(m => m.type === 'audio').length} 音频 /{' '}
                          {(activeTab.materials || []).filter(m => m.type === 'text').length} 文本
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>

              {/* 测试数据预设 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  测试数据预设
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {TEST_DATA_PRESETS.map((preset) => (
                    <Tooltip key={preset.id} title={preset.description}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenTestDataPreset(preset)}
                      >
                        {preset.label}
                      </Button>
                    </Tooltip>
                  ))}
                </Box>
              </Box>

              {/* 时间轴编辑器 */}
              {(activeTab.tracks || []).length > 0 && (
                <TimelineEditor
                  tracks={activeTab.tracks || []}
                  materials={activeTab.materials || []}
                  duration={activeTab.draftInfo.duration_seconds}
                  rawDraft={activeTab.rawDraft ?? undefined}
                  rawMaterials={activeTab.materialCategories ?? undefined}
                  canvasWidth={activeTab.draftInfo.width}
                  canvasHeight={activeTab.draftInfo.height}
                  fps={activeTab.draftInfo.fps}
                  readOnly={true}
                  draftPath={activeTab.draftPath}
                  initialRuleGroups={activeTab.ruleGroups ?? undefined}
                  onRuleGroupsChange={(groups) => handleRuleGroupsUpdate(activeTab.id, groups)}
                  handleTestDataSelect={handleTestDataSelect}
                />
              )}
            </>
          )}
        </Box>
      </Box>

      {/* 右键菜单 */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              handleRefreshTab(contextMenu.tabId);
            }
          }}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>刷新</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              handleCloseTab(contextMenu.tabId);
              handleContextMenuClose();
            }
          }}
        >
          <ListItemIcon>
            <CloseIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>关闭</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              handleCloseOtherTabs(contextMenu.tabId);
            }
          }}
        >
          <ListItemIcon>
            <ClearAll fontSize="small" />
          </ListItemIcon>
          <ListItemText>关闭其他</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
