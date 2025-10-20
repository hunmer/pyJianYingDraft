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
} from '@mui/material';
import {
  Folder,
  Refresh,
  Settings,
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

  // 从localStorage加载基础路径
  useEffect(() => {
    const savedPath = localStorage.getItem('draftsBasePath');
    if (savedPath) {
      setBasePath(savedPath);
      // 自动加载草稿列表
      loadDrafts(savedPath);
    } else {
      setShowSettings(true);
    }
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

      // 保存路径到localStorage
      localStorage.setItem('draftsBasePath', pathToUse);
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
    </Box>
  );
}
