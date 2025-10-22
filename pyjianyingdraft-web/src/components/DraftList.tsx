'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Folder,
  Refresh,
  Settings,
  FolderOpen,
  ContentCopy,
} from '@mui/icons-material';
import { draftApi, type DraftListItem } from '@/lib/api';

interface DraftListProps {
  onDraftSelect: (draftPath: string, draftName: string) => void;
  selectedDraftPath?: string;
}

/**
 * 草稿列表组件 - 显示剪映草稿目录中的所有草稿
 */
export default function DraftList({ onDraftSelect, selectedDraftPath }: DraftListProps) {
  const [basePath, setBasePath] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    draft: DraftListItem | null;
  } | null>(null);

  // 检查是否在 Electron 环境
  const isElectron = typeof window !== 'undefined' && (window as any).electron;

  // 从后端加载草稿根目录配置
  useEffect(() => {
    const loadDraftRoot = async () => {
      try {
        const response = await draftApi.getDraftRoot();
        const rootPath = response.draft_root;

        if (rootPath) {
          setBasePath(rootPath);
          // 自动加载草稿列表
          loadDrafts(rootPath);
        } else {
          setShowSettings(true);
        }
      } catch (err) {
        console.error('加载草稿根目录配置失败:', err);
        setShowSettings(true);
      }
    };

    loadDraftRoot();
  }, []);

  /**
   * 加载草稿列表
   */
  const loadDrafts = useCallback(async (path?: string) => {
    const pathToUse = path || basePath;
    if (!pathToUse.trim()) {
      setError('请先设置草稿根目录');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await draftApi.list(pathToUse);
      setDrafts(response.drafts);

      // 保存路径到后端配置
      try {
        await draftApi.setDraftRoot(pathToUse);
      } catch (err) {
        console.warn('保存草稿根目录到后端失败:', err);
      }

      setShowSettings(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载草稿列表失败';
      setError(errorMessage);
      console.error('加载草稿列表错误:', err);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  /**
   * 格式化时间戳
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  /**
   * 处理草稿选择
   */
  const handleDraftClick = (draft: DraftListItem) => {
    onDraftSelect(draft.path, draft.name);
  };

  /**
   * 处理右键菜单
   */
  const handleContextMenu = (event: React.MouseEvent, draft: DraftListItem) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      draft,
    });
  };

  /**
   * 关闭右键菜单
   */
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  /**
   * 复制路径到剪贴板
   */
  const handleCopyPath = () => {
    if (!contextMenu?.draft) {
      handleCloseContextMenu();
      return;
    }

    if (isElectron) {
      (window as any).electron.fs.copyToClipboard(contextMenu.draft.path)
        .then(() => {
          console.log('路径已复制:', contextMenu.draft!.path);
        })
        .catch((err: Error) => {
          console.error('复制失败:', err);
          alert(`复制失败: ${err.message}`);
        });
    } else {
      // 浏览器环境回退方案
      navigator.clipboard.writeText(contextMenu.draft.path).catch((err) => {
        console.error('复制失败:', err);
      });
    }
    handleCloseContextMenu();
  };

  /**
   * 在文件管理器中打开
   */
  const handleOpenInFolder = () => {
    if (!contextMenu?.draft) {
      handleCloseContextMenu();
      return;
    }

    if (isElectron) {
      (window as any).electron.fs.showInFolder(contextMenu.draft.path)
        .catch((err: Error) => {
          console.error('打开文件夹失败:', err);
          alert(`打开文件夹失败: ${err.message}`);
        });
    } else {
      alert('此功能仅在 Electron 环境下可用');
    }
    handleCloseContextMenu();
  };

  /**
   * 打开草稿根目录
   */
  const handleOpenDraftRootFolder = () => {
    if (!basePath) {
      alert('未设置草稿根目录');
      return;
    }

    if (isElectron) {
      (window as any).electron.fs.openFolder(basePath)
        .catch((err: Error) => {
          console.error('打开文件夹失败:', err);
          alert(`打开文件夹失败: ${err.message}`);
        });
    } else {
      alert('此功能仅在 Electron 环境下可用');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Folder />
            草稿列表
          </Typography>
          <Box>
            {isElectron && basePath && (
              <Tooltip title="打开草稿文件夹">
                <IconButton size="small" onClick={handleOpenDraftRootFolder}>
                  <FolderOpen />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="刷新">
              <IconButton size="small" onClick={() => loadDrafts()} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="设置目录">
              <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 设置面板 */}
        {showSettings && (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="草稿根目录"
              placeholder="例: D:\JianyingPro Drafts"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={() => loadDrafts()}
              disabled={loading || !basePath.trim()}
            >
              加载草稿
            </Button>
          </Box>
        )}
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* 加载中 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 草稿列表 */}
      {!loading && drafts.length > 0 && (
        <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {drafts.map((draft, index) => (
            <React.Fragment key={draft.path}>
              <ListItem disablePadding>
                <ListItemButton
                  selected={selectedDraftPath === draft.path}
                  onClick={() => handleDraftClick(draft)}
                  onContextMenu={(e) => handleContextMenu(e, draft)}
                  sx={{
                    py: 1.5,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.light',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                      },
                    },
                  }}
                >
                  <ListItemText
                    primary={draft.name}
                    secondary={formatTime(draft.modified_time)}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: selectedDraftPath === draft.path ? 600 : 400,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                    }}
                  />
                </ListItemButton>
              </ListItem>
              {index < drafts.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* 空状态 */}
      {!loading && !error && drafts.length === 0 && basePath && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            未找到草稿文件
          </Typography>
        </Box>
      )}

      {/* 右键菜单 */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCopyPath}>
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          复制完整路径
        </MenuItem>
        <MenuItem onClick={handleOpenInFolder}>
          <FolderOpen sx={{ mr: 1 }} fontSize="small" />
          打开文件夹位置
        </MenuItem>
      </Menu>
    </Box>
  );
}
