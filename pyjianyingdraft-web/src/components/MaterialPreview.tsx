'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Slider, Alert } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import type { MaterialInfo } from '@/types/draft';

interface MaterialPreviewProps {
  /** 素材信息 */
  material: MaterialInfo;
  /** API基础URL */
  apiBaseUrl?: string;
}

/**
 * 素材预览组件
 * 支持视频、音频、图片、文本的预览
 */
export const MaterialPreview: React.FC<MaterialPreviewProps> = ({
  material,
  apiBaseUrl = 'http://localhost:8000'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 获取完整的文件URL(使用新的预览接口)
  const getFileUrl = () => {
    if (!material.path) return null;
    // 如果path已经是完整URL,直接使用
    if (material.path.startsWith('http://') || material.path.startsWith('https://')) {
      return material.path;
    }
    // 使用新的文件预览API
    return `${apiBaseUrl}/api/files/preview?file_path=${encodeURIComponent(material.path)}`;
  };

  const fileUrl = getFileUrl();

  // 解析subtitle类型的content字段
  const parseSubtitleContent = (content: any): string | null => {
    if (!content) return null;
    try {
      if (typeof content === 'string') {
        const parsed = JSON.parse(content);
        return parsed.text || null;
      } else if (typeof content === 'object' && content.text) {
        return content.text;
      }
    } catch (e) {
      console.error('解析subtitle内容失败:', e);
    }
    return null;
  };

  // 重置播放状态
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
  }, [material.id]);

  // 处理播放/暂停
  const togglePlay = () => {
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (!mediaElement) return;

    if (isPlaying) {
      mediaElement.pause();
    } else {
      mediaElement.play().catch(err => {
        setError('播放失败: ' + err.message);
      });
    }
    setIsPlaying(!isPlaying);
  };

  // 处理时间更新
  const handleTimeUpdate = () => {
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaElement) {
      setCurrentTime(mediaElement.currentTime);
    }
  };

  // 处理加载元数据
  const handleLoadedMetadata = () => {
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaElement) {
      setDuration(mediaElement.duration);
    }
  };

  // 处理播放结束
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // 处理进度条拖动
  const handleSeek = (event: Event, newValue: number | number[]) => {
    const time = newValue as number;
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 处理音量变化
  const handleVolumeChange = (event: Event, newValue: number | number[]) => {
    const vol = newValue as number;
    setVolume(vol);
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.volume = vol;
    }
  };

  // 切换静音
  const toggleMute = () => {
    setIsMuted(!isMuted);
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.muted = !isMuted;
    }
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染错误提示
  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  // subtitle类型特殊处理:从content字段获取文本
  if (['subtitle', 'text'].includes(material.type)) {
    const subtitleText = parseSubtitleContent((material as any).content);

    if (subtitleText) {
      return (
        <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <TextFieldsIcon color="primary" />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              字幕内容
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              pl: 4,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              fontStyle: 'italic',
            }}
          >
            &ldquo;{subtitleText}&rdquo;
          </Typography>
        </Paper>
      );
    } else {
      return (
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            无法解析字幕内容
          </Typography>
        </Paper>
      );
    }
  }

  // 如果没有path,显示提示
  if (!material.path) {
    return (
      <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          此素材没有关联的文件路径
        </Typography>
      </Paper>
    );
  }

  // 渲染视频预览
  if (material.type === 'video') {
    return (
      <Box sx={{ width: '100%' }}>
        <Paper elevation={1} sx={{ overflow: 'hidden', bgcolor: 'black' }}>
          <video
            ref={videoRef}
            src={fileUrl || ''}
            style={{ width: '100%', display: 'block', maxHeight: '200px' }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={(e) => setError('视频加载失败')}
          />
        </Paper>

        {/* 控制栏 */}
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>

            <Typography variant="caption" sx={{ minWidth: '45px' }}>
              {formatTime(currentTime)}
            </Typography>

            <Slider
              size="small"
              value={currentTime}
              max={duration || 100}
              onChange={handleSeek}
              sx={{ flex: 1 }}
            />

            <Typography variant="caption" sx={{ minWidth: '45px' }}>
              {formatTime(duration)}
            </Typography>

            <IconButton size="small" onClick={toggleMute}>
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>

            <Slider
              size="small"
              value={volume}
              max={1}
              step={0.1}
              onChange={handleVolumeChange}
              sx={{ width: '60px' }}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // 渲染音频预览 (支持 audio 和 extract_music 类型)
  if (['audio', 'extract_music', 'music', 'sound'].includes(material.type)) {
    return (
      <Box sx={{ width: '100%' }}>
        <Paper elevation={1} sx={{ p: 3, bgcolor: 'grey.900', textAlign: 'center' }}>
          <AudiotrackIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ color: 'grey.400', mt: 1, display: 'block' }}>
            {material.type === 'extract_music' ? '提取的音乐' : '音频'}
          </Typography>
          <audio
            ref={audioRef}
            src={fileUrl || ''}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={(e) => setError('音频加载失败')}
            style={{ display: 'none' }}
          />
        </Paper>

        {/* 控制栏 */}
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>

            <Typography variant="caption" sx={{ minWidth: '45px' }}>
              {formatTime(currentTime)}
            </Typography>

            <Slider
              size="small"
              value={currentTime}
              max={duration || 100}
              onChange={handleSeek}
              sx={{ flex: 1 }}
            />

            <Typography variant="caption" sx={{ minWidth: '45px' }}>
              {formatTime(duration)}
            </Typography>

            <IconButton size="small" onClick={toggleMute}>
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>

            <Slider
              size="small"
              value={volume}
              max={1}
              step={0.1}
              onChange={handleVolumeChange}
              sx={{ width: '60px' }}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // 渲染图片预览
  if (material.type === 'image' || material.type === 'photo') {
    return (
      <Paper elevation={1} sx={{ overflow: 'hidden', bgcolor: 'grey.100', textAlign: 'center' }}>
        <img
          src={fileUrl || ''}
          alt={material.name || '图片'}
          style={{ maxWidth: '100%', maxHeight: '200px', display: 'block', margin: '0 auto' }}
          onError={(e) => {
            setError('图片加载失败');
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </Paper>
    );
  }
  // 其他类型的素材
  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100', textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        不支持预览此类型素材: {material.type}
      </Typography>
    </Paper>
  );
};

export default MaterialPreview;
