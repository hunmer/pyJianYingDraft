'use client';

import React from 'react';
import { X } from 'lucide-react';

interface MessageBannerProps {
  error: string;
  success: string;
  onClearError: () => void;
  onClearSuccess: () => void;
}

/**
 * 错误/成功消息提示条
 */
export default function MessageBanner({
  error,
  success,
  onClearError,
  onClearSuccess,
}: MessageBannerProps) {
  if (!error && !success) return null;

  return (
    <div className="px-4 py-2 flex flex-col gap-2">
      {error && (
        <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex justify-between items-start gap-2">
          <div className="whitespace-pre-wrap">{error}</div>
          <button onClick={onClearError} className="text-red-600 hover:text-red-800 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-md border border-green-300 bg-green-50 text-green-800 text-sm flex justify-between items-start gap-2">
          <div className="whitespace-pre-wrap">{success}</div>
          <button onClick={onClearSuccess} className="text-green-600 hover:text-green-800 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
