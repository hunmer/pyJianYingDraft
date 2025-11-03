'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Chip,
  ListItemIcon,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Folder,
  Refresh,
  Settings,
  FolderOpen,
  ContentCopy,
  MoreVert,
  Upload,
  History,
} from '@mui/icons-material';
import { draftApi, type DraftListItem } from '@/lib/api';
import PathSelector from '@/components/PathSelector';

interface DraftListProps {
  onDraftSelect: (draftPath: string, draftName: string) => void;
  onRulesUpdated?: () => void;
  onDraftRootChanged?: () => void;
  selectedDraftPath?: string;
}

/**
 * 草稿列表组件 - 显示剪映草稿目录中的所有草稿
 */
export default function DraftList({ onDraftSelect, onRulesUpdated, onDraftRootChanged, selectedDraftPath }: DraftListProps) {
  const [basePath, setBasePath] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showOnlyWithRules, setShowOnlyWithRules] = useState<boolean>(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    draft: DraftListItem | null;
  } | null>(null);

  // 下拉菜单状态
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const dropdownOpen = Boolean(anchorEl);

  // 检查是否在 Electron 环境
  const isElectron = typeof window !== 'undefined' && (window as any).electron;

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
        // 通知父组件草稿根目录已变更，触发规则组刷新
        if (typeof onDraftRootChanged === 'function') {
          onDraftRootChanged();
        }
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


  // 从后端加载草稿根目录配置(只在组件挂载时运行一次)
  useEffect(() => {
    const loadDraftRoot = async () => {
      try {
        const response = await draftApi.getDraftRoot();
        const rootPath = response.draft_root;

        if (rootPath) {
          setBasePath(rootPath);
          // 自动加载草稿列表
          try {
            const draftsResponse = await draftApi.list(rootPath);
            setDrafts(draftsResponse.drafts);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '加载草稿列表失败';
            setError(errorMessage);
            console.error('加载草稿列表错误:', err);
          }
        } else {
          setShowSettings(true);
        }
      } catch (err) {
        console.error('加载草稿根目录配置失败:', err);
        setShowSettings(true);
      }
    };

    loadDraftRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组,只在组件挂载时运行一次

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
    if (draft.has_rules && typeof onRulesUpdated === 'function') {
      onRulesUpdated();
    }
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
    setAnchorEl(null);
  };

  /**
   * 打开下拉菜单
   */
  const handleOpenDropdown = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * 关闭下拉菜单
   */
  const handleCloseDropdown = () => {
    setAnchorEl(null);
  };

  /**
   * 导入压缩包草稿
   */
  const handleImportZip = async () => {
    setAnchorEl(null);

    if (!isElectron) {
      alert('此功能仅在 Electron 环境下可用');
      return;
    }

    if (!basePath) {
      alert('请先设置草稿根目录');
      setShowSettings(true);
      return;
    }

    try {
      // 打开文件选择对话框
      const result = await (window as any).electron.fs.selectFile({
        filters: [
          { name: '压缩文件', extensions: ['zip', 'rar', '7z'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const zipPath = result.filePaths[0];
      setLoading(true);
      setError(null);

      // 调用后端API解压文件
      await draftApi.importZip(basePath, zipPath);

      // 刷新草稿列表
      await loadDrafts();

      alert('导入成功!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导入失败';
      setError(errorMessage);
      console.error('导入压缩包失败:', err);
      alert(`导入失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理刷新
   */
  const handleRefresh = () => {
    setAnchorEl(null);
    loadDrafts();
  };

  /**
   * 处理设置
   */
  const handleSettings = () => {
    setAnchorEl(null);
    setShowSettings(!showSettings);
  };

  /**
   * 过滤后的草稿列表
   */
  const filteredDrafts = useMemo(() => {
    if (!showOnlyWithRules) {
      return drafts;
    }
    return drafts.filter(draft => draft.has_rules);
  }, [drafts, showOnlyWithRules]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            草稿列表
          </Typography>
          <Box>
            <Tooltip title="刷新">
              <IconButton size="small" onClick={() => loadDrafts()} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="更多操作">
              <IconButton size="small" onClick={handleOpenDropdown}>
                <MoreVert />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 过滤开关 */}
        <FormControlLabel
          control={
            <Switch
              checked={showOnlyWithRules}
              onChange={(e) => setShowOnlyWithRules(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              只显示有规则的草稿
            </Typography>
          }
          sx={{ mb: 0 }}
        />

        {/* 设置面板 */}
        {showSettings && (
          <Box sx={{ mt: 2 }}>
            <PathSelector
              value={basePath}
              onChange={(newPath) => {
                setBasePath(newPath);
                // Electron环境下选择目录后立即加载
                if (isElectron && newPath) {
                  loadDrafts(newPath);
                }
              }}
              label="草稿根目录"
              placeholder="例: D:\JianyingPro Drafts"
              dialogTitle="选择草稿根目录"
              buttonText="选择草稿根目录"
              disabled={loading}
              size="small"
            />
            {!isElectron && (
              <Button
                fullWidth
                variant="contained"
                size="small"
                onClick={() => loadDrafts()}
                disabled={loading || !basePath.trim()}
                sx={{ mt: 1 }}
              >
                保存并加载草稿
              </Button>
            )}
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
      {!loading && filteredDrafts.length > 0 && (
        <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {filteredDrafts.map((draft, index) => (
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: 1,
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
                      sx={{ mr: draft.has_rules ? 1 : 0 }}
                    />
                    {draft.has_rules ? (
                      <Chip
                        label="规则"
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : null}
                  </Box>
                </ListItemButton>
              </ListItem>
              {index < filteredDrafts.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* 空状态 */}
      {!loading && !error && filteredDrafts.length === 0 && basePath && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {showOnlyWithRules && drafts.length > 0
              ? '没有符合条件的草稿'
              : '未找到草稿文件'}
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
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>复制完整路径</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenInFolder}>
          <ListItemIcon>
            <FolderOpen fontSize="small" />
          </ListItemIcon>
          <ListItemText>打开文件夹位置</ListItemText>
        </MenuItem>
      </Menu>

      {/* 下拉菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={dropdownOpen}
        onClose={handleCloseDropdown}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {isElectron && basePath && (
          <MenuItem onClick={handleOpenDraftRootFolder}>
            <ListItemIcon>
              <FolderOpen fontSize="small" />
            </ListItemIcon>
            <ListItemText>打开草稿文件夹</ListItemText>
          </MenuItem>
        )}
        {isElectron && (
          <MenuItem onClick={handleImportZip}>
            <ListItemIcon>
              <Upload fontSize="small" />
            </ListItemIcon>
            <ListItemText>导入压缩包草稿</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleSettings}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>设置草稿目录</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
