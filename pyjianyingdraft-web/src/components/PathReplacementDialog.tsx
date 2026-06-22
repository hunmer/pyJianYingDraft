'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@heroui/react';
import {
  Link as LinkIcon,
  AlertTriangle,
  GripVertical,
  CheckCircle,
  CloudUpload,
} from 'lucide-react';

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <LinkIcon size={20} />
            路径替换 - 本地路径转 HTTP 路径
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 overflow-auto flex-1">
          <div className="flex flex-col gap-4">
            {/* 提示信息 */}
            <div className="p-3 rounded-md border border-blue-300 bg-blue-50 text-blue-800 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="mb-1">
                  检测到 <strong>{localPaths.length}</strong> 个本地文件路径
                </div>
                <div>
                  您可以为这些文件提供 HTTP URL 进行替换。未填写的路径将保留原值。
                </div>
              </div>
            </div>

            {/* 路径列表 */}
            {localPaths.length === 0 ? (
              <div className="p-3 rounded-md border border-green-300 bg-green-50 text-green-800 text-sm">
                未检测到本地文件路径，可以直接导出！
              </div>
            ) : (
              <div className="w-full flex flex-col">
                {localPaths.map((pathInfo, index) => (
                  <React.Fragment key={`${pathInfo.materialId}-${index}`}>
                    <div className="flex flex-col gap-2 py-4">
                      {/* 素材信息 */}
                      <div className="flex gap-2 items-center">
                        <span className="px-2 py-0.5 text-xs rounded border border-[var(--accent)] text-[var(--accent-foreground)]">
                          素材 {index + 1}
                        </span>
                        {pathInfo.materialName && (
                          <span className="text-sm text-[var(--muted-foreground)]">
                            {pathInfo.materialName}
                          </span>
                        )}
                      </div>

                      {/* 原始路径 */}
                      <div>
                        <div className="text-sm font-medium">原始路径</div>
                        <div
                          className="text-sm break-all"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: 'var(--destructive)',
                          }}
                        >
                          {pathInfo.originalPath}
                        </div>
                      </div>

                      {/* URL 输入框 */}
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">
                          替换为 HTTP URL (可选)
                        </label>
                        <div className="flex items-center gap-2">
                          <LinkIcon size={16} className="text-[var(--muted-foreground)] flex-shrink-0" />
                          <input
                            type="text"
                            placeholder="https://example.com/path/to/file.mp4"
                            value={replacements[pathInfo.originalPath] || ''}
                            onChange={(e) =>
                              handlePathChange(pathInfo.originalPath, e.target.value)
                            }
                            className="flex-1 px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          留空则保留原路径
                        </span>
                      </div>

                      {/* 文件拖出区域（仅在 Electron 环境且文件存在时显示） */}
                      {isElectron() && fileExists[pathInfo.originalPath] && (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, pathInfo.originalPath)}
                          onDragEnd={(e) => handleDragEnd(e, pathInfo.originalPath)}
                          className={`p-4 text-center border-2 border-dashed rounded cursor-grab active:cursor-grabbing transition-all ${
                            draggingStates[pathInfo.originalPath]
                              ? 'border-green-500 bg-green-50'
                              : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] hover:bg-[var(--muted)]'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <GripVertical size={18} className="text-[var(--muted-foreground)]" />
                            <CloudUpload size={18} className="text-[var(--accent)]" />
                            <span className="text-sm text-[var(--muted-foreground)]">
                              拖拽此处将文件上传到其他应用
                            </span>
                            <CheckCircle
                              size={16}
                              className="text-green-600"
                              aria-label="文件存在于本地"
                            />
                          </div>
                          <div className="block mt-1 text-xs text-[var(--muted-foreground)]">
                            支持拖拽到浏览器上传框、云存储等
                          </div>
                        </div>
                      )}
                    </div>
                    {index < localPaths.length - 1 && (
                      <div className="border-b border-[var(--border)]" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* 替换统计 */}
            {localPaths.length > 0 && (
              <div
                className={`p-3 rounded-md text-sm border ${
                  replacedCount === localPaths.length
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : 'border-yellow-300 bg-yellow-50 text-yellow-800'
                }`}
              >
                已替换: <strong>{replacedCount}</strong> / {localPaths.length} 个路径
                {replacedCount < localPaths.length && (
                  <div className="mt-1">未替换的路径将保留原值</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
          <Button variant="ghost" onPress={onClose}>
            取消
          </Button>
          <Button
            onPress={handleConfirm}
            startContent={<LinkIcon size={16} />}
          >
            确定导出
            {replacedCount > 0 && ` (${replacedCount} 个已替换)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
