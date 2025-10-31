'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Tab,
  Tabs,
  Button,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Stop as StopIcon,
  Input as InputIcon,
  Output as OutputIcon,
  AddTask as AddTaskIcon,
} from '@mui/icons-material';
import { CozeWorkflow, WorkflowStreamEvent, WorkflowStreamState, WorkflowEventLog, CreateTaskRequest } from '@/types/coze';
import WorkflowParameterEditor from './WorkflowParameterEditor';
import WorkflowEventLogPanel from './WorkflowEventLogPanel';
import WorkflowQuickCreateTaskPanel from './WorkflowQuickCreateTaskPanel';
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import api from '@/lib/api';

interface WorkflowExecutionPanelProps {
  workflow: CozeWorkflow;
  onExecute: (workflowId: string, parameters: Record<string, any>, onStreamEvent?: (event: WorkflowStreamEvent) => void) => Promise<any>;
  onCancel: () => void;
  accountId?: string;
  eventLogs: WorkflowEventLog[];
  onCreateTask?: (taskData: CreateTaskRequest) => Promise<any>;
  onCreateAndExecuteTask?: (taskData: CreateTaskRequest) => Promise<any>;
  showActions?: boolean;
}

const EventLogsContext = React.createContext<WorkflowEventLog[]>([]);

const IsolatedEventLogPanel: React.FC<{ workflowId?: string; workflowName?: string; height?: string | number }> = React.memo((({
  workflowId,
  workflowName,
  height = "100%"
}) => {
  const eventLogs = React.useContext(EventLogsContext);

  return (
    <WorkflowEventLogPanel
      eventLogs={eventLogs}
      workflowId={workflowId}
      workflowName={workflowName}
      height={height}
    />
  );
}));

const EventLogsProvider: React.FC<{ children: React.ReactNode; eventLogs: WorkflowEventLog[] }> = React.memo(({ children, eventLogs }) => {
  return (
    <EventLogsContext.Provider value={eventLogs}>
      {children}
    </EventLogsContext.Provider>
  );
});

const WorkflowExecutionPanel: React.FC<WorkflowExecutionPanelProps> = ({
  workflow,
  onExecute,
  onCancel,
  accountId = 'default',
  eventLogs,
  onCreateTask,
  onCreateAndExecuteTask,
  showActions = true,
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const lastParametersRef = useRef<Record<string, any>>({});

  const handleParametersChange = useCallback((newParameters: Record<string, any>) => {
    if (JSON.stringify(lastParametersRef.current) === JSON.stringify(newParameters)) {
      return;
    }
    lastParametersRef.current = newParameters;
    setParameters(newParameters);
  }, []);

  const [outputData, setOutputData] = useState<any>(null);
  const [streamState, setStreamState] = useState<WorkflowStreamState>({
    isStreaming: false,
    events: [],
    status: 'running',
  });

  const [leftTabValue, setLeftTabValue] = useState(0);
  const [detailedWorkflow, setDetailedWorkflow] = useState<CozeWorkflow | null>(null);
  const [loadingWorkflowInfo, setLoadingWorkflowInfo] = useState(false);
  const [workflowInfoError, setWorkflowInfoError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchedWorkflowIdRef = useRef<string | null>(null);
  const initializedRef = useRef<boolean>(false);

  const fetchWorkflowDetails = useCallback(async (workflowId: string, fallbackWorkflow?: CozeWorkflow) => {
    setLoadingWorkflowInfo(true);
    setWorkflowInfoError(null);

    try {
      const response = await api.coze.getWorkflow(workflowId, accountId);

      if (!response.success) {
        throw new Error('获取工作流详细信息失败');
      }

      const workflowData = response.workflow;

      const detailedWorkflow: CozeWorkflow = {
        id: workflowData.id,
        name: workflowData.name,
        description: workflowData.description || '',
        created_time: workflowData.created_at ? new Date(workflowData.created_at * 1000).toISOString() :
                      workflowData.created_time ? new Date(workflowData.created_time * 1000).toISOString() :
                      new Date().toISOString(),
        updated_time: workflowData.updated_at ? new Date(workflowData.updated_at * 1000).toISOString() :
                      workflowData.updated_time ? new Date(workflowData.updated_time * 1000).toISOString() :
                      new Date().toISOString(),
        version: fallbackWorkflow?.version || 1,
        input_schema: workflowData.input_schema,
        output_schema: workflowData.output_schema,
        status: 'active',
        icon_url: workflowData.icon_url || '',
        app_id: workflowData.app_id || '',
        creator_id: workflowData.creator?.user_id || '',
        creator_name: workflowData.creator?.user_name || '',
      };

      setDetailedWorkflow(detailedWorkflow);
    } catch (error) {
      console.error('获取工作流详细信息失败:', error);
      setWorkflowInfoError(
        error instanceof Error ? error.message : '获取工作流详细信息失败'
      );
      setDetailedWorkflow(fallbackWorkflow || null);
    } finally {
      setLoadingWorkflowInfo(false);
    }
  }, [accountId]);

  useEffect(() => {
    const isWorkflowChanged = workflow?.id !== fetchedWorkflowIdRef.current;

    if (!initializedRef.current || isWorkflowChanged) {
      setParameters({});
      lastParametersRef.current = {};
      setOutputData(null);
      setStreamState({
        isStreaming: false,
        events: [],
        status: 'running',
      });
      setDetailedWorkflow(null);
      setWorkflowInfoError(null);
      initializedRef.current = true;
    }

    if (workflow && workflow.id !== fetchedWorkflowIdRef.current) {
      fetchedWorkflowIdRef.current = workflow.id;
      fetchWorkflowDetails(workflow.id, workflow);
    }
  }, [workflow?.id, fetchWorkflowDetails]);

  const addStreamEvent = useCallback((event: WorkflowEventLog) => {
    setStreamState(prev => ({
      ...prev,
      events: [...prev.events, event],
      status: event.event === 'workflow_finished' ? 'finished' :
              event.event === 'error' ? 'failed' : prev.status,
      output: event.event === 'workflow_finished' ? event.data : prev.output,
    }));
  }, []);

  const handleExecute = async () => {
    if (!workflow) return;

    const workflowToExecute = detailedWorkflow || workflow;

    setStreamState({
      isStreaming: true,
      events: [],
      status: 'running',
      startTime: new Date().toISOString(),
    });
    setOutputData(null);

    abortControllerRef.current = new AbortController();

    try {
      const onStreamEvent = (event: WorkflowStreamEvent) => {
        const eventLog: WorkflowEventLog = {
          event: event.event,
          data: event.data,
          timestamp: new Date().toISOString(),
        };

        addStreamEvent(eventLog);

        if (event.event === 'workflow_finished' || event.event === 'error') {
          addStreamEvent(eventLog);
        }

        if (event.event === 'workflow_finished' && event.data) {
          setOutputData(event.data);
        }
      };

      const result = await onExecute(workflowToExecute.id, parameters, onStreamEvent);

      setStreamState(prev => {
        const hasOutputFromStream = Object.keys(prev.output || {}).length > 0;
        return {
          ...prev,
          isStreaming: false,
          endTime: new Date().toISOString(),
          output: hasOutputFromStream ? prev.output : (result?.data?.output_data || {}),
        };
      });

    } catch (error) {
      console.error('工作流执行失败:', error);
      setStreamState(prev => ({
        ...prev,
        status: 'failed',
        isStreaming: false,
        endTime: new Date().toISOString(),
        error: error instanceof Error ? error.message : '未知错误',
      }));

      addStreamEvent({
        event: 'error',
        data: { message: error instanceof Error ? error.message : '未知错误' },
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onCancel();
  };

  const currentWorkflow = useMemo(() => detailedWorkflow || workflow, [detailedWorkflow, workflow?.id]);

  const inputSchemaErrorMessage = useMemo(() => {
    const workflowForError = detailedWorkflow || workflow;
    return workflowForError && !workflowForError.input_schema && !loadingWorkflowInfo ? "该工作流没有定义输入参数" : undefined;
  }, [detailedWorkflow, workflow?.id, loadingWorkflowInfo]);

  if (!currentWorkflow) return null;

  const canExecute = currentWorkflow.status === 'active' && !streamState.isStreaming;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部信息 */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {currentWorkflow.icon_url ? (
            <Box
              component="img"
              src={currentWorkflow.icon_url}
              alt={currentWorkflow.name}
              sx={{ width: 24, height: 24, borderRadius: 1 }}
            />
          ) : (
            <ExecuteIcon />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="span">
              执行工作流: {currentWorkflow.name}
            </Typography>
            {loadingWorkflowInfo && (
              <CircularProgress size={16} sx={{ ml: 1 }} />
            )}
          </Box>
          <Chip
            label={`版本: v${currentWorkflow.version}`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`创建: ${new Date(currentWorkflow.created_time).toLocaleString()}`}
            size="small"
            sx={{ ml: 1 }}
            variant="outlined"
          />
          {streamState.isStreaming && (
            <CircularProgress size={16} sx={{ ml: 1 }} />
          )}
        </Box>

        {currentWorkflow.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {currentWorkflow.description}
          </Typography>
        )}
      </Box>

      {/* 执行控制按钮 - 在头部区域 */}
      {showActions && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
          <Button
            onClick={handleCancel}
            disabled={!streamState.isStreaming}
            startIcon={<StopIcon />}
            variant="outlined"
            color="error"
            size="large"
            sx={{ minWidth: 140 }}
          >
            {streamState.isStreaming ? '取消执行' : '关闭'}
          </Button>
          <Button
            onClick={handleExecute}
            variant="contained"
            disabled={!canExecute}
            startIcon={streamState.isStreaming ? <CircularProgress size={18} color="inherit" /> : <ExecuteIcon />}
            size="large"
            sx={{ minWidth: 140 }}
          >
            {streamState.isStreaming ? '执行中...' : '执行工作流'}
          </Button>
        </Box>
      )}

      {/* 主内容区 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* 左侧：输入输出参数 */}
          <Grid item xs={12} md={6}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={leftTabValue} onChange={(_, newValue) => setLeftTabValue(newValue)}>
                  <Tab
                    icon={<InputIcon fontSize="small" />}
                    label="输入参数"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<OutputIcon fontSize="small" />}
                    label="输出结果"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<AddTaskIcon fontSize="small" />}
                    label="快速创建任务"
                    iconPosition="start"
                  />
                </Tabs>
              </Box>

              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                {leftTabValue === 0 && (
                  <WorkflowParameterEditor
                    title=""
                    schema={currentWorkflow.input_schema}
                    value={parameters}
                    onChange={handleParametersChange}
                    disabled={streamState.isStreaming}
                    errorMessage={inputSchemaErrorMessage}
                  />
                )}
                {leftTabValue === 1 && (
                  <Box sx={{ height: '100%' }}>
                    {!currentWorkflow.output_schema && !loadingWorkflowInfo ? (
                      <Box sx={{
                        textAlign: 'center',
                        py: 8,
                        color: 'text.secondary',
                        backgroundColor: 'grey.50',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'grey.200',
                        borderStyle: 'dashed',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>该工作流没有定义输出参数</Typography>
                        <Typography variant="caption">执行完成后将显示原始输出数据</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CodeMirror
                          value={JSON.stringify(outputData || {}, null, 2)}
                          height="400px"
                          theme={vscodeDark}
                          extensions={[json()]}
                          editable={false}
                        />
                      </Box>
                    )}
                  </Box>
                )}
                {leftTabValue === 2 && currentWorkflow && (
                  <Box sx={{ height: '100%', overflow: 'auto' }}>
                    <WorkflowQuickCreateTaskPanel
                      workflow={currentWorkflow}
                      parameters={parameters}
                      onSave={(taskData) => {
                        onCreateTask?.(taskData);
                      }}
                      onSaveAndExecute={(taskData) => {
                        onCreateAndExecuteTask?.(taskData);
                      }}
                      loading={streamState.isStreaming}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>

          {/* 右侧：事件日志 */}
          <Grid item xs={12} md={6}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <EventLogsProvider eventLogs={streamState.events}>
                <IsolatedEventLogPanel
                  workflowId={workflow?.id}
                  workflowName={workflow?.name}
                  height="100%"
                />
              </EventLogsProvider>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default React.memo(WorkflowExecutionPanel);
