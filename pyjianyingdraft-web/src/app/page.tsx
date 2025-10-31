'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Alert,
  CircularProgress,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  SmartToy as CozeIcon,
} from '@mui/icons-material';
import { draftApi } from '@/lib/api';
import { getSidebarState, setSidebarState } from '@/lib/storage';
import type { RuleGroup, TestData, RuleGroupTestRequest } from '@/types/rule';
import { useTabs } from '@/hooks/useTabs';
import { useDraftData } from '@/hooks/useDraftData';
import { TabManager } from '@/components/TabManager';
import { SideBar } from '@/components/SideBar';
import { TabContextMenu } from '@/components/TabContextMenu';
import { DialogManager } from '@/components/DialogManager';
import { DraftEditor } from '@/components/DraftEditor';
import FileDiffViewer from '@/components/FileDiffViewer';
import TestDataEditorWithTabs from '@/components/TestDataEditorWithTabs';
import FileVersionList, { type FileVersionListHandle } from '@/components/FileVersionList';
import CozeZone from '@/components/CozeZone';
import WorkflowExecutionPanel from '@/components/WorkflowExecutionPanel';

/**
 * 主页面 - 草稿编辑器
 */
export default function Home() {
  // 状态管理
  const [drawerOpen, setDrawerOpen] = useState<boolean>(() => {
    // 从本地存储加载侧边栏状态
    const sidebarState = getSidebarState();
    return sidebarState.isOpen;
  });
  const fileVersionListRef = useRef<FileVersionListHandle>(null);

  // 下载管理器 Dialog 状态
  const [downloadDialogOpen, setDownloadDialogOpen] = useState<boolean>(false);
  const [activeDownloadTaskId, setActiveDownloadTaskId] = useState<string | undefined>(undefined);

  // 生成记录 Dialog 状态
  const [generationRecordsDialogOpen, setGenerationRecordsDialogOpen] = useState<boolean>(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    tabId: string;
  } | null>(null);

  // 规则组状态
  const [allRuleGroups, setAllRuleGroups] = useState<RuleGroup[]>([]);
  const [loadingRuleGroups, setLoadingRuleGroups] = useState<boolean>(false);
  const [ruleGroupsError, setRuleGroupsError] = useState<string | null>(null);

  // 使用自定义 Hook
  const {
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
  } = useTabs();

  const {
    loadDraftData,
    handleTestDataSelect,
    handleFileDiffSelect,
    handleDraftSelect,
  } = useDraftData();

  const handleRuleGroupsUpdate = useCallback((tabId: string, groups: RuleGroup[]) => {
    const normalized = groups.map(group => ({
      ...group,
      rules: Array.isArray(group.rules) ? group.rules.map(rule => ({ ...rule })) : [],
    }));
    updateTab(tabId, { ruleGroups: normalized });
  }, [updateTab]);

  /**
   * 加载所有规则组
   */
  const loadAllRuleGroups = useCallback(async () => {
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
  }, []);

  // 初始化加载规则组和恢复tabs
  useEffect(() => {
    loadAllRuleGroups();
  }, []);

  
  // 处理设置文件版本检测
  const handleSetFileVersionWatch = useCallback((draftPath: string) => {
    // 打开添加对话框并预填充路径
    setTimeout(() => {
      fileVersionListRef.current?.openAddDialog(draftPath);
    }, 100);
  }, []);

  // 处理草稿选择
  const handleDraftSelectWrapper = useCallback((draftPath: string, draftName: string) => {
    handleDraftSelect(
      draftPath,
      draftName,
      createTab,
      findExistingTab,
      setActiveTabId,
      (tabId: string, draftPath: string) => loadDraftData(tabId, draftPath, updateTab)
    );
  }, [handleDraftSelect, createTab, findExistingTab, setActiveTabId, updateTab]);

  // 处理测试数据选择
  const handleTestDataSelectWrapper = useCallback((
    testDataId: string,
    label: string,
    onTest: (testData: any) => Promise<any>,
    context?: any
  ) => {
    handleTestDataSelect(testDataId, label, onTest, context, createTab, findExistingTab, setActiveTabId);
  }, [handleTestDataSelect, createTab, findExistingTab, setActiveTabId]);

  // 处理文件差异视图选择
  const handleFileDiffSelectWrapper = useCallback((filePath: string) => {
    handleFileDiffSelect(filePath, createTab, findExistingTab, setActiveTabId);
  }, [handleFileDiffSelect, createTab, findExistingTab, setActiveTabId]);

  // 处理右键菜单打开
  const handleTabContextMenu = useCallback((event: React.MouseEvent, tabId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      tabId,
    });
  }, []);

  // 关闭右键菜单
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 处理刷新标签页
  const handleRefreshTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // 根据tab类型执行刷新操作
    if (tab.type === 'draft_editor' && tab.draftPath) {
      // 重新加载草稿数据
      loadDraftData(tabId, tab.draftPath, updateTab);
    } else {
      // 其他类型刷新 - 重置错误状态
      updateTab(tabId, { error: null });
    }

    handleContextMenuClose();
  }, [tabs, loadDraftData, updateTab, handleContextMenuClose]);

  // 处理右键菜单操作
  const handleContextMenuRefresh = useCallback(() => {
    if (contextMenu) {
      handleRefreshTab(contextMenu.tabId);
    }
  }, [contextMenu, handleRefreshTab]);

  const handleContextMenuCloseTab = useCallback(() => {
    if (contextMenu) {
      closeTab(contextMenu.tabId);
      handleContextMenuClose();
    }
  }, [contextMenu, closeTab, handleContextMenuClose]);

  const handleContextMenuCloseOthers = useCallback(() => {
    if (contextMenu) {
      closeOtherTabs(contextMenu.tabId);
    }
  }, [contextMenu, closeOtherTabs]);

  /**
   * 处理打开下载管理器
   */
  const handleOpenDownloadManager = useCallback((taskId?: string) => {
    setActiveDownloadTaskId(taskId);
    setDownloadDialogOpen(true);
    // 关闭生成记录对话框
    setGenerationRecordsDialogOpen(false);
  }, []);

  /**
   * 处理重新导入（从生成记录）
   */
  const handleReimport = useCallback(async (record: any) => {
    console.log('[页面] 重新导入生成记录:', record.record_id);

    // 使用记录ID作为唯一标识创建test data tab
    const testDataId = `reimport-${record.record_id}`;
    const label = `重新导入: ${record.rule_group_title || '未命名'}`;

    // 创建提交回调
    const onTest = async (testData: TestData) => {
      console.log('[重新导入] 执行测试回调, record_id:', record.record_id);

      // 使用保存的元数据构建请求载荷
      const requestPayload: RuleGroupTestRequest = {
        ruleGroup: record.rule_group,
        materials: record.materials || [],
        testData,
        segment_styles: record.segment_styles,
        use_raw_segments: record.use_raw_segments || false,
        raw_segments: record.raw_segments,
        raw_materials: record.raw_materials,
        draft_config: record.draft_config || {
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

      // 提交异步任务，使用相同的record_id
      const { tasksApi } = await import('@/lib/api');
      const response = await tasksApi.submit(requestPayload);
      console.log('[重新导入] 任务已提交:', response.task_id);

      // 更新生成记录的task_id
      try {
        const { generationRecordsApi } = await import('@/lib/api');
        await generationRecordsApi.update(record.record_id, {
          ...record,
          task_id: response.task_id,
          status: 'pending',
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[重新导入] 更新生成记录失败:', error);
      }

      // 返回包含task_id和完整请求载荷的响应
      return {
        ...response,
        ...requestPayload,
        record_id: record.record_id,
      };
    };

    // 使用新的包装函数
    handleTestDataSelectWrapper(
      testDataId,
      label,
      onTest,
      {
        ruleGroupId: record.rule_group_id,
        ruleGroup: record.rule_group,
        materials: record.materials,
        rawSegments: record.raw_segments,
        rawMaterials: record.raw_materials,
        useRawSegmentsHint: record.use_raw_segments,
        initialTestData: record.test_data,
      }
    );
  }, [handleTestDataSelectWrapper]);

  
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 侧边栏 */}
      <SideBar
        open={drawerOpen}
        selectedDraftPath={activeTab?.draftPath}
        selectedFilePath={tabs.find(t => t.id === activeTabId && t.type === 'file_diff')?.filePath}
        ruleGroups={allRuleGroups}
        ruleGroupsLoading={loadingRuleGroups}
        ruleGroupsError={ruleGroupsError}
        onDraftSelect={handleDraftSelectWrapper}
        onRulesUpdated={() => {
          if (activeTab?.draftPath) {
            loadDraftData(activeTab.id, activeTab.draftPath, updateTab);
          }
        }}
        onDraftRootChanged={loadAllRuleGroups}
        onSetFileVersionWatch={handleSetFileVersionWatch}
        onFileSelect={handleFileDiffSelectWrapper}
        onRuleGroupsRefresh={loadAllRuleGroups}
        onRuleGroupSelect={(ruleGroupId, ruleGroup, onTest) => {
          handleTestDataSelectWrapper(
            ruleGroupId,
            `规则组: ${ruleGroup.title}`,
            onTest,
            {
              ruleGroupId,
              ruleGroup,
              initialTestData: {
                tracks: [],
                items: [],
              },
            }
          );
        }}
        fileVersionListRef={fileVersionListRef}
      />

      {/* 主内容区 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: drawerOpen ? `calc(100% - 280px)` : '100%',
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
            onClick={() => {
              const newOpenState = !drawerOpen;
              setDrawerOpen(newOpenState);
              setSidebarState(newOpenState); // 保存到本地存储
            }}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Tooltip title="下载管理">
            <IconButton
              onClick={() => setDownloadDialogOpen(true)}
              sx={{ mr: 2 }}
              color="primary"
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="生成记录">
            <IconButton
              onClick={() => setGenerationRecordsDialogOpen(true)}
              sx={{ mr: 2 }}
              color="secondary"
            >
              <HistoryIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Coze Zone - AI 工作流管理">
            <IconButton
              onClick={() => createCozeZoneTab()}
              sx={{ mr: 2 }}
              color="info"
            >
              <CozeIcon />
            </IconButton>
          </Tooltip>

          {/* Tab管理器 */}
          <TabManager
            tabs={tabs}
            activeTabId={activeTabId}
            onTabChange={setActiveTabId}
            onCloseTab={closeTab}
            onTabContextMenu={handleTabContextMenu}
          />
        </Paper>

        {/* 内容区域 */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {/* 文件版本Diff视图 */}
          {activeTab?.type === 'file_diff' && (
            <FileDiffViewer filePath={activeTab.filePath!} />
          )}

          {/* 测试数据视图 */}
          {activeTab?.type === 'test_data' && activeTab.onTestData && (
            <TestDataEditorWithTabs
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
              updateTab(activeTab.id, { error: null });
            }}>
              {activeTab.error}
            </Alert>
          )}

          {/* 草稿编辑器内容 */}
          {activeTab?.type === 'draft_editor' && (
            <DraftEditor
              tab={activeTab}
              onRuleGroupsUpdate={handleRuleGroupsUpdate}
              onTestDataSelect={handleTestDataSelectWrapper}
            />
          )}

          {/* Coze Zone 内容 */}
          {activeTab?.type === 'coze_zone' && (
            <CozeZone
              tab={activeTab}
              onTabUpdate={updateTab}
              onCreateWorkflowExecutionTab={(workflow, callbacks) => {
                const tabId = `workflow_execution_${workflow.id}_${Date.now()}`;
                createTab({
                  id: tabId,
                  label: `执行: ${workflow.name}`,
                  type: 'workflow_execution',
                  workflowId: workflow.id,
                  workflow: workflow,
                  onExecuteWorkflow: callbacks.onExecute,
                  onCancelWorkflow: callbacks.onCancel,
                  onCreateTask: callbacks.onCreateTask,
                  onCreateAndExecuteTask: callbacks.onCreateAndExecuteTask,
                  workflowEventLogs: [],
                  accountId: activeTab.accountId,
                });
              }}
            />
          )}

          {/* Workflow Execution 内容 */}
          {activeTab?.type === 'workflow_execution' && activeTab.workflow && (
            <WorkflowExecutionPanel
              workflow={activeTab.workflow}
              onExecute={activeTab.onExecuteWorkflow || (async () => {})}
              onCancel={activeTab.onCancelWorkflow || (() => {})}
              accountId={activeTab.accountId}
              eventLogs={activeTab.workflowEventLogs || []}
              onCreateTask={activeTab.onCreateTask}
              onCreateAndExecuteTask={activeTab.onCreateAndExecuteTask}
              showActions={true}
            />
          )}
        </Box>
      </Box>

      {/* 右键菜单 */}
      <TabContextMenu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        onRefresh={handleContextMenuRefresh}
        onCloseTab={handleContextMenuCloseTab}
        onCloseOtherTabs={handleContextMenuCloseOthers}
      />

      {/* 对话框管理 */}
      <DialogManager
        downloadDialogOpen={downloadDialogOpen}
        generationRecordsDialogOpen={generationRecordsDialogOpen}
        activeDownloadTaskId={activeDownloadTaskId}
        onCloseDownloadDialog={() => {
          setDownloadDialogOpen(false);
          setActiveDownloadTaskId(undefined);
        }}
        onCloseGenerationRecordsDialog={() => setGenerationRecordsDialogOpen(false)}
        onReimport={handleReimport}
        onOpenDownloadManager={handleOpenDownloadManager}
      />
    </Box>
  );
}
