'use client';

import React from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import type { TestDataset } from '@/types/rule';

interface DatasetSelectorProps {
  datasets: TestDataset[];
  selectedDatasetId: string;
  onLoad: (datasetId: string) => void;
  onDelete: (datasetId: string) => void;
}

/** 数据集下拉选择器 + 删除当前数据集按钮（无数据集时不渲染） */
export default function DatasetSelector({
  datasets,
  selectedDatasetId,
  onLoad,
  onDelete,
}: DatasetSelectorProps) {
  if (datasets.length === 0) return null;

  return (
    <div className="p-4 pb-0 flex gap-2 items-center border-b border-[var(--border)]">
      <select
        value={selectedDatasetId}
        onChange={(e) => onLoad(e.target.value)}
        className="min-w-[200px] flex-1 px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        <option value="">无</option>
        {datasets.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.name}{dataset.description ? ` - ${dataset.description}` : ''}
          </option>
        ))}
      </select>
      {selectedDatasetId && (
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="text-red-600"
            onPress={() => onDelete(selectedDatasetId)}
          >
            <Trash2 size={18} />
          </Button>
          <Tooltip.Content>删除当前数据集</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
