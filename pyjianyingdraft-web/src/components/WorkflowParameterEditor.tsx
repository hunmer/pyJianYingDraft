'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
  Paper,
  FormHelperText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip,
  Button,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  properties?: Record<string, ParameterSchema>;
  items?: ParameterSchema;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  format?: string;
}

interface WorkflowParameterEditorProps {
  title: string;
  schema?: ParameterSchema;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  errorMessage?: string;
}

export interface WorkflowParameterEditorRef {
  validate: () => { isValid: boolean; errors: string[] };
}

// 缓存展开状态以避免性能问题
const expandedStateCache = new Map<string, boolean>();

const WorkflowParameterEditor = forwardRef<WorkflowParameterEditorRef, WorkflowParameterEditorProps>(({
  title,
  schema,
  value,
  onChange,
  disabled = false,
  errorMessage,
}, ref) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [tabMode, setTabMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isJsonEditing, setIsJsonEditing] = useState(false);
  const [tempJsonText, setTempJsonText] = useState('');

  // 根据 schema 获取默认值
  const getDefaultValue = useCallback((propSchema: ParameterSchema): any => {
    if (propSchema.default !== undefined) {
      return propSchema.default;
    }

    switch (propSchema.type) {
      case 'boolean':
        return false;
      case 'number':
        return 0;
      case 'array':
        return [];
      case 'object':
        const obj: any = {};
        if (propSchema.properties) {
          Object.entries(propSchema.properties).forEach(([key, subProp]) => {
            obj[key] = getDefaultValue(subProp);
          });
        }
        return obj;
      default:
        return '';
    }
  }, []);

  // 初始化值，确保��� schema 结构匹配
  const initializeValue = useCallback((schema: ParameterSchema, existingValue: any): any => {
    if (!schema || !schema.properties) return existingValue || {};

    const initialized: any = { ...existingValue };

    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      if (!(key in initialized)) {
        initialized[key] = getDefaultValue(propSchema);
      } else if (propSchema.type === 'object' && propSchema.properties) {
        initialized[key] = initializeValue(propSchema, initialized[key]);
      }
    });

    return initialized;
  }, [getDefaultValue]);

  // 当 schema 或 value 变化时，初始化值和更新JSON文本
  useEffect(() => {
    if (schema) {
      const initializedValue = initializeValue(schema, value);
      if (JSON.stringify(initializedValue) !== JSON.stringify(value)) {
        onChange(initializedValue);
      }

      // 同步更新JSON文本（非编辑模式下）
      if (!isJsonEditing) {
        const jsonStr = JSON.stringify(initializedValue, null, 2);
        setJsonText(jsonStr);
        setTempJsonText(jsonStr);
      }
    }
  }, [schema, onChange, initializeValue, isJsonEditing]);

  // 切换展开状态
  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // 开始编辑JSON
  const startJsonEditing = useCallback(() => {
    setTempJsonText(jsonText);
    setIsJsonEditing(true);
    setJsonError(null);
  }, [jsonText]);

  // 取消JSON编辑
  const cancelJsonEditing = useCallback(() => {
    setIsJsonEditing(false);
    setTempJsonText(jsonText);
    setJsonError(null);
  }, [jsonText]);

  // 应用JSON编辑
  const applyJsonEditing = useCallback(() => {
    try {
      const parsed = JSON.parse(tempJsonText);
      setJsonError(null);
      setIsJsonEditing(false);
      setJsonText(tempJsonText);
      onChange(parsed);
    } catch (e) {
      setJsonError('JSON 格式错误');
    }
  }, [tempJsonText, onChange]);

  // JSON文本变更（仅更新临时文本）
  const handleTempJsonChange = useCallback((val: string) => {
    setTempJsonText(val);
    setJsonError(null);
  }, []);

  // 验证函数
  const validateValues = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!schema || !schema.properties) {
      return { isValid: true, errors };
    }

    const validateField = (key: string, propSchema: ParameterSchema, currentValue: any, path: string = ''): string[] => {
      const fieldErrors: string[] = [];
      const fieldPath = path ? `${path}.${key}` : key;

      // 检查必填字段
      if (schema.required?.includes(key) && (currentValue === undefined || currentValue === null || currentValue === '')) {
        fieldErrors.push(`${fieldPath} 是必填字段`);
      }

      // 如果值为空且不是必填，跳过其他验证
      if (currentValue === undefined || currentValue === null || currentValue === '') {
        return fieldErrors;
      }

      // 类型验证
      switch (propSchema.type) {
        case 'number':
          if (isNaN(Number(currentValue))) {
            fieldErrors.push(`${fieldPath} 必须是数字`);
          } else {
            const numValue = Number(currentValue);
            if (propSchema.minimum !== undefined && numValue < propSchema.minimum) {
              fieldErrors.push(`${fieldPath} 不能小于 ${propSchema.minimum}`);
            }
            if (propSchema.maximum !== undefined && numValue > propSchema.maximum) {
              fieldErrors.push(`${fieldPath} 不能大于 ${propSchema.maximum}`);
            }
          }
          break;

        case 'boolean':
          if (typeof currentValue !== 'boolean') {
            fieldErrors.push(`${fieldPath} 必须是布尔值`);
          }
          break;

        case 'array':
          if (!Array.isArray(currentValue)) {
            fieldErrors.push(`${fieldPath} 必须是数组`);
          } else {
            if (propSchema.minItems !== undefined && currentValue.length < propSchema.minItems) {
              fieldErrors.push(`${fieldPath} 至少需要 ${propSchema.minItems} 个元素`);
            }
            if (propSchema.maxItems !== undefined && currentValue.length > propSchema.maxItems) {
              fieldErrors.push(`${fieldPath} 最多允许 ${propSchema.maxItems} 个元素`);
            }
          }
          break;

        case 'object':
          if (typeof currentValue !== 'object' || Array.isArray(currentValue)) {
            fieldErrors.push(`${fieldPath} 必须是对象`);
          } else if (propSchema.properties) {
            // 递归验证嵌套对象
            Object.entries(propSchema.properties).forEach(([subKey, subProp]) => {
              fieldErrors.push(...validateField(subKey, subProp, currentValue[subKey], fieldPath));
            });
          }
          break;

        case 'string':
          if (propSchema.enum && !propSchema.enum.includes(currentValue)) {
            fieldErrors.push(`${fieldPath} 必须是以下值之一: ${propSchema.enum.join(', ')}`);
          }
          break;
      }

      return fieldErrors;
    };

    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      errors.push(...validateField(key, propSchema, value?.[key]));
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [schema, value]);

  // 暴露验证函数给父组件
  useImperativeHandle(ref, () => ({
    validate: validateValues
  }), [validateValues]);

  // 更新字段值的辅助函数
  const updateFieldValue = useCallback((path: string, newValue: any) => {
    const keys = path.split('.');
    const result = { ...value };
    let current = result;
    
    // 遍历路径，构建嵌套对象
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      current[key] = { ...(current[key] || {}) };
      current = current[key];
    }
    
    // 设置最终值
    current[keys[keys.length - 1]] = newValue;
    onChange(result);
  }, [value, onChange]);

  // 渲染字段组件
  const renderField = useCallback((key: string, propSchema: ParameterSchema, currentValue: any, path: string) => {
    const isRequired = schema?.required?.includes(key) || false;
    const hasDescription = propSchema.description;

    const commonFieldProps = {
      fullWidth: true,
      size: 'small' as const,
      disabled,
      required: isRequired,
    };

    switch (propSchema.type) {
      case 'string':
        if (propSchema.enum) {
          return (
            <FormControl {...commonFieldProps}>
              <InputLabel>{propSchema.title || key}</InputLabel>
              <Select
                value={currentValue || ''}
                onChange={(e) => updateFieldValue(path, e.target.value)}
                label={propSchema.title || key}
              >
                {propSchema.enum.map((enumValue) => (
                  <MenuItem key={enumValue} value={enumValue}>
                    {enumValue}
                  </MenuItem>
                ))}
              </Select>
              {hasDescription && (
                <FormHelperText>{propSchema.description}</FormHelperText>
              )}
            </FormControl>
          );
        }

        return (
          <TextField
            {...commonFieldProps}
            label={propSchema.title || key}
            value={currentValue || ''}
            onChange={(e) => updateFieldValue(path, e.target.value)}
            placeholder={propSchema.description}
            helperText={hasDescription ? propSchema.description : undefined}
          />
        );

      case 'number':
        return (
          <TextField
            {...commonFieldProps}
            type="number"
            label={propSchema.title || key}
            value={currentValue ?? ''}
            onChange={(e) => updateFieldValue(path, Number(e.target.value))}
            inputProps={{
              min: propSchema.minimum,
              max: propSchema.maximum,
            }}
            helperText={hasDescription ? propSchema.description : undefined}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(currentValue)}
                onChange={(e) => updateFieldValue(path, e.target.checked)}
                disabled={disabled}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{propSchema.title || key}</Typography>
                {hasDescription && (
                  <Typography variant="caption" color="text.secondary">
                    {propSchema.description}
                  </Typography>
                )}
              </Box>
            }
            sx={{ ml: 0 }}
          />
        );

      case 'array':
        if (propSchema.items?.type === 'string') {
          return (
            <TextField
              {...commonFieldProps}
              label={propSchema.title || key}
              value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
              onChange={(e) => {
                const arrayValue = e.target.value.split(',').map(item => item.trim()).filter(Boolean);
                updateFieldValue(path, arrayValue);
              }}
              placeholder="用逗号分隔多个值"
              helperText={hasDescription ? propSchema.description : '多个值用逗号分隔'}
            />
          );
        }

        return (
          <TextField
            {...commonFieldProps}
            label={propSchema.title || key}
            value={JSON.stringify(currentValue || [], null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateFieldValue(path, parsed);
              } catch {
                // 忽略无效的 JSON
              }
            }}
            multiline
            rows={3}
            helperText={hasDescription ? propSchema.description : '输入有效的 JSON 数组'}
          />
        );

      case 'object':
        if (!propSchema.properties || Object.keys(propSchema.properties).length === 0) {
          return (
            <TextField
              {...commonFieldProps}
              label={propSchema.title || key}
              value={JSON.stringify(currentValue || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateFieldValue(path, parsed);
                } catch {
                  // 忽略无效的 JSON
                }
              }}
              multiline
              rows={4}
              helperText={hasDescription ? propSchema.description : '输入有效的 JSON 对象'}
            />
          );
        }

        const isExpanded = expandedPaths.has(path);
        const hasChildren = true;

        return (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                p: 1,
                borderRadius: 1,
                border: 1,
                borderColor: 'grey.200',
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'grey.50',
                },
              }}
            >
              {hasChildren && (
                <Box
                  onClick={() => toggleExpanded(path)}
                  sx={{
                    cursor: 'pointer',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      color: 'primary.contrastText'
                    },
                  }}
                >
                  {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {propSchema.title || key}
              </Typography>

              {isRequired && (
                <Typography variant="caption" color="error.main">
                  *
                </Typography>
              )}

              {hasDescription && (
                <Tooltip title={propSchema.description} placement="top">
                  <InfoIcon fontSize="small" color="action" />
                </Tooltip>
              )}
            </Box>

            {isExpanded && (
              <Box sx={{
                ml: 3,
                p: 2,
                border: 1,
                borderColor: 'grey.100',
                borderRadius: 1,
                backgroundColor: 'grey.50'
              }}>
                {Object.entries(propSchema.properties).map(([subKey, subProp]) => (
                  <Box key={subKey} sx={{ mb: 2 }}>
                    {renderField(subKey, subProp, currentValue?.[subKey], `${path}.${subKey}`)}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  }, [schema, updateFieldValue, disabled, expandedPaths, toggleExpanded]);

  // 渲染表单模式
  const renderFormMode = useCallback(() => {
    return (
      <Box>
        {schema?.properties && Object.entries(schema.properties).map(([key, propSchema]) => (
          <Box key={key} sx={{ mb: 2 }}>
            {renderField(key, propSchema, value?.[key], key)}
          </Box>
        ))}
      </Box>
    );
  }, [schema?.properties, value, renderField]);

  // 渲染JSON模式
  const renderJsonMode = useCallback(() => (
    <Box>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1,
        p: 1,
        backgroundColor: 'grey.100',
        borderRadius: 1
      }}>
        <Typography variant="body2" color="text.secondary">
          {isJsonEditing ? '编辑模式' : '只读模式'}
        </Typography>
        {!isJsonEditing ? (
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={startJsonEditing}
            variant="outlined"
          >
            编辑
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<CloseIcon />}
              onClick={cancelJsonEditing}
              variant="outlined"
              color="secondary"
            >
              取消
            </Button>
            <Button
              size="small"
              startIcon={<CheckIcon />}
              onClick={applyJsonEditing}
              variant="contained"
              color="primary"
            >
              应用
            </Button>
          </Box>
        )}
      </Box>

      <CodeMirror
        value={isJsonEditing ? tempJsonText : jsonText}
        height="400px"
        theme={vscodeDark}
        extensions={[json()]}
        onChange={isJsonEditing ? handleTempJsonChange : undefined}
        editable={isJsonEditing}
      />

      {jsonError && (
        <FormHelperText error sx={{ mt: 1 }}>
          {jsonError}
        </FormHelperText>
      )}
    </Box>
  ), [isJsonEditing, tempJsonText, jsonText, startJsonEditing, cancelJsonEditing, applyJsonEditing, handleTempJsonChange, jsonError]);

  // 渲染内容
  const renderContent = useCallback(() => {
    switch (tabMode) {
      case 'form':
        return renderFormMode();
      case 'json':
        return renderJsonMode();
      default:
        return renderFormMode();
    }
  }, [tabMode, renderFormMode, renderJsonMode]);

  // 如果没有 schema，显示提示
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          暂无参数配置
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>

        <Tabs
          value={tabMode}
          onChange={(_, newValue) => {
            if (newValue === 'form' || newValue === 'json') {
              setTabMode(newValue);
            }
          }}
          size="small"
          sx={{ minHeight: 'auto' }}
        >
          <Tab
            value="form"
            icon={<InfoIcon fontSize="small" />}
            label="表单"
            iconPosition="start"
            sx={{ minHeight: 'auto', py: 0.5 }}
          />
          <Tab
            value="json"
            icon={<CodeIcon fontSize="small" />}
            label="JSON"
            iconPosition="start"
            sx={{ minHeight: 'auto', py: 0.5 }}
          />
        </Tabs>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {renderContent()}
    </Paper>
  );
});

WorkflowParameterEditor.displayName = 'WorkflowParameterEditor';

// 使用 React.memo 优化组件，避免不必要的重新渲染
const OptimizedWorkflowParameterEditor = memo(WorkflowParameterEditor, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.errorMessage === nextProps.errorMessage &&
    JSON.stringify(prevProps.schema) === JSON.stringify(nextProps.schema) &&
    JSON.stringify(prevProps.value) === JSON.stringify(nextProps.value) &&
    prevProps.onChange === nextProps.onChange
  );
});

OptimizedWorkflowParameterEditor.displayName = 'WorkflowParameterEditor';

export default OptimizedWorkflowParameterEditor;