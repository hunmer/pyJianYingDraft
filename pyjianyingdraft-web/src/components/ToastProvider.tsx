'use client';

import { Toast } from '@heroui/react';

/**
 * 全局 Toast 容器。
 * 必须放在 client 组件里——@heroui/react 的 Toast 依赖 client-only，
 * 不能从根 layout（Server Component）直接导入。
 */
export default function ToastProvider() {
  return <Toast.Provider />;
}
