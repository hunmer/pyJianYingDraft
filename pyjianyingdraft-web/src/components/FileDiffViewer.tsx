'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  SelectChangeEvent,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
} from '@mui/material';
import Grid from '@mui/material/Grid'; // 始终使用Grid，不使用Grid2
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import { diffLines } from 'diff';
import 'react-diff-view/style/index.css';
import {
  type FileVersionInfo,
  type FileContentResponse,
} from '@/lib/api';
import { socketFileWatchApi } from '@/lib/socket';

interface FileDiffViewerProps {
  /** 选中的文件路径 */
  filePath: string;
}

/**
 * 文件Diff比较组件
 * 支持选择两个版本进行比较
 */
export default function FileDiffViewer({ filePath }: FileDiffViewerProps) {
  const [versions, setVersions] = useState<FileVersionInfo[]>([]);
  const [selectedVersion1, setSelectedVersion1] = useState<number | ''>('');
  const [selectedVersion2, setSelectedVersion2] = useState<number | ''>('');
  const [content1, setContent1] = useState<FileContentResponse | null>(null);
  const [content2, setContent2] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(13); // 字体大小状态

  /**
   * 加载版本列表 (使用WebSocket)
   */
  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await socketFileWatchApi.getVersions(filePath);
      const sortedVersions = [...response.versions].sort((a, b) => b.version - a.version);
      setVersions(sortedVersions);

      // 自动选择最新两个版本
      if (sortedVersions.length >= 2) {
        setSelectedVersion1(sortedVersions[1].version);
        setSelectedVersion2(sortedVersions[0].version);
      } else if (sortedVersions.length === 1) {
        setSelectedVersion1(sortedVersions[0].version);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载版本列表失败');
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (filePath) {
      loadVersions();
    }
  }, [filePath, loadVersions]);

  /**
   * 监听文件变化事件
   */
  useEffect(() => {
    const unsubscribe = socketFileWatchApi.onFileChanged((data) => {
      console.log('🔔 FileDiffViewer收到文件变化通知:', data);

      // 如果是当前正在查看的文件,则重新加载版本列表
      if (data.file_path === filePath) {
        console.log('🔄 重新加载版本列表...');
        loadVersions();
      }
    });

    // 清理监听器
    return () => {
      unsubscribe();
    };
  }, [filePath, loadVersions]);

  /**
   * 加载版本1内容 (使用WebSocket)
   */
  useEffect(() => {
    const loadContent = async () => {
      if (selectedVersion1 === '') return;

      try {
        const response = await socketFileWatchApi.getVersionContent(filePath, selectedVersion1);
        setContent1(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载版本内容失败');
      }
    };

    loadContent();
  }, [filePath, selectedVersion1]);

  /**
   * 加载版本2内容 (使用WebSocket)
   */
  useEffect(() => {
    const loadContent = async () => {
      if (selectedVersion2 === '') return;

      try {
        const response = await socketFileWatchApi.getVersionContent(filePath, selectedVersion2);
        setContent2(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载版本内容失败');
      }
    };

    loadContent();
  }, [filePath, selectedVersion2]);

  /**
   * 检测是否为JSON格式
   */
  const isJsonFormat = (text: string): boolean => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * 格式化JSON
   */
  const formatJson = (text: string): string => {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  };

  /**
   * 生成diff
   */
  const diffFiles = useMemo(() => {
    if (!content1 || !content2) return [];

    let oldText = content1.content;
    let newText = content2.content;

    // 如果是JSON格式,先格式化
    if (isJsonFormat(oldText) && isJsonFormat(newText)) {
      oldText = formatJson(oldText);
      newText = formatJson(newText);
    }

    // 使用 diff 库生成 unified diff 格式
    const changes = diffLines(oldText, newText);

    // 手动构建 unified diff 格式
    let diffText = `--- v${content1.version}\n+++ v${content2.version}\n@@ -1,${oldText.split('\n').length} +1,${newText.split('\n').length} @@\n`;

    changes.forEach((part) => {
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      const lines = part.value.split('\n');
      lines.forEach((line, index) => {
        if (index < lines.length - 1 || line) {
          diffText += `${prefix}${line}\n`;
        }
      });
    });

    // 解析diff
    try {
      const files = parseDiff(diffText, { nearbySequences: 'zip' });
      return files.length > 0 ? files : [];
    } catch (err) {
      console.error('解析diff失败:', err);
      return [];
    }
  }, [content1, content2]);

  /**
   * 渲染tokens（可选的语法高亮）
   */
  const renderToken = (token: any, defaultRender: any, i: number) => {
    return defaultRender(token, i);
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /**
   * 格式化时间
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (versions.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Typography variant="body1" color="text.secondary">
          该文件暂无版本记录
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 版本选择器和字体大小控制 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        {/* 字体大小控制 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Tooltip title="字体大小">
            <ButtonGroup size="small" variant="outlined">
              <Button
                onClick={() => setFontSize(Math.max(8, fontSize - 1))}
                disabled={fontSize <= 8}
              >
                <RemoveIcon fontSize="small" />
              </Button>
              <Button
                onClick={() => setFontSize(13)}
                disabled={fontSize === 13}
              >
                <RestartAltIcon fontSize="small" />
              </Button>
              <Button
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                disabled={fontSize >= 24}
              >
                <AddIcon fontSize="small" />
              </Button>
            </ButtonGroup>
          </Tooltip>
          <Typography variant="caption" sx={{ ml: 1, alignSelf: 'center', minWidth: '40px' }}>
            {fontSize}px
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {/* 版本1选择 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>版本 1 (旧版本)</InputLabel>
              <Select
                value={selectedVersion1}
                label="版本 1 (旧版本)"
                onChange={(e: SelectChangeEvent<number | ''>) =>
                  setSelectedVersion1(e.target.value as number)
                }
              >
                {versions.map((v) => (
                  <MenuItem key={v.version} value={v.version}>
                    v{v.version} - {formatDate(v.timestamp)} ({formatFileSize(v.file_size)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {content1 && (
              <Box sx={{ mt: 1 }}>
                <Chip label={`v${content1.version}`} size="small" sx={{ mr: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(content1.timestamp)} | {formatFileSize(content1.file_size)}
                </Typography>
              </Box>
            )}
          </Grid>

          {/* 版本2选择 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>版本 2 (新版本)</InputLabel>
              <Select
                value={selectedVersion2}
                label="版本 2 (新版本)"
                onChange={(e: SelectChangeEvent<number | ''>) =>
                  setSelectedVersion2(e.target.value as number)
                }
              >
                {versions.map((v) => (
                  <MenuItem key={v.version} value={v.version}>
                    v{v.version} - {formatDate(v.timestamp)} ({formatFileSize(v.file_size)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {content2 && (
              <Box sx={{ mt: 1 }}>
                <Chip label={`v${content2.version}`} size="small" color="primary" sx={{ mr: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(content2.timestamp)} | {formatFileSize(content2.file_size)}
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      {/* Diff视图 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {content1 && content2 && selectedVersion1 !== '' && selectedVersion2 !== '' ? (
          diffFiles.length > 0 ? (
            <Box
              sx={{
                '& .diff': {
                  fontSize: `${fontSize}px`,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                },
                '& .diff-gutter': {
                  userSelect: 'none',
                },
                '& .diff-gutter-insert': {
                  backgroundColor: '#e6ffed',
                },
                '& .diff-gutter-delete': {
                  backgroundColor: '#ffeef0',
                },
                '& .diff-code-insert': {
                  backgroundColor: '#f0fff4',
                },
                '& .diff-code-delete': {
                  backgroundColor: '#ffeef0',
                },
              }}
            >
              {diffFiles.map((file, index) => (
                <Diff
                  key={index}
                  viewType="split"
                  diffType={file.type}
                  hunks={file.hunks}
                  renderToken={renderToken}
                >
                  {(hunks) =>
                    hunks.map((hunk) => (
                      <Hunk key={hunk.content} hunk={hunk} />
                    ))
                  }
                </Diff>
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Typography variant="body1" color="text.secondary">
                两个版本内容相同，无差异
              </Typography>
            </Box>
          )
        ) : (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              请选择两个版本进行比较
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
