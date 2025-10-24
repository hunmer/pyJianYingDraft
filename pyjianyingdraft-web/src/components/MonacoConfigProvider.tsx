'use client';

import { useEffect } from 'react';
import { initMonacoConfig } from '@/lib/monaco-config';

/**
 * Monaco Editor 配置提供者
 * 在应用启动时初始化 Monaco Editor 配置
 */
export function MonacoConfigProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 初始化 Monaco Editor 配置
    console.log('[MonacoConfigProvider] 开始初始化配置');
    initMonacoConfig();
  }, []);

  return <>{children}</>;
}

