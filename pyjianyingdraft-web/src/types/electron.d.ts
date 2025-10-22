/**
 * Electron API 类型声明
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
  };
}

interface Window {
  electron?: ElectronAPI;
}
