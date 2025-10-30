'use client';

import React, { useRef, useState } from 'react';
import { Box, Button, Alert, Typography, Paper } from '@mui/material';
import WorkflowParameterEditor, { WorkflowParameterEditorRef } from '../components/WorkflowParameterEditor';

// 示例 JSON Schema
const exampleSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: '姓名',
      description: '请输入您的姓名',
    },
    age: {
      type: 'number',
      title: '年龄',
      description: '请输入您的年龄',
      minimum: 0,
      maximum: 120,
    },
    isActive: {
      type: 'boolean',
      title: '是否激活',
      description: '账户是否处于激活状态',
    },
    role: {
      type: 'string',
      title: '角色',
      enum: ['admin', 'user', 'guest'],
      description: '选择用户角色',
    },
    tags: {
      type: 'array',
      title: '标签',
      items: { type: 'string' },
      description: '用逗号分隔多个标签',
    },
    settings: {
      type: 'object',
      title: '设置',
      properties: {
        theme: {
          type: 'string',
          title: '主题',
          enum: ['light', 'dark'],
          default: 'light',
        },
        notifications: {
          type: 'boolean',
          title: '通知',
          default: true,
        },
        maxItems: {
          type: 'number',
          title: '最大项目数',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
      },
      required: ['theme'],
    },
  },
  required: ['name', 'age'],
};

export default function WorkflowParameterEditorExample() {
  const [values, setValues] = useState<any>({});
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[] } | null>(null);
  const editorRef = useRef<WorkflowParameterEditorRef>(null);

  const handleExecute = () => {
    // 执行验证
    const result = editorRef.current?.validate();
    if (result) {
      setValidationResult(result);

      if (result.isValid) {
        alert('验证通过！准备执行工作流...\n\n参数值：\n' + JSON.stringify(values, null, 2));
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        WorkflowParameterEditor 使用示例
      </Typography>

      <Typography variant="body1" paragraph>
        这个示例展示了如何使用重写后的 WorkflowParameterEditor 组件。组件支持表单和 JSON 两种编辑模式，并提供了验证功能。
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          功能特性：
        </Typography>
        <ul>
          <li>表单模式：根据 JSON Schema 自动生成表单字段</li>
          <li>JSON 模式：支持只读和编辑两种状态，避免双向绑定冲突</li>
          <li>对象折叠：支持嵌套对象的展开/折叠</li>
          <li>字段验证：点击执行按钮时进行验证</li>
          <li>单向数据流：JSON 编辑器更新表单，表单更新不会自动同步到 JSON</li>
        </ul>
      </Paper>

      <WorkflowParameterEditor
        ref={editorRef}
        title="工作流参数配置"
        schema={exampleSchema}
        value={values}
        onChange={setValues}
      />

      {validationResult && !validationResult.isValid && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            验证失败：
          </Typography>
          <ul>
            {validationResult.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {validationResult && validationResult.isValid && (
        <Alert severity="success" sx={{ mt: 2 }}>
          验证通过！所有字段都符合要求。
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleExecute}
        >
          执行工作流
        </Button>

        <Button
          variant="outlined"
          onClick={() => {
            setValidationResult(null);
          }}
        >
          清除验证结果
        </Button>
      </Box>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          当前参数值：
        </Typography>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.875rem'
        }}>
          {JSON.stringify(values, null, 2)}
        </pre>
      </Paper>
    </Box>
  );
}