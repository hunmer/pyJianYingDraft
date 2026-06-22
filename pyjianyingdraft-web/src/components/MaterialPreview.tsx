'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@heroui/react';
import Image from 'next/image';
import {
  Play as PlayArrowIcon,
  Pause as PauseIcon,
  Volume2 as VolumeUpIcon,
  VolumeX as VolumeOffIcon,
  Music as AudiotrackIcon,
  Type as TextFieldsIcon,
} from 'lucide-react';
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
  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(event.target.value);
    const mediaElement = material.type === 'video' ? videoRef.current : audioRef.current;
    if (mediaElement) {
      mediaElement.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 处理音量变化
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(event.target.value);
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
      <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex justify-between items-start gap-2">
        <span className="flex-1">{error}</span>
        <button onClick={() => setError(null)} className="text-red-800 hover:underline">×</button>
      </div>
    );
  }

  // subtitle类型特殊处理:从content字段获取文本
  if (['subtitle', 'text'].includes(material.type)) {
    const subtitleText = parseSubtitleContent((material as any).content);

    if (subtitleText) {
      return (
        <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded-md">
          <div className="flex items-start gap-2 mb-2">
            <TextFieldsIcon size={18} className="text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">
              字幕内容
            </span>
          </div>
          <p className="pl-8 text-sm break-words whitespace-pre-wrap italic">
            &ldquo;{subtitleText}&rdquo;
          </p>
        </div>
      );
    } else {
      return (
        <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded-md text-center">
          <span className="text-sm text-[var(--muted-foreground)]">
            无法解析字幕内容
          </span>
        </div>
      );
    }
  }

  // 如果没有path,显示提示
  if (!material.path) {
    return (
      <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded-md text-center">
        <span className="text-sm text-[var(--muted-foreground)]">
          此素材没有关联的文件路径
        </span>
      </div>
    );
  }

  // 渲染视频预览
  if (material.type === 'video') {
    return (
      <div className="w-full">
        <div className="overflow-hidden bg-black border border-[var(--border)] rounded-md">
          <video
            ref={videoRef}
            src={fileUrl || ''}
            style={{ width: '100%', display: 'block', maxHeight: '200px' }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={(e) => {
              // 视频加载失败时尝试回退到图片
              const videoElement = e.target as HTMLVideoElement;
              videoElement.style.display = 'none';

              // 清理之前插入的图片元素
              const existingFallbackImg = videoElement.nextElementSibling;
              if (existingFallbackImg && existingFallbackImg.tagName === 'IMG') {
                existingFallbackImg.remove();
              }

              // 创建img元素尝试加载
              const img = document.createElement('img');
              img.src = fileUrl || '';
              img.style.width = '100%';
              img.style.display = 'block';
              img.style.maxHeight = '200px';
              img.onerror = () => setError('视频和图片加载均失败');

              // 插入到video元素后面
              videoElement.parentNode?.insertBefore(img, videoElement.nextSibling);

              // 隐藏控制栏
              const controlsContainer = videoElement.parentElement?.nextElementSibling;
              if (controlsContainer) {
                (controlsContainer as HTMLElement).style.display = 'none';
              }
            }}
          />
        </div>

        {/* 控制栏 */}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Button isIconOnly variant="ghost" size="sm" onPress={togglePlay}>
              {isPlaying ? <PauseIcon size={18} /> : <PlayArrowIcon size={18} />}
            </Button>

            <span className="text-xs min-w-[45px]">
              {formatTime(currentTime)}
            </span>

            <input
              type="range"
              className="flex-1 accent-[var(--accent)]"
              value={currentTime}
              max={duration || 100}
              step={0.1}
              onChange={handleSeek}
            />

            <span className="text-xs min-w-[45px]">
              {formatTime(duration)}
            </span>

            <Button isIconOnly variant="ghost" size="sm" onPress={toggleMute}>
              {isMuted ? <VolumeOffIcon size={18} /> : <VolumeUpIcon size={18} />}
            </Button>

            <input
              type="range"
              className="w-15 accent-[var(--accent)]"
              style={{ width: '60px' }}
              value={volume}
              max={1}
              step={0.1}
              onChange={handleVolumeChange}
            />
          </div>
        </div>
      </div>
    );
  }

  // 渲染音频预览 (支持 audio 和 extract_music 类型)
  if (['audio', 'extract_music', 'music', 'sound'].includes(material.type)) {
    return (
      <div className="w-full">
        <div className="p-6 bg-gray-900 border border-[var(--border)] rounded-md text-center">
          <AudiotrackIcon size={48} className="text-[var(--accent)] mx-auto" />
          <span className="block text-xs text-gray-400 mt-2">
            {material.type === 'extract_music' ? '提取的音乐' : '音频'}
          </span>
          <audio
            ref={audioRef}
            src={fileUrl || ''}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={(e) => setError('音频加载失败')}
            style={{ display: 'none' }}
          />
        </div>

        {/* 控制栏 */}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Button isIconOnly variant="ghost" size="sm" onPress={togglePlay}>
              {isPlaying ? <PauseIcon size={18} /> : <PlayArrowIcon size={18} />}
            </Button>

            <span className="text-xs min-w-[45px]">
              {formatTime(currentTime)}
            </span>

            <input
              type="range"
              className="flex-1 accent-[var(--accent)]"
              value={currentTime}
              max={duration || 100}
              step={0.1}
              onChange={handleSeek}
            />

            <span className="text-xs min-w-[45px]">
              {formatTime(duration)}
            </span>

            <Button isIconOnly variant="ghost" size="sm" onPress={toggleMute}>
              {isMuted ? <VolumeOffIcon size={18} /> : <VolumeUpIcon size={18} />}
            </Button>

            <input
              type="range"
              className="accent-[var(--accent)]"
              style={{ width: '60px' }}
              value={volume}
              max={1}
              step={0.1}
              onChange={handleVolumeChange}
            />
          </div>
        </div>
      </div>
    );
  }

  // 渲染图片预览
  if (material.type === 'image' || material.type === 'photo') {
    return (
      <div className="overflow-hidden bg-[var(--muted)] border border-[var(--border)] rounded-md text-center">
        <Image
          src={fileUrl || ''}
          alt={material.name || '图片'}
          width={0}
          height={0}
          sizes="100vw"
          style={{ width: '100%', height: 'auto', maxHeight: '200px', display: 'block', margin: '0 auto' }}
          onError={(e) => {
            setError('图片加载失败');
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }
  // 其他类型的素材
  return (
    <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded-md text-center">
      <span className="text-sm text-[var(--muted-foreground)]">
        不支持预览此类型素材: {material.type}
      </span>
    </div>
  );
};

export default MaterialPreview;
