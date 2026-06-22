import { useState } from 'react';
import { Button } from '@heroui/react';
import type { TestData } from '@/types/rule';

interface TestDataDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TestData) => void;
  initialData?: TestData;
}

export default function TestDataPage({
  open,
  onClose,
  onSave,
  initialData
}: TestDataDialogProps) {
  const [data, setData] = useState<TestData>(initialData || { tracks: [], items: [] });

  const handleSave = () => {
    onSave(data);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[var(--background)] border border-[var(--border)] rounded-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
          测试数据编辑
        </div>
        <div className="p-4">
          <textarea
            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono"
            rows={12}
            value={JSON.stringify(data, null, 2)}
            onChange={(e) => {
              try {
                setData(JSON.parse(e.target.value));
              } catch (error) {
                console.error('JSON解析错误', error);
              }
            }}
          />
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>取消</Button>
          <Button variant="primary" onPress={handleSave}>保存</Button>
        </div>
      </div>
    </div>
  );
}
