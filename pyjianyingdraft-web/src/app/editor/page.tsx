'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Videocam,
  AudioFile,
  TextFields,
  Info,
} from '@mui/icons-material';
import TimelineEditor from '@/components/Timeline';
import { draftApi, tracksApi, materialsApi, type AllMaterialsResponse } from '@/lib/api';
import type { DraftInfo, TrackInfo, MaterialInfo } from '@/types/draft';

/**
 * Editor页面 - 剪映草稿时间轴编辑器
 */
export default function EditorPage() {
  // 状态管理
  const [draftPath, setDraftPath] = useState<string>('');

  // 组件加载时读取上次保存的草稿路径
  useEffect(() => {
    const lastDraftPath = localStorage.getItem('lastDraftPath');
    if (lastDraftPath) {
      setDraftPath(lastDraftPath);
    }
  }, []);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 草稿数据
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [materials, setMaterials] = useState<MaterialInfo[]>([]);
  const [rawDraft, setRawDraft] = useState<Record<string, any> | null>(null);
  const [materialCategories, setMaterialCategories] = useState<AllMaterialsResponse | null>(null);

  /**
   * 加载草稿文件
   */
  const handleLoadDraft = useCallback(async () => {
    if (!draftPath.trim()) {
      setError('请输入草稿文件路径');
      return;
    }

    setLoading(true);
    setError(null);
    setRawDraft(null);
    setMaterialCategories(null);

    try {
      // 1. 验证文件
      const validation = await draftApi.validate(draftPath);
      if (!validation.valid) {
        throw new Error(validation.message || '草稿文件无效');
      }

      // 2. 获取草稿基础信息
      const info = await draftApi.getInfo(draftPath);
      const raw = await draftApi.getRaw(draftPath);
      setDraftInfo(info);
      setTracks(info.tracks || []);
      setRawDraft(raw);

      // 保存草稿路径到localStorage
      localStorage.setItem('lastDraftPath', draftPath);

      // 3. 获取素材信息(可选,用于显示详情)
      try {
        const mats = await materialsApi.getAll(draftPath);
        console.log('获取素材信息成功:', mats)
        setMaterialCategories(mats);

        // 将对象格式转换为数组格式: { videos: {items: []}, audios: {items: []} } => MaterialInfo[]
        const flatMaterials: MaterialInfo[] = Object.values(mats)
          .flatMap((category) => category?.items || []);
        setMaterials(flatMaterials);
      } catch (err) {
        console.warn('获取素材信息失败:', err);
        setMaterials([]);
        setMaterialCategories(null);
      }

      console.log('草稿加载成功:', info);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载草稿失败';
      setError(errorMessage);
      setRawDraft(null);
      setMaterialCategories(null);
      setMaterials([]);
      console.error('加载草稿错误:', err);
    } finally {
      setLoading(false);
    }
  }, [draftPath]);

  /**
   * 按Enter键加载
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadDraft();
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ px: 2 }}>
      <Box sx={{ py: 4 }}>
        {/* 输入区域 */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField
                fullWidth
                label="草稿文件路径"
                placeholder="例: D:\JianyingPro Drafts\my_project\draft_content.json"
                value={draftPath}
                onChange={(e) => setDraftPath(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLoadDraft}
                disabled={loading || !draftPath.trim()}
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                sx={{ height: '56px' }}
              >
                {loading ? '加载中...' : '加载草稿'}
              </Button>
            </Grid>
          </Grid>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Paper>

        {/* 草稿信息卡片 */}
        {draftInfo && (
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Info color="primary" />
                      <Typography variant="h6">分辨率</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {draftInfo.width} × {draftInfo.height}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {draftInfo.fps} FPS
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PlayArrow color="primary" />
                      <Typography variant="h6">时长</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {draftInfo.duration_seconds.toFixed(2)}s
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {(draftInfo.duration / 1000000).toFixed(0)} 微秒
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Videocam color="primary" />
                      <Typography variant="h6">轨道</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {draftInfo.track_count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tracks.filter(t => t.type === 'video').length} 视频 / {' '}
                      {tracks.filter(t => t.type === 'audio').length} 音频 / {' '}
                      {tracks.filter(t => t.type === 'text').length} 文本
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AudioFile color="primary" />
                      <Typography variant="h6">素材</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {Array.isArray(materials) ? materials.length : 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Array.isArray(materials) ? materials.filter(m => m.type === 'video').length : 0} 视频 / {' '}
                      {Array.isArray(materials) ? materials.filter(m => m.type === 'audio').length : 0} 音频 / {' '}
                      {Array.isArray(materials) ? materials.filter(m => m.type === 'text').length : 0} 文本
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* 时间轴编辑器 */}
        {draftInfo && tracks.length > 0 && (
          <Box>
            <TimelineEditor
              tracks={tracks}
              materials={materials}
              duration={draftInfo.duration_seconds}
              rawDraft={rawDraft ?? undefined}
              rawMaterials={materialCategories ?? undefined}
              canvasWidth={draftInfo.width}
              canvasHeight={draftInfo.height}
              fps={draftInfo.fps}
              readOnly={true}
            />
          </Box>
        )}

        {/* 空状态提示 */}
        {!draftInfo && !loading && (
          <Paper
            elevation={0}
            sx={{
              p: 8,
              textAlign: 'center',
              backgroundColor: 'grey.50',
              border: '2px dashed',
              borderColor: 'grey.300',
            }}
          >
            <TextFields sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
            <Typography variant="h5" gutterBottom color="text.secondary">
              开始使用
            </Typography>
            <Typography variant="body1" color="text.secondary">
              在上方输入框中粘贴草稿文件路径,点击&ldquo;加载草稿&rdquo;按钮
            </Typography>
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                示例路径:
              </Typography>
              <Box
                component="code"
                sx={{
                  display: 'inline-block',
                  px: 2,
                  py: 1,
                  backgroundColor: 'grey.200',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                }}
              >
                D:\JianyingPro Drafts\my_project\draft_content.json
              </Box>
            </Box>
          </Paper>
        )}
      </Box>
    </Container>
  );
}
