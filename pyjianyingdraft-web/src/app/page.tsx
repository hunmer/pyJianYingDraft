'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Drawer,
  Tabs,
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  PlayArrow,
  Videocam,
  AudioFile,
  Info,
} from '@mui/icons-material';
import DraftList from '@/components/DraftList';
import FileVersionList from '@/components/FileVersionList';
import FileDiffViewer from '@/components/FileDiffViewer';
import TimelineEditor from '@/components/Timeline';
import TestDataPage from '@/components/TestDataPage';
import { draftApi, tracksApi, materialsApi, type AllMaterialsResponse } from '@/lib/api';
import type { DraftInfo, TrackInfo, MaterialInfo } from '@/types/draft';

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
  // 文件差异相关字段
  filePath?: string;
  // 测试数据相关字段
  testDataId?: string;
  // 通用字段
  loading: boolean;
  error: string | null;
}

const DRAWER_WIDTH = 280;

/**
 * 主页面 - 草稿编辑器
 */
export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // 左侧栏Tab状态 (0: 草稿列表, 1: 文件版本)
  const [leftTabValue, setLeftTabValue] = useState<number>(0);

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

  // 处理测试数据视图选择
  const handleTestDataSelect = useCallback((testDataId: string, label: string) => {
    // 检查是否已经打开
    const existingTab = tabs.find(tab => tab.type === 'test_data' && tab.testDataId === testDataId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // 创建新tab
    const newTabId = `test-${Date.now()}`;
    const newTab: TabData = {
      id: newTabId,
      label: `Test: ${label}`,
      type: 'test_data',
      testDataId,
      loading: false,
      error: null,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  }, [tabs]);

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
      localStorage.setItem('editorTabs', JSON.stringify(tabs));
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

      // 更新tab数据
      setTabs(prev => prev.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              draftInfo: info,
              tracks: info.tracks || [],
              materials: flatMaterials,
              rawDraft: raw,
              materialCategories: mats,
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
            {drawerOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>

          {/* Tabs */}
          {tabs.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Tabs
                value={activeTabId || false}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ flex: 1 }}
              >
                {tabs.map(tab => (
                  <Tab
                    key={tab.id}
                    value={tab.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {tab.label}
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
          {activeTab?.type === 'test_data' && (
            <TestDataPage testDataId={activeTab.testDataId!} />
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
                          {activeTab.tracks.filter(t => t.type === 'video').length} 视频 /{' '}
                          {activeTab.tracks.filter(t => t.type === 'audio').length} 音频 /{' '}
                          {activeTab.tracks.filter(t => t.type === 'text').length} 文本
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
                          {activeTab.materials.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {activeTab.materials.filter(m => m.type === 'video').length} 视频 /{' '}
                          {activeTab.materials.filter(m => m.type === 'audio').length} 音频 /{' '}
                          {activeTab.materials.filter(m => m.type === 'text').length} 文本
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>

              {/* 时间轴编辑器 */}
              {activeTab.tracks.length > 0 && (
                <TimelineEditor
                  tracks={activeTab.tracks}
                  materials={activeTab.materials}
                  duration={activeTab.draftInfo.duration_seconds}
                  rawDraft={activeTab.rawDraft ?? undefined}
                  rawMaterials={activeTab.materialCategories ?? undefined}
                  canvasWidth={activeTab.draftInfo.width}
                  canvasHeight={activeTab.draftInfo.height}
                  fps={activeTab.draftInfo.fps}
                  readOnly={true}
                  onAddTestDataTab={handleTestDataSelect}
                />
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
