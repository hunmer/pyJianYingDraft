/**
 * Monaco Editor 配置
 * 使用 npm 包本地加载（通过 webpack 插件）
 */

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// 标记是否已初始化
let initialized = false;

/**
 * 初始化 Monaco Editor 配置
 * 在应用启动时调用此函数
 */
export function initMonacoConfig() {
  // 只在客户端环境执行
  if (typeof window === 'undefined') {
    console.log('[Monaco] 服务端环境,跳过配置');
    return;
  }

  // 避免重复初始化
  if (initialized) {
    console.log('[Monaco] 已经初始化,跳过');
    return;
  }

  // 配置 @monaco-editor/react 使用本地的 monaco-editor 包
  // 这样就不会从 CDN 加载
  loader.config({ monaco });

  console.log('[Monaco] 配置完成,使用本地 npm 包加载模式');

  initialized = true;
}

