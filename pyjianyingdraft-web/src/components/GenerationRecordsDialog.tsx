'use client';

import React, { useState, useEffect } from 'react';
import { Button, Spinner, toast } from '@heroui/react';
import { X, RefreshCw, RotateCcw, Trash2, Download } from 'lucide-react';
import { generationRecordsApi, tasksApi, type GenerationRecord } from '@/lib/api';
import { useAria2WebSocket } from '@/hooks/useAria2WebSocket';

interface GenerationRecordsDialogProps {
  open: boolean;
  onClose: () => void;
  onReimport?: (record: GenerationRecord) => void;
  onOpenDownloadManager?: (taskId?: string) => void;
}

/**
 * 生成记录对话框组件
 */
export function GenerationRecordsDialog({ open, onClose, onReimport, onOpenDownloadManager }: GenerationRecordsDialogProps) {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<GenerationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setDownloads] = useState<any[]>([]);

  // 加载生成记录列表
  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await generationRecordsApi.list({ limit: 100 });
      setRecords(response.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载生成记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开对话框时加载记录
  useEffect(() => {
    if (open) {
      loadRecords();
    }
  }, [open]);

  // 处理记录选择
  const handleSelectRecord = (record: GenerationRecord) => {
    setSelectedRecord(record);
  };

  // 处理重新导入
  const handleReimport = () => {
    if (selectedRecord && onReimport) {
      onReimport(selectedRecord);
      onClose();
    }
  };

  // 处理删除记录
  const handleDeleteRecord = async (record: GenerationRecord, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发列表项选择

    if (!confirm(`确定要删除生成记录 "${record.rule_group_title || '未命名'}" 吗？`)) {
      return;
    }

    try {
      await generationRecordsApi.delete(record.record_id);

      // 如果删除的是当前选中的记录，清空选中状态
      if (selectedRecord?.record_id === record.record_id) {
        setSelectedRecord(null);
        setDownloads([]);
      }

      // 重新加载列表
      await loadRecords();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 打开下载管理器
  const handleOpenDownloads = () => {
    if (onOpenDownloadManager) {
      onOpenDownloadManager(selectedRecord?.task_id);
    }
  };

  // 获取状态颜色样式
  const getStatusClassName = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'downloading':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '等待中',
      downloading: '下载中',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl w-full max-w-6xl h-[80vh] max-h-[900px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 对话框标题栏 */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">生成记录</h2>
          <div className="flex items-center gap-1">
            <Button isIconOnly variant="ghost" size="sm" onPress={loadRecords} isDisabled={loading}>
              <RefreshCw size={18} />
            </Button>
            <Button isIconOnly variant="ghost" size="sm" onPress={onClose}>
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* 对话框内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：记录列表 */}
          <div className="w-[350px] flex flex-col border-r border-[var(--border)] bg-[var(--card)]">
            <div className="p-4 border-b border-[var(--border)]">
              <span className="text-sm font-medium text-[var(--muted-foreground)]">
                共 {records.length} 条记录
              </span>
            </div>

            {loading && (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            )}

            {error && (
              <div className="m-4 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="flex-1 overflow-auto">
                {records.length === 0 ? (
                  <div className="p-4 text-center">
                    <span className="text-sm text-[var(--muted-foreground)]">暂无生成记录</span>
                  </div>
                ) : (
                  records.map((record) => {
                    const isSelected = selectedRecord?.record_id === record.record_id;
                    return (
                      <div
                        key={record.record_id}
                        className={`flex items-center justify-between pr-2 cursor-pointer hover:bg-[var(--muted)] ${
                          isSelected ? 'bg-[var(--muted)]' : ''
                        }`}
                        onClick={() => handleSelectRecord(record)}
                      >
                        <div className="flex-1 py-2 px-3 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {record.rule_group_title || '未命名规则组'}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            {new Date(record.created_at).toLocaleString()}
                          </div>
                          <div className="mt-1">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs rounded ${getStatusClassName(
                                record.status
                              )}`}
                            >
                              {getStatusText(record.status)}
                            </span>
                          </div>
                        </div>
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          onPress={(e: any) => handleDeleteRecord(record, e as unknown as React.MouseEvent)}
                          aria-label="delete"
                          className="text-red-600 hover:bg-red-100"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 右侧：记录详情和下载列表 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedRecord ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-[var(--muted-foreground)]">
                  请选择一条生成记录查看详情
                </span>
              </div>
            ) : (
              <>
                {/* 记录信息 */}
                <div className="p-4 border-b border-[var(--border)]">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-base font-semibold mb-1">
                        {selectedRecord.rule_group_title || '未命名规则组'}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        记录ID: {selectedRecord.record_id}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        创建时间: {new Date(selectedRecord.created_at).toLocaleString()}
                      </div>
                      {selectedRecord.draft_name && (
                        <div className="text-sm text-[var(--muted-foreground)]">
                          草稿名称: {selectedRecord.draft_name}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={handleReimport}
                    >
                      <RotateCcw size={16} />
                      重新导入
                    </Button>
                  </div>

                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded ${getStatusClassName(
                      selectedRecord.status
                    )}`}
                  >
                    {getStatusText(selectedRecord.status)}
                  </span>
                </div>

                {/* 下载管理按钮 */}
                <div className="flex-1 overflow-auto p-4">
                  <div className="text-sm font-medium mb-2">下载管理</div>
                  <div className="border-b border-[var(--border)] mb-4" />

                  <div className="flex flex-col gap-4 items-center py-8">
                    <span className="text-sm text-[var(--muted-foreground)] text-center">
                      {selectedRecord.task_id
                        ? '点击下方按钮打开下载管理器查看和管理此任务的下载文件'
                        : '此记录暂无关联的下载任务'}
                    </span>
                    {selectedRecord.task_id && (
                      <Button
                        size="lg"
                        onPress={handleOpenDownloads}
                      >
                        <Download size={18} />
                        打开下载管理器
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
