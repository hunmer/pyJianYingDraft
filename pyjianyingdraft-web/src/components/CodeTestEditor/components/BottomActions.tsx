'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { Play, Send } from 'lucide-react';

interface BottomActionsProps {
  executing: boolean;
  onExecute: () => void;
  canSend: boolean;
  onSendTest: () => void;
}

/**
 * 底部执行/发送按钮
 */
export default function BottomActions({
  executing,
  onExecute,
  canSend,
  onSendTest,
}: BottomActionsProps) {
  return (
    <div className="p-4 border-t border-[var(--border)]">
      <div className="flex gap-4">
        <Button
          onPress={onExecute}
          variant="primary"
          isDisabled={executing}
          fullWidth
          size="lg"
        >
          <Play size={18} />
          {executing ? '执行中...' : '执行代码'}
        </Button>
        <Button
          onPress={onSendTest}
          variant="outline"
          isDisabled={!canSend}
          size="lg"
          className="min-w-[120px]"
        >
          <Send size={18} />
          发送测试
        </Button>
      </div>
    </div>
  );
}
