'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Tooltip, Spinner, Checkbox, Dropdown, Label, ListBox, Avatar, Description } from '@heroui/react';
import {
  RefreshCw,
  Settings,
  FolderOpen,
  Copy,
  MoreVertical,
  Upload,
} from 'lucide-react';
import { draftApi, type DraftListItem } from '@/lib/api';
import PathSelector from '@/components/PathSelector';

interface DraftListProps {
  onDraftSelect: (draftPath: string, draftName: string) => void;
  onRulesUpdated?: () => void;
  onDraftRootChanged?: () => void;
  selectedDraftPath?: string;
}

/** 浮动菜单项样式 */
const menuItemClass =
  'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)] transition-colors';

/** 浮动菜单容器 */
function FloatingMenu({
  position,
  onClose,
  children,
}: {
  position: { top: number; left: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        className="fixed z-50 min-w-[180px] py-1 bg-[var(--popover)] text-[var(--popover-foreground)] border border-[var(--border)] rounded-md shadow-lg"
        style={{ top: position.top, left: position.left }}
      >
        {children}
      </div>
    </>
  );
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
  };

  /**
   * 导入压缩包草稿
   */
  const handleImportZip = async () => {
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
    loadDrafts();
  };

  /**
   * 处理设置
   */
  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  /** 下拉菜单动作路由 */
  const handleMenuAction = (key: React.Key) => {
    switch (key) {
      case 'openRoot':
        handleOpenDraftRootFolder();
        break;
      case 'importZip':
        handleImportZip();
        break;
      case 'settings':
        handleSettings();
        break;
    }
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
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">草稿列表</h2>
          <div className="flex items-center gap-1">
            <Tooltip delay={0}>
              <Button isIconOnly variant="ghost" size="sm" onPress={() => loadDrafts()} isDisabled={loading}>
                <RefreshCw size={18} />
              </Button>
              <Tooltip.Content placement="bottom">刷新</Tooltip.Content>
            </Tooltip>
            <Dropdown>
              <Button isIconOnly variant="ghost" size="sm" aria-label="更多操作">
                <MoreVertical size={18} />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu onAction={handleMenuAction}>
                  {isElectron && basePath && (
                    <Dropdown.Item id="openRoot" textValue="打开草稿文件夹">
                      <FolderOpen size={14} />
                      <Label>打开草稿文件夹</Label>
                    </Dropdown.Item>
                  )}
                  {isElectron && (
                    <Dropdown.Item id="importZip" textValue="导入压缩包草稿">
                      <Upload size={14} />
                      <Label>导入压缩包草稿</Label>
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item id="settings" textValue="设置草稿目录">
                    <Settings size={14} />
                    <Label>设置草稿目录</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>

        {/* 过滤开关 */}
        <Checkbox
          isSelected={showOnlyWithRules}
          onChange={(checked) => setShowOnlyWithRules(checked)}
          className="text-sm text-[var(--muted-foreground)]"
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            只显示有规则的草稿
          </Checkbox.Content>
        </Checkbox>

        {/* 设置面板 */}
        {showSettings && (
          <div className="mt-4">
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
                size="sm"
                onPress={() => loadDrafts()}
                isDisabled={loading || !basePath.trim()}
                className="mt-2"
              >
                保存并加载草稿
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 m-4 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm"
        >
          <span className="flex-1">{error}</span>
          <button type="button" className="text-red-800 hover:text-red-600" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      )}

      {/* 草稿列表 */}
      {!loading && filteredDrafts.length > 0 && (
        <ListBox
          aria-label="草稿列表"
          selectionMode="single"
          selectedKeys={new Set(selectedDraftPath ? [selectedDraftPath] : [])}
          onAction={(key) => {
            const draft = drafts.find(d => d.path === key);
            if (draft) handleDraftClick(draft);
          }}
          className="flex-1 overflow-auto"
        >
          {filteredDrafts.map(draft => (
            <ListBox.Item
              key={draft.path}
              id={draft.path}
              textValue={draft.name}
              onContextMenu={(e) => handleContextMenu(e, draft)}
            >
              <Avatar size="sm" className="bg-[var(--muted)]">
                <Avatar.Fallback>{draft.name.charAt(0).toUpperCase()}</Avatar.Fallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <Label>{draft.name}</Label>
                <Description>{formatTime(draft.modified_time)}</Description>
              </div>
              {draft.has_rules && (
                <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-[var(--accent)] text-[var(--accent-foreground)]">
                  规则
                </span>
              )}
            </ListBox.Item>
          ))}
        </ListBox>
      )}

      {/* 空状态 */}
      {!loading && !error && filteredDrafts.length === 0 && basePath && (
        <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
          {showOnlyWithRules && drafts.length > 0
            ? '没有符合条件的草稿'
            : '未找到草稿文件'}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <FloatingMenu
          position={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
          onClose={handleCloseContextMenu}
        >
          <button type="button" role="menuitem" className={menuItemClass} onClick={handleCopyPath}>
            <Copy size={14} />
            复制完整路径
          </button>
          <button type="button" role="menuitem" className={menuItemClass} onClick={handleOpenInFolder}>
            <FolderOpen size={14} />
            打开文件夹位置
          </button>
        </FloatingMenu>
      )}

    </div>
  );
}
