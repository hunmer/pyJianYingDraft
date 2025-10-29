'use client';

import React, { useState } from 'react';
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
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as ExecuteIcon,
  Code as CodeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { CozeWorkflow } from '@/types/coze';

interface WorkflowExecutionDialogProps {
  open: boolean;
  workflow: CozeWorkflow | null;
  onClose: () => void;
  onConfirm: (parameters?: Record<string, any>) => void;
  executing: boolean;
}

const WorkflowExecutionDialog: React.FC<WorkflowExecutionDialogProps> = ({
  open,
  workflow,
  onClose,
  onConfirm,
  executing,
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [parametersText, setParametersText] = useState('');

  React.useEffect(() => {
    if (open) {
      setParameters({});
      setParametersText('{}');
    }
  }, [open]);

  const handleParametersChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setParametersText(text);

    try {
      const parsed = JSON.parse(text);
      setParameters(parsed);
    } catch (e) {
      // JSON 格式错误，保持当前状态
    }
  };

  const handleExecute = () => {
    try {
      const parsedParams = JSON.parse(parametersText);
      onConfirm(parsedParams);
    } catch (e) {
      onConfirm(parameters);
    }
  };

  const formatJsonSchema = (schema: any) => {
    if (!schema) return null;

    try {
      return JSON.stringify(schema, null, 2);
    } catch (e) {
      return JSON.stringify(schema);
    }
  };

  const isJsonValid = () => {
    try {
      JSON.parse(parametersText);
      return true;
    } catch (e) {
      return false;
    }
  };

  if (!workflow) return null;

  return (
    <Dialog open={open} onClose={executing ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExecuteIcon />
          执行工作流: {workflow.name}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 0 }}>
        {/* 工作流信息 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            工作流信息
          </Typography>

          <Chip
            label={`版本: v${workflow.version}`}
            size="small"
            variant="outlined"
            sx={{ mb: 1 }}
          />

          {workflow.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {workflow.description}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            创建时间: {new Date(workflow.created_time).toLocaleString()}
          </Typography>
          {workflow.updated_time !== workflow.created_time && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              更新时间: {new Date(workflow.updated_time).toLocaleString()}
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 输入参数配置 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            输入参数
          </Typography>

          {/* 输入模式提示 */}
          {workflow.input_schema ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoIcon fontSize="small" />
                <Box>
                  <Typography variant="body2">
                    此工作流支持结构化输入参数。请参考输入模式定义参数格式。
                  </Typography>
                </Box>
              </Box>
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoIcon fontSize="small" />
                <Box>
                  <Typography variant="body2">
                    此工作流没有定义输入模式，将使用默认参数执行。
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}

          {/* 参数输入框 */}
          <TextField
            multiline
            rows={6}
            fullWidth
            label="执行参数 (JSON 格式)"
            placeholder='{\n  "key1": "value1",\n  "key2": "value2"\n}'
            value={parametersText}
            onChange={handleParametersChange}
            error={!isJsonValid() && parametersText.trim() !== ''}
            helperText={
              !isJsonValid() && parametersText.trim() !== ''
                ? 'JSON 格式错误，请检查语法'
                : '输入工作流的执行参数，支持 JSON 格式'
            }
            disabled={executing}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
            }}
          />
        </Box>

        {/* 输入模式详情 */}
        {workflow.input_schema && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon fontSize="small" />
                <Typography variant="subtitle2">输入模式定义</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                sx={{
                  backgroundColor: 'grey.50',
                  p: 2,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {formatJsonSchema(workflow.input_schema)}
                </pre>
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* 输出模式详情 */}
        {workflow.output_schema && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon fontSize="small" />
                <Typography variant="subtitle2">输出模式定义</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                sx={{
                  backgroundColor: 'grey.50',
                  p: 2,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {formatJsonSchema(workflow.output_schema)}
                </pre>
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={executing}>
          取消
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={executing || workflow.status !== 'active' || !isJsonValid()}
          startIcon={executing ? <CircularProgress size={16} /> : <ExecuteIcon />}
        >
          {executing ? '执行中...' : '执行工作流'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowExecutionDialog;