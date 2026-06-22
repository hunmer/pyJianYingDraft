'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button, Spinner } from '@heroui/react';
import { Play, Video, FileAudio, Type, Info } from 'lucide-react';
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
    <div className="px-4">
      <div className="py-8">
        {/* 输入区域 */}
        <div className="p-6 mb-6 bg-[var(--card)] border border-[var(--border)] rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-center">
            <div className="md:col-span-7">
              <input
                type="text"
                placeholder="例: D:\JianyingPro Drafts\my_project\draft_content.json"
                value={draftPath}
                onChange={(e) => setDraftPath(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="w-full px-3 py-3 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60"
              />
            </div>
            <div className="md:col-span-3">
              <Button
                fullWidth
                size="lg"
                onPress={handleLoadDraft}
                isDisabled={loading || !draftPath.trim()}
                startContent={loading ? <Spinner size="sm" /> : <Play size={18} />}
                className="h-14"
              >
                {loading ? '加载中...' : '加载草稿'}
              </Button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex justify-between items-start gap-2">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 font-bold leading-none"
                aria-label="close"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* 草稿信息卡片 */}
        {draftInfo && (
          <div className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={18} className="text-[var(--accent)]" />
                  <div className="text-base font-semibold">分辨率</div>
                </div>
                <div className="text-xl font-bold">
                  {draftInfo.width} × {draftInfo.height}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {draftInfo.fps} FPS
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Play size={18} className="text-[var(--accent)]" />
                  <div className="text-base font-semibold">时长</div>
                </div>
                <div className="text-xl font-bold">
                  {draftInfo.duration_seconds.toFixed(2)}s
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {(draftInfo.duration / 1000000).toFixed(0)} 微秒
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Video size={18} className="text-[var(--accent)]" />
                  <div className="text-base font-semibold">轨道</div>
                </div>
                <div className="text-xl font-bold">
                  {draftInfo.track_count}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {tracks.filter(t => t.type === 'video').length} 视频 / {' '}
                  {tracks.filter(t => t.type === 'audio').length} 音频 / {' '}
                  {tracks.filter(t => t.type === 'text').length} 文本
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileAudio size={18} className="text-[var(--accent)]" />
                  <div className="text-base font-semibold">素材</div>
                </div>
                <div className="text-xl font-bold">
                  {Array.isArray(materials) ? materials.length : 0}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {Array.isArray(materials) ? materials.filter(m => m.type === 'video').length : 0} 视频 / {' '}
                  {Array.isArray(materials) ? materials.filter(m => m.type === 'audio').length : 0} 音频 / {' '}
                  {Array.isArray(materials) ? materials.filter(m => m.type === 'text').length : 0} 文本
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 时间轴编辑器 */}
        {draftInfo && tracks.length > 0 && (
          <div>
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
              handleTestDataSelect={() => {
                // Editor页面不需要测试数据选择功能,提供空实现
                console.log('测试数据选择功能在 Editor 页面不可用');
              }}
            />
          </div>
        )}

        {/* 空状态提示 */}
        {!draftInfo && !loading && (
          <div
            className="p-16 text-center border-2 border-dashed border-gray-300 rounded-md bg-gray-50"
          >
            <Type size={80} className="mx-auto text-gray-400 mb-4" />
            <div className="text-lg font-semibold mb-2 text-[var(--muted-foreground)]">
              开始使用
            </div>
            <div className="text-sm text-[var(--muted-foreground)]">
              在上方输入框中粘贴草稿文件路径,点击&ldquo;加载草稿&rdquo;按钮
            </div>
            <div className="mt-6">
              <div className="text-sm text-[var(--muted-foreground)] mb-2">
                示例路径:
              </div>
              <code className="inline-block px-4 py-1 bg-gray-200 rounded font-mono text-sm">
                D:\JianyingPro Drafts\my_project\draft_content.json
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
