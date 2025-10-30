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
} from '@mui/icons-material';
import { CozeWorkflow, WorkflowStreamEvent, WorkflowStreamState, WorkflowEventLog } from '@/types/coze';
import WorkflowParameterEditor from './WorkflowParameterEditor';
import WorkflowEventLogPanel from './WorkflowEventLogPanel';
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

interface WorkflowExecutionDialogProps {
  open: boolean;
  workflow: CozeWorkflow | null;
  onClose: () => void;
  onExecute: (workflowId: string, parameters: Record<string, any>) => Promise<any>;
  onCancel: () => void;
  workspaceId?: string;
  apiConfig?: {
    apiBase: string;
    apiKey: string;
  };
  eventLogs: WorkflowEventLog[];
}

const WorkflowExecutionDialog: React.FC<WorkflowExecutionDialogProps> = ({
  open,
  workflow,
  onClose,
  onExecute,
  onCancel,
  workspaceId,
  apiConfig,
  eventLogs,
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

  
  // 获取工作流详细信息
  const fetchWorkflowDetails = useCallback(async (workflowId: string, fallbackWorkflow?: CozeWorkflow) => {
    setLoadingWorkflowInfo(true);
    setWorkflowInfoError(null);

    try {
      if (!apiConfig) {
        throw new Error('缺少 API 配置信息，请确保已正确配置 Coze 账号');
      }

      // 参考 coze-js-client.ts:66~98 的实现方式，使用 REST API 获取工作流详细信息
      // 接口：GET /v1/workflows/:workflow_id
      const { COZE_CN_BASE_URL } = await import('@coze/api');
      const baseUrl = apiConfig.apiBase || COZE_CN_BASE_URL;
      const token = apiConfig.apiKey;

      const url = new URL(`${baseUrl}/v1/workflows/${workflowId}`);
      url.searchParams.append('include_input_output', 'true');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // 根据文档，成功时 code 为 0
      if (result.code !== 0) {
        throw new Error(result.msg || '获取工作流详细信息失败');
      }

      // 解析返回的详细信息
      const { workflow_detail, input, output } = result.data;

      // 将Coze API的参数格式转换为JSON Schema格式
      const convertToSchema = (cozeInput?: any) => {
        if (!cozeInput?.parameters) return undefined;

        const schema: any = {
          type: 'object',
          properties: {},
          required: [],
        };

        for (const [key, param] of Object.entries(cozeInput.parameters)) {
          const paramInfo = param as any;

          // 转换 Coze API 的类型到标准 JSON Schema 类型
          let type = paramInfo.type;
          if (type === 'txt') {
            type = 'string'; // 将 txt 转换为 string
          }

          const prop: any = {
            type: type,
            title: key,
            description: paramInfo.description,
          };

          if (paramInfo.default_value !== undefined) {
            prop.default = paramInfo.default_value;
          }

          if (type === 'array' && paramInfo.items) {
            prop.items = paramInfo.items;
          }

          if (type === 'object' && paramInfo.properties) {
            prop.properties = paramInfo.properties;
          }

          schema.properties[key] = prop;

          if (paramInfo.required) {
            schema.required.push(key);
          }
        }

        return schema;
      };

      const convertOutputToSchema = (cozeOutput?: any) => {
        if (!cozeOutput?.parameters) return undefined;

        const schema: any = {
          type: 'object',
          properties: {},
        };

        for (const [key, param] of Object.entries(cozeOutput.parameters)) {
          const paramInfo = param as any;
          schema.properties[key] = {
            type: paramInfo.type,
            title: key,
          };
        }

        return schema;
      };

      // 构建详细的工作流对象
      const detailedWorkflow: CozeWorkflow = {
        id: workflow_detail.workflow_id,
        name: workflow_detail.workflow_name,
        description: workflow_detail.description,
        created_time: new Date(workflow_detail.created_at * 1000).toISOString(),
        updated_time: new Date(workflow_detail.updated_at * 1000).toISOString(),
        version: workflow.version || 1,
        input_schema: convertToSchema(input),
        output_schema: convertOutputToSchema(output),
        status: 'active', // API不返回状态信息，使用默认值
        icon_url: workflow_detail.icon_url,
        app_id: workflow_detail.app_id,
        creator_id: workflow_detail.creator.id,
        creator_name: workflow_detail.creator.name,
      };

      setDetailedWorkflow(detailedWorkflow);
    } catch (error) {
      console.error('获取工作流详细信息失败:', error);
      setWorkflowInfoError(
        error instanceof Error ? error.message : '获取工作流详细信息失败'
      );
      // 即使获取失败，也使用基本信息
      setDetailedWorkflow(fallbackWorkflow);
    } finally {
      setLoadingWorkflowInfo(false);
    }
  }, [apiConfig]);
  
  useEffect(() => {
    if (open) {
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
      fetchedWorkflowIdRef.current = null;

      // 当对话框打开且有工作流ID和API配置时，获取详细信息
      if (workflow?.id && apiConfig && workflow.id !== fetchedWorkflowIdRef.current) {
        fetchWorkflowDetails(workflow.id, workflow);
        fetchedWorkflowIdRef.current = workflow.id;
      }
    }
  }, [open, workflow?.id, apiConfig?.apiKey, apiConfig?.apiBase, fetchWorkflowDetails]);

  const addStreamEvent = (event: WorkflowStreamEvent) => {
    setStreamState(prev => ({
      ...prev,
      events: [...prev.events, event],
      currentStep: event.node_id || prev.currentStep,
    }));

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

      const result = await onExecute(workflowToExecute.id, parameters);

      // 执行成功，更新状态为完成并设置输出数据
      setStreamState(prev => ({
        ...prev,
        status: 'completed',
        isStreaming: false,
        endTime: new Date().toISOString(),
        output: result?.data?.output_data || {},
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
                label={`状态: ${currentWorkflow.status}`}
                size="small"
                color={currentWorkflow.status === 'active' ? 'success' : 'warning'}
                sx={{ ml: 1 }}
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

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                创建时间: {new Date(currentWorkflow.created_time).toLocaleString()}
              </Typography>
            </Grid>
          </Grid>

          {loadingWorkflowInfo && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                正在获取工作流详细信息...
              </Typography>
            </Box>
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
                        <Typography variant="h6" gutterBottom>
                          输出结果
                        </Typography>
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
              </Box>
            </Box>
          </Grid>

          {/* 右侧：事件日志 */}
          <Grid item xs={12} md={6}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <WorkflowEventLogPanel
                eventLogs={eventLogs}
                workflowId={workflow?.id}
                workflowName={workflow?.name}
                height="100%"
              />
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

export default WorkflowExecutionDialog;