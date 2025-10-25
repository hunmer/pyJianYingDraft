'use client';

import React, { useEffect, useState } from 'react';
import Editor, { EditorProps } from '@monaco-editor/react';
import { Box, CircularProgress } from '@mui/material';
import { configureMonaco } from '@/lib/monaco-init.client';

/**
 * Monaco Editor 包装组件
 * 确保在渲染前配置好使用本地包
 */
export default function MonacoEditor(props: EditorProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 在挂载时立即配置 Monaco
    configureMonaco().then(() => {
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return <Editor {...props} />;
}
