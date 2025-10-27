'use client';

import React from 'react';
import { TextField, Button, Box } from '@mui/material';
import { FolderOpen } from '@mui/icons-material';

interface PathSelectorProps {
  /** 当前路径值 */
  value: string;
  /** 路径变更回调 */
  onChange: (path: string) => void;
  /** 输入框标签 */
  label?: string;
  /** 输入框占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否全宽 */
  fullWidth?: boolean;
  /** 输入框大小 */
  size?: 'small' | 'medium';
  /** 选择目录对话框标题(仅Electron环境) */
  dialogTitle?: string;
  /** 按钮文本(仅Electron环境) */
  buttonText?: string;
  /** 是否为文件选择而非目录选择 */
  selectFile?: boolean;
  /** 文件过滤器(仅在selectFile=true时有效) */
  fileFilters?: { name: string; extensions: string[] }[];
  /** 自定义样式 */
  sx?: any;
}

/**
 * 路径选择组件
 * - Electron环境：显示只读输入框 + 选择按钮(通过IPC调用系统对话框)
 * - 浏览器环境：显示可编辑输入框(手动输入路径)
 */
export default function PathSelector({
  value,
  onChange,
  label = '路径',
  placeholder = '请选择或输入路径',
  disabled = false,
  fullWidth = true,
  size = 'small',
  dialogTitle = '选择路径',
  buttonText = '选择',
  selectFile = false,
  fileFilters,
  sx,
}: PathSelectorProps) {
  // 检查是否在 Electron 环境
  const isElectron = typeof window !== 'undefined' && (window as any).electron;

  /**
   * 处理选择路径(Electron环境)
   */
  const handleSelectPath = async () => {
    if (!isElectron) {
      return;
    }

    try {
      const result = selectFile
        ? await (window as any).electron.fs.selectFile({
            title: dialogTitle,
            filters: fileFilters,
            properties: ['openFile'],
          })
        : await (window as any).electron.fs.selectDirectory({
            title: dialogTitle,
          });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const selectedPath = result.filePaths[0];
      onChange(selectedPath);
    } catch (err) {
      console.error('选择路径失败:', err);
      alert(`选择路径失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  if (isElectron) {
    // Electron 环境: 只读输入框 + 选择按钮
    return (
      <Box sx={sx}>
        <TextField
          fullWidth={fullWidth}
          size={size}
          label={label}
          value={value}
          InputProps={{
            readOnly: true,
          }}
          placeholder={placeholder}
          disabled={disabled}
          sx={{ mb: 1 }}
        />
        <Button
          fullWidth={fullWidth}
          variant="contained"
          size={size}
          onClick={handleSelectPath}
          disabled={disabled}
          startIcon={<FolderOpen />}
        >
          {buttonText}
        </Button>
      </Box>
    );
  }

  // 浏览器环境: 可编辑输入框
  return (
    <TextField
      fullWidth={fullWidth}
      size={size}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      sx={sx}
    />
  );
}
