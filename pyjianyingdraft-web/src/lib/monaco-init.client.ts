/**
 * Monaco Editor 客户端初始化
 * 必须通过动态 import() 调用，不能直接 import
 */

import { loader } from '@monaco-editor/react';

let configPromise: Promise<void> | null = null;

/**
 * 配置 Monaco Editor 使用本地包
 * 返回 Promise 以支持 await
 */
export async function configureMonaco(): Promise<void> {
  // 避免重复配置
  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    console.log('%c[Monaco] 🚀 开始配置本地包', 'color: #2196F3; font-weight: bold');

    // 动态导入 monaco-editor
    const monaco = await import('monaco-editor');

    // 配置 loader 使用本地 monaco 实例
    loader.config({ monaco });

    console.log('[Monaco] Monaco 版本:', monaco.editor?.VERSION || 'unknown');
    console.log('[Monaco] 加载方式: Webpack 本地打包 (非 CDN)');
    console.log('%c[Monaco] ✅ 配置完成', 'color: #4CAF50; font-weight: bold');
  })();

  return configPromise;
}
