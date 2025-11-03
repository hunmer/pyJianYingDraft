'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Paper,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import WarningIcon from '@mui/icons-material/Warning';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface MaterialPathInfo {
  materialId: string;
  originalPath: string;
  materialName?: string;
}

interface PathReplacementDialogProps {
  open: boolean;
  onClose: () => void;
  materials: any[]; // materials 数组
  onConfirm: (replacements: Record<string, string>) => void;
}

/**
 * 检测是否是本地文件路径
 */
const isLocalPath = (path: string): boolean => {
  if (!path || typeof path !== 'string') return false;

  // Windows 路径: C:\, D:\, \\network
  if (/^[A-Za-z]:\\/.test(path) || /^\\\\/.test(path)) return true;

  // Unix/Linux 绝对路径: /home, /usr
  if (/^\/[^/]/.test(path)) return true;

  // 相对路径 (./xxx, ../xxx)
  if (/^\.\.?\//.test(path)) return true;

  return false;
};

/**
 * 检测是否在 Electron 环境中
 */
const isElectron = () => {
  return typeof window !== 'undefined' && window.electron !== undefined;
};

/**
 * 路径替换对话框
 * 检测 materials 中的本地文件路径，提供 URL 替换界面
 */
export default function PathReplacementDialog({
  open,
  onClose,
  materials,
  onConfirm,
}: PathReplacementDialogProps) {
  // 提取所有本地路径
  const localPaths = useMemo(() => {
    const paths: MaterialPathInfo[] = [];

    if (!materials || !Array.isArray(materials)) return paths;

    materials.forEach((material) => {
      // 检查 material.path
      if (material.path && isLocalPath(material.path)) {
        paths.push({
          materialId: material.id || material.material_id || 'unknown',
          originalPath: material.path,
          materialName: material.name || material.material_name,
        });
      }

      // 检查 material.content?.path（用于某些素材类型）
      if (material.content?.path && isLocalPath(material.content.path)) {
        paths.push({
          materialId: material.id || material.material_id || 'unknown',
          originalPath: material.content.path,
          materialName: material.name || material.material_name,
        });
      }
    });

    return paths;
  }, [materials]);

  // 路径替换映射 (originalPath -> newUrl)
  const [replacements, setReplacements] = useState<Record<string, string>>({});

  // 文件是否存在映射 (originalPath -> exists)
  const [fileExists, setFileExists] = useState<Record<string, boolean>>({});

  // 拖拽中状态映射 (originalPath -> isDragging)
  const [draggingStates, setDraggingStates] = useState<Record<string, boolean>>({});

  // 检查所有路径是否存在（仅在 Electron 环境）
  useEffect(() => {
    if (!isElectron() || !open) return;

    const checkFiles = async () => {
      const existsMap: Record<string, boolean> = {};

      for (const pathInfo of localPaths) {
        try {
          const exists = await window.electron.fs.checkFileExists(pathInfo.originalPath);
          existsMap[pathInfo.originalPath] = exists;
        } catch (error) {
          console.error('检查文件存在失败:', error);
          existsMap[pathInfo.originalPath] = false;
        }
      }

      setFileExists(existsMap);
    };

    checkFiles();
  }, [localPaths, open]);

  // 更新某个路径的替换
  const handlePathChange = (originalPath: string, newUrl: string) => {
    setReplacements((prev) => ({
      ...prev,
      [originalPath]: newUrl,
    }));
  };

  // 处理文件拖拽开始（拖出）
  const handleDragStart = (e: React.DragEvent, originalPath: string) => {
    if (!isElectron() || !fileExists[originalPath]) {
      e.preventDefault();
      return;
    }

    // 阻止浏览器默认拖拽行为，使用 Electron 的原生文件拖拽
    e.preventDefault();
    setDraggingStates((prev) => ({ ...prev, [originalPath]: true }));

    try {
      console.log('[拖拽] 开始拖拽文件:', originalPath);

      // 调用 Electron IPC 启动原生文件拖拽
      // 注意：不使用 await，让拖拽操作异步执行
      // Electron 的 startDrag 会接管整个拖拽流程，无需使用 dataTransfer API
      window.electron.fs.startDrag(originalPath).then(() => {
        console.log('[拖拽] 文件拖拽已完成');
        setDraggingStates((prev) => ({ ...prev, [originalPath]: false }));
      }).catch((error) => {
        console.error('[拖拽] 启动文件拖拽失败:', error);
        setDraggingStates((prev) => ({ ...prev, [originalPath]: false }));
      });
    } catch (error) {
      console.error('[拖拽] 启动文件拖拽时出错:', error);
      setDraggingStates((prev) => ({ ...prev, [originalPath]: false }));
    }
  };

  // 处理拖拽结束
  const handleDragEnd = (e: React.DragEvent, originalPath: string) => {
    setDraggingStates((prev) => ({ ...prev, [originalPath]: false }));
    console.log('[拖拽] 拖拽结束:', originalPath);
  };

  // 确认导出
  const handleConfirm = () => {
    onConfirm(replacements);
  };

  // 统计替换情况
  const replacedCount = Object.keys(replacements).filter(
    (key) => replacements[key].trim() !== ''
  ).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon />
        路径替换 - 本地路径转 HTTP 路径
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 提示信息 */}
          <Alert severity="info" icon={<WarningIcon />}>
            <Typography variant="body2" gutterBottom>
              检测到 <strong>{localPaths.length}</strong> 个本地文件路径
            </Typography>
            <Typography variant="body2">
              您可以为这些文件提供 HTTP URL 进行替换。未填写的路径将保留原值。
            </Typography>
          </Alert>

          {/* 路径列表 */}
          {localPaths.length === 0 ? (
            <Alert severity="success">
              未检测到本地文件路径，可以直接导出！
            </Alert>
          ) : (
            <List sx={{ width: '100%' }}>
              {localPaths.map((pathInfo, index) => (
                <React.Fragment key={`${pathInfo.materialId}-${index}`}>
                  <ListItem
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 1,
                      py: 2,
                    }}
                  >
                    {/* 素材信息 */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={`素材 ${index + 1}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {pathInfo.materialName && (
                        <Typography variant="body2" color="text.secondary">
                          {pathInfo.materialName}
                        </Typography>
                      )}
                    </Box>

                    {/* 原始路径 */}
                    <ListItemText
                      primary="原始路径"
                      secondary={
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: 'error.main',
                            wordBreak: 'break-all',
                          }}
                        >
                          {pathInfo.originalPath}
                        </Typography>
                      }
                    />

                    {/* URL 输入框 */}
                    <TextField
                      fullWidth
                      size="small"
                      label="替换为 HTTP URL (可选)"
                      placeholder="https://example.com/path/to/file.mp4"
                      value={replacements[pathInfo.originalPath] || ''}
                      onChange={(e) =>
                        handlePathChange(pathInfo.originalPath, e.target.value)
                      }
                      helperText="留空则保留原路径"
                      InputProps={{
                        startAdornment: <LinkIcon sx={{ mr: 1, color: 'action.active' }} />,
                      }}
                    />

                    {/* 文件拖出区域（仅在 Electron 环境且文件存在时显示） */}
                    {isElectron() && fileExists[pathInfo.originalPath] && (
                      <Paper
                        variant="outlined"
                        draggable
                        onDragStart={(e) => handleDragStart(e, pathInfo.originalPath)}
                        // onDragEnd={(e) => handleDragEnd(e, pathInfo.originalPath)}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          borderStyle: 'dashed',
                          borderWidth: 2,
                          borderColor: draggingStates[pathInfo.originalPath]
                            ? 'success.main'
                            : 'divider',
                          backgroundColor: draggingStates[pathInfo.originalPath]
                            ? 'success.lighter'
                            : 'background.default',
                          cursor: 'grab',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: 'primary.light',
                            backgroundColor: 'action.hover',
                          },
                          '&:active': {
                            cursor: 'grabbing',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <DragIndicatorIcon color="action" />
                          <CloudUploadIcon color="primary" sx={{ fontSize: '1.2rem' }} />
                          <Typography variant="body2" color="text.secondary">
                            拖拽此处将文件上传到其他应用
                          </Typography>
                          <CheckCircleIcon
                            sx={{ color: 'success.main', fontSize: '1rem' }}
                            titleAccess="文件存在于本地"
                          />
                        </Box>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                          支持拖拽到浏览器上传框、云存储等
                        </Typography>
                      </Paper>
                    )}
                  </ListItem>
                  {index < localPaths.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}

          {/* 替换统计 */}
          {localPaths.length > 0 && (
            <Alert severity={replacedCount === localPaths.length ? 'success' : 'warning'}>
              已替换: <strong>{replacedCount}</strong> / {localPaths.length} 个路径
              {replacedCount < localPaths.length && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  未替换的路径将保留原值
                </Typography>
              )}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          startIcon={<LinkIcon />}
        >
          确定导出
          {replacedCount > 0 && ` (${replacedCount} 个已替换)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
