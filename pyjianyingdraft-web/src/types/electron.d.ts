/**
 * Electron API 类型定义
 * 与 electron/preload.js 中暴露的 API 保持一致
 */

interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };

  fs: {
    /**
     * 复制文本到剪贴板
     */
    copyToClipboard: (text: string) => Promise<{ success: boolean }>;

    /**
     * 使用系统默认程序打开文件
     */
    openFile: (filePath: string) => Promise<{ success: boolean }>;

    /**
     * 在文件管理器中显示文件
     */
    showInFolder: (filePath: string) => Promise<{ success: boolean }>;

    /**
     * 打开文件夹
     */
    openFolder: (folderPath: string) => Promise<{ success: boolean }>;

    /**
     * 选择文件对话框
     */
    selectFile: (options?: {
      title?: string;
      defaultPath?: string;
      buttonLabel?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: Array<
        | 'openFile'
        | 'openDirectory'
        | 'multiSelections'
        | 'showHiddenFiles'
        | 'createDirectory'
        | 'promptToCreate'
        | 'noResolveAliases'
        | 'treatPackageAsDirectory'
        | 'dontAddToRecent'
      >;
    }) => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;

    /**
     * 选择目录对话框
     */
    selectDirectory: (options?: {
      title?: string;
      defaultPath?: string;
      buttonLabel?: string;
    }) => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;

    /**
     * 检查文件是否存在
     */
    checkFileExists: (filePath: string) => Promise<boolean>;

    /**
     * 获取文件的绝对路径
     */
    getAbsolutePath: (filePath: string) => Promise<string>;

    /**
     * 启动文件拖拽（用于拖出文件到外部应用）
     */
    startDrag: (filePath: string) => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }

  interface File {
    /**
     * Electron 环境下 File 对象包含 path 属性
     */
    path?: string;
  }
}

export {};
