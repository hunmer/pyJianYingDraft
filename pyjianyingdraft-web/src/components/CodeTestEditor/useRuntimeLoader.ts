'use client';

import { useState, useEffect } from 'react';
import { Language } from './types';

interface UseRuntimeLoaderOptions {
  language: Language;
  setSuccess: (msg: string) => void;
  setError: (msg: string) => void;
}

/**
 * 运行时加载器：动态加载 TypeScript 编译器与 Pyodide 运行时
 * 提取自原组件的 3 个加载相关 useEffect
 */
export function useRuntimeLoader({ language, setSuccess, setError }: UseRuntimeLoaderOptions) {
  const [tsLoaded, setTsLoaded] = useState(false); // TypeScript编译器是否已加载
  const [pyodideLoaded, setPyodideLoaded] = useState(false); // Pyodide是否已加载
  const [pyodide, setPyodide] = useState<any>(null); // Pyodide实例

  // 动态加载TypeScript编译器
  useEffect(() => {
    const loadTypeScript = async () => {
      if (language === 'typescript' && !tsLoaded && (window as any).ts === undefined) {
        try {
          console.log('[CodeTestEditor] 开始加载TypeScript编译器...');
          const script = document.createElement('script');
          script.src = '/js/typescript.js';
          script.async = true;

          script.onload = () => {
            // 等待一小段时间确保编译器完全初始化
            setTimeout(() => {
              if ((window as any).ts) {
                setTsLoaded(true);
                console.log('[CodeTestEditor] TypeScript编译器已加载完成');
              } else {
                setError('TypeScript编译器初始化失败');
              }
            }, 100);
          };

          script.onerror = (error) => {
            console.error('[CodeTestEditor] TypeScript编译器加载失败:', error);
            setError('TypeScript编译器加载失败，请检查网络连接');
          };

          document.head.appendChild(script);
        } catch (err: any) {
          console.error('[CodeTestEditor] TypeScript编译器加载异常:', err);
          setError(`TypeScript编译器加载失败: ${err.message}`);
        }
      } else if (language === 'typescript' && (window as any).ts !== undefined) {
        setTsLoaded(true);
        console.log('[CodeTestEditor] TypeScript编译器已就绪');
      }
    };

    loadTypeScript();
  }, [language, tsLoaded]);

  // 动态加载Pyodide
  useEffect(() => {
    const loadPyodide = async () => {
      if (language === 'python' && !pyodideLoaded && !(window as any).loadPyodide) {
        try {
          console.log('[CodeTestEditor] 开始加载Pyodide...');
          setSuccess('正在加载Python运行环境，请稍候...');

          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
          script.async = true;

          script.onload = async () => {
            try {
              console.log('[CodeTestEditor] Pyodide脚本已加载，正在初始化...');
              const loadPyodide = (window as any).loadPyodide;
              const pyodideInstance = await loadPyodide();
              setPyodide(pyodideInstance);
              setPyodideLoaded(true);
              setSuccess('Python运行环境已就绪');
              console.log('[CodeTestEditor] Pyodide已加载完成');
              setTimeout(() => setSuccess(''), 3000);
            } catch (initErr: any) {
              console.error('[CodeTestEditor] Pyodide初始化失败:', initErr);
              setError(`Python运行环境初始化失败: ${initErr.message}`);
            }
          };

          script.onerror = (error) => {
            console.error('[CodeTestEditor] Pyodide加载失败:', error);
            setError('Python运行环境加载失败，请检查网络连接');
          };

          document.head.appendChild(script);
        } catch (err: any) {
          console.error('[CodeTestEditor] Pyodide加载异常:', err);
          setError(`Python运行环境加载失败: ${err.message}`);
        }
      } else if (language === 'python' && pyodide) {
        setPyodideLoaded(true);
        console.log('[CodeTestEditor] Pyodide已就绪');
      }
    };

    loadPyodide();
  }, [language, pyodideLoaded, pyodide]);

  // 验证编译器状态
  useEffect(() => {
    if (language === 'typescript' && tsLoaded) {
      // 定期检查编译器是否仍然可用
      const checkInterval = setInterval(() => {
        if ((window as any).ts === undefined) {
          console.warn('[CodeTestEditor] TypeScript编译器丢失，重新加载...');
          setTsLoaded(false);
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [language, tsLoaded]);

  return { tsLoaded, pyodideLoaded, pyodide };
}
