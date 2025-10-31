/**
 * 本地存储管理工具
 * 用于管理应用程序的持久化状态
 */

export interface AppStorage {
  sidebar: {
    isOpen: boolean;
  };
  tabs: {
    activeTabId: string | null;
  };
  editor: {
    theme: 'light' | 'dark';
    fontSize: number;
  };
  // 可以添加更多存储项
}

const STORAGE_KEY = 'pyjianyingdraft-storage';
const DEFAULT_STORAGE: AppStorage = {
  sidebar: {
    isOpen: true,
  },
  tabs: {
    activeTabId: null,
  },
  editor: {
    theme: 'light',
    fontSize: 14,
  },
};

/**
 * 获取完整的存储数据
 * 只在客户端运行，避免服务端渲染问题
 */
export function getStorage(): AppStorage {
  // 确保在客户端环境中运行
  if (typeof window === 'undefined') {
    return DEFAULT_STORAGE;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_STORAGE;
    }
    const parsed = JSON.parse(stored);
    // 合并默认值，确保新添加的字段有默认值
    return {
      ...DEFAULT_STORAGE,
      ...parsed,
      sidebar: {
        ...DEFAULT_STORAGE.sidebar,
        ...parsed.sidebar,
      },
      tabs: {
        ...DEFAULT_STORAGE.tabs,
        ...parsed.tabs,
      },
      editor: {
        ...DEFAULT_STORAGE.editor,
        ...parsed.editor,
      },
    };
  } catch (error) {
    console.error('读取存储失败:', error);
    return DEFAULT_STORAGE;
  }
}

/**
 * 设置存储数据
 * 只在客户端运行，避免服务端渲染问题
 */
export function setStorage(storage: Partial<AppStorage>): void {
  // 确保在客户端环境中运行
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = getStorage();
    const updated = {
      ...current,
      ...storage,
      // 确保嵌套对象正确合并
      sidebar: {
        ...current.sidebar,
        ...storage.sidebar,
      },
      tabs: {
        ...current.tabs,
        ...storage.tabs,
      },
      editor: {
        ...current.editor,
        ...storage.editor,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('写入存储失败:', error);
  }
}

/**
 * 清除存储
 * 只在客户端运行，避免服务端渲染问题
 */
export function clearStorage(): void {
  // 确保在客户端环境中运行
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清除存储失败:', error);
  }
}

/**
 * 获取侧边栏状态
 */
export function getSidebarState(): { isOpen: boolean } {
  const storage = getStorage();
  return storage.sidebar;
}

/**
 * 设置侧边栏状态
 */
export function setSidebarState(isOpen: boolean): void {
  setStorage({
    sidebar: { isOpen },
  });
}

/**
 * 获取标签页状态
 */
export function getTabState(): { activeTabId: string | null } {
  const storage = getStorage();
  return storage.tabs;
}

/**
 * 设置标签页状态
 */
export function setTabState(activeTabId: string | null): void {
  setStorage({
    tabs: { activeTabId },
  });
}

/**
 * 获取编辑器状态
 */
export function getEditorState(): { theme: 'light' | 'dark'; fontSize: number } {
  const storage = getStorage();
  return storage.editor;
}

/**
 * 设置编辑器状态
 */
export function setEditorState(theme: 'light' | 'dark', fontSize: number): void {
  setStorage({
    editor: { theme, fontSize },
  });
}