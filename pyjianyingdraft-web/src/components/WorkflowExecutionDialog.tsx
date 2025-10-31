'use client';

import React, { useState, useRef, useEffect, useCallback,useMemo  } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  Tab,
  Tabs,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as ExecuteIcon,
  Code as CodeIcon,
  Info as InfoIcon,
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

interface WorkflowExecutionDialogProps {
  open: boolean;
  workflow: CozeWorkflow | null;
  onClose: () => void;
  onExecute: (workflowId: string, parameters: Record<string, any>, onStreamEvent?: (event: WorkflowStreamEvent) => void) => Promise<any>;
  onCancel: () => void;
  workspaceId?: string;
  accountId?: string; // 账号ID，用于后端API调用
  eventLogs: WorkflowEventLog[];
  onCreateTask?: (taskData: CreateTaskRequest) => Promise<any>;
  onCreateAndExecuteTask?: (taskData: CreateTaskRequest) => Promise<any>;
}

// 创建一个独立的事件日志上下文，避免通过 props 传递
const EventLogsContext = React.createContext<WorkflowEventLog[]>([]);

// 独立的事件日志组件，使用 context 获取数据
const IsolatedEventLogPanel: React.FC<{ workflowId?: string; workflowName?: string; height?: string | number }> = React.memo(({
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
});

const EventLogsProvider: React.FC<{ children: React.ReactNode; eventLogs: WorkflowEventLog[] }> = React.memo(({ children, eventLogs }) => {
  return (
    <EventLogsContext.Provider value={eventLogs}>
      {children}
    </EventLogsContext.Provider>
  );
});

const WorkflowExecutionDialog: React.FC<WorkflowExecutionDialogProps> = ({
  open,
  workflow,
  onClose,
  onExecute,
  onCancel,
  workspaceId,
  accountId = 'default',
  eventLogs,
  onCreateTask,
  onCreateAndExecuteTask,
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});

  
  // 使用 useRef 存储上一次的参数，避免不必要的更新
  const lastParametersRef = useRef<Record<string, any>>({});

  // 使用 useCallback 稳定 setParameters 的引用，并添加深度比较
  const handleParametersChange = useCallback((newParameters: Record<string, any>) => {
    // 深度比较，避免没有实际变化的更新
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

  // Tab状态管理
  const [leftTabValue, setLeftTabValue] = useState(0);

  // 工作流详细信息状态
  const [detailedWorkflow, setDetailedWorkflow] = useState<CozeWorkflow | null>(null);
  const [loadingWorkflowInfo, setLoadingWorkflowInfo] = useState(false);
  const [workflowInfoError, setWorkflowInfoError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchedWorkflowIdRef = useRef<string | null>(null);

  // 使用 ref 来跟踪是否已经初始化过，避免重复初始化
  const initializedRef = useRef<boolean>(false);


  // 获取工作流详细信息 - 使用后端 API
  const fetchWorkflowDetails = useCallback(async (workflowId: string, fallbackWorkflow?: CozeWorkflow) => {
    setLoadingWorkflowInfo(true);
    setWorkflowInfoError(null);

    try {
      // 调用后端 API 获取工作流详情（包含 input_schema 和 output_schema）
      const response = await api.coze.getWorkflow(workflowId, accountId);

      if (!response.success) {
        throw new Error('获取工作流详细信息失败');
      }

      const workflowData = response.workflow;

      // 构建详细的工作流对象
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
        status: 'active', // API不返回状态信息，使用默认值
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
      // 即使获取失败，也使用基本信息
      setDetailedWorkflow(fallbackWorkflow || null);
    } finally {
      setLoadingWorkflowInfo(false);
    }
  }, [accountId]); // 依赖 accountId
  
  useEffect(() => {
    if (open) {
      // 只有当对话框第一次打开或者工作流发生变化时才重置状态
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

      // 当对话框打开且有工作流ID时，获取详细信息
      if (workflow?.id && workflow.id !== fetchedWorkflowIdRef.current) {
        fetchWorkflowDetails(workflow.id, workflow);
        fetchedWorkflowIdRef.current = workflow.id;
      }
    } else {
      // 对话框关闭时重置初始化状态
      initializedRef.current = false;
      fetchedWorkflowIdRef.current = null;
    }
  }, [open, workflow?.id, fetchWorkflowDetails]); // 添加 fetchWorkflowDetails 依赖

  const addStreamEvent = (event: WorkflowEventLog) => {
    // addStreamEvent 现在只用于特殊事件的状态更新
    // 事件添加已经在上层的 onStreamEvent 中处理

    // 处理特殊事件
    if (event.event === 'workflow_finished') {
      setStreamState(prev => ({
        ...prev,
        status: 'completed',
        endTime: event.timestamp,
        output: event.data,
      }));
      setOutputData(event.data);
    } else if (event.event === 'error') {
      setStreamState(prev => ({
        ...prev,
        status: 'failed',
        endTime: event.timestamp,
        error: event.data?.message || '执行出错',
      }));
    }
  };

  const handleExecute = async () => {
    const workflowToExecute = detailedWorkflow || workflow;
    if (!workflowToExecute) return;

    try {
      setStreamState({
        isStreaming: true,
        events: [],
        status: 'running',
        startTime: new Date().toISOString(),
      });

      abortControllerRef.current = new AbortController();

      // 使用流式执行
      const onStreamEvent = (event: WorkflowStreamEvent) => {
        // 创建 WorkflowEventLog 格式的事件
        const eventLog: WorkflowEventLog = {
          id: `event_${Date.now()}_${Math.random()}`,
          executeId: event.workflow_id,
          workflowId: event.workflow_id || workflowToExecute.id,
          workflowName: workflowToExecute.name,
          event: event.event,
          data: event.data,
          timestamp: event.timestamp,
          level: event.event === 'error' ? 'error' :
                 event.event === 'workflow_finished' ? 'success' : 'info',
          message: event.event === 'error' ?
                   (event.data?.message || '执行出错') :
                   event.event === 'workflow_finished' ?
                   '工作流执行完成' :
                   `工作流事件: ${event.event}`,
          details: event.data
        };

        // 添加事件到流状态
        setStreamState(prev => ({
          ...prev,
          events: [...prev.events, eventLog],
          currentStep: event.node_id || undefined,
          status: event.event === 'workflow_finished' ? 'completed' :
                  event.event === 'error' ? 'failed' : 'running',
          output: event.event === 'workflow_finished' ? event.data : prev.output,
          error: event.event === 'error' ? event.data?.message : prev.error
        }));

        // 对于特殊事件，调用 addStreamEvent 处理状态更新
        if (event.event === 'workflow_finished' || event.event === 'error') {
          addStreamEvent(eventLog);
        }

        // 如果是完成事件，更新输出数据
        if (event.event === 'workflow_finished' && event.data) {
          setOutputData(event.data);
        }
      };

      const result = await onExecute(workflowToExecute.id, parameters, onStreamEvent);

      // 执行完成，更新最终状态
      setStreamState(prev => ({
        ...prev,
        status: 'completed',
        isStreaming: false,
        endTime: new Date().toISOString(),
        output: result?.data?.output_data || prev.output || {},
      }));

      // 设置输出数据到状态中
      if (result?.data?.output_data) {
        setOutputData(result.data.output_data);
      }

      addStreamEvent({
        event: 'workflow_finished',
        data: {
          message: '工作流执行完成',
          output: result?.data?.output_data || {}
        },
        timestamp: new Date().toISOString(),
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

  // 暴露方法供外部调用以接收流式事件
  React.useImperativeHandle(React.createRef(), () => ({
    addStreamEvent,
    getStreamState: () => streamState,
  }));

  // 使用 useMemo 缓存 currentWorkflow，避免每次渲染都创建新引用
  const currentWorkflow = useMemo(() => detailedWorkflow || workflow, [detailedWorkflow, workflow?.id]);

  // 缓存错误消息，必须放在条件返回之前
  const inputSchemaErrorMessage = useMemo(() => {
    const workflowForError = detailedWorkflow || workflow;
    return workflowForError && !workflowForError.input_schema && !loadingWorkflowInfo ? "该工作流没有定义输入参数" : undefined;
  }, [detailedWorkflow, workflow?.id, loadingWorkflowInfo]);

  if (!currentWorkflow) return null;

  const canExecute = currentWorkflow.status === 'active' && !streamState.isStreaming;

  return (
    <Dialog
      open={open}
      onClose={streamState.isStreaming ? undefined : onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          width: '90vw',
          maxWidth: '1400px',
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            <Chip
                label={`版本: v${currentWorkflow.version}`}
                size="small"
                sx={{ ml: 2 }}
                variant="outlined"
              />
              <Chip
                label={`创建: ${new Date(currentWorkflow.created_time).toLocaleString()}`}
                size="small"
                sx={{ ml: 2 }}
                variant="outlined"
              />
          </Box>
          {streamState.isStreaming && (
            <CircularProgress size={16} />
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 0, minHeight: '600px' }}>
        {/* 工作流信息 */}
        <Box sx={{ mb: 2 }}>
          {currentWorkflow.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {currentWorkflow.description}
            </Typography>
          )}
        </Box>

        {/* 左右两栏布局 */}
        <Grid container spacing={2} sx={{ height: '500px' }}>
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
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 3, borderTop: 1, borderColor: 'divider', gap: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={!streamState.isStreaming}
          startIcon={<StopIcon />}
          sx={{ minWidth: 120 }}
        >
          {streamState.isStreaming ? '取消执行' : '关闭'}
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={!canExecute}
          startIcon={streamState.isStreaming ? <CircularProgress size={16} /> : <ExecuteIcon />}
          sx={{ minWidth: 120 }}
        >
          {streamState.isStreaming ? '执行中...' : '执行工作流'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const MemoizedWorkflowEventLogPanel = React.memo(WorkflowEventLogPanel);

export default React.memo(WorkflowExecutionDialog);