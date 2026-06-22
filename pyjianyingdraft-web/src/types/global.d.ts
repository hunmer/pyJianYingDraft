/**
 * 全局类型声明
 *
 * window.electron 在纯 Web 环境下为 undefined，相关调用会自动降级（可选链短路）。
 * 保留可选类型声明以兼容既有的防御性代码（isElectron 检测等）。
 */
declare global {
  interface Window {
    electron?: {
      platform?: string;
      fs?: {
        copyToClipboard?(text: string): Promise<{ success: boolean }>;
        openFile?(filePath: string): Promise<{ success: boolean }>;
        showInFolder?(filePath: string): Promise<{ success: boolean }>;
        openFolder?(folderPath: string): Promise<{ success: boolean }>;
        selectFile?(options?: any): Promise<{ canceled: boolean; filePaths: string[] }>;
        selectDirectory?(options?: any): Promise<{ canceled: boolean; filePaths: string[] }>;
        checkFileExists?(filePath: string): Promise<boolean>;
        getAbsolutePath?(filePath: string): Promise<string>;
        startDrag?(filePath: string): Promise<{ success: boolean }>;
      };
    };
  }

  interface File {
    /** 桌面环境拖入时可能携带的本地路径 */
    path?: string;
  }
}

export {};
