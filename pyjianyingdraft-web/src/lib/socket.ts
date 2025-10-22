/**
 * WebSocket连接管理
 * 使用Socket.IO客户端与后端通信
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let socket: Socket | null = null;

/**
 * 获取或创建Socket.IO连接
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket已连接');
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket已断开');
    });

    socket.on('connect_error', (error) => {
      console.error('⚠️ WebSocket连接错误:', error);
    });

    // 监听所有事件(调试用)
    socket.onAny((eventName, ...args) => {
      console.log('📨 收到WebSocket事件:', eventName, args);
    });
  }

  return socket;
}

/**
 * 断开Socket.IO连接
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * 文件版本相关的WebSocket API
 */
export const socketFileWatchApi = {
  /**
   * 获取文件版本列表
   * @param filePath - 文件路径
   * @returns Promise with versions data
   */
  async getVersions(filePath: string): Promise<{
    file_path: string;
    versions: Array<{
      version: number;
      timestamp: string;
      file_size: number;
      file_hash: string;
    }>;
  }> {
    return new Promise((resolve, reject) => {
      const socket = getSocket();

      console.log('📤 发送请求: get_file_versions', { file_path: filePath });

      // 设置超时
      const timeout = setTimeout(() => {
        socket.off('file_versions');
        socket.off('file_versions_error');
        reject(new Error('请求超时'));
      }, 10000);

      // 监听成功响应
      socket.once('file_versions', (data) => {
        console.log('📥 收到响应: file_versions', data);
        clearTimeout(timeout);
        socket.off('file_versions_error');
        resolve(data);
      });

      // 监听错误响应
      socket.once('file_versions_error', (data) => {
        console.error('📥 收到错误: file_versions_error', data);
        clearTimeout(timeout);
        socket.off('file_versions');
        reject(new Error(data.error || '获取版本列表失败'));
      });

      // 发送请求
      socket.emit('get_file_versions', { file_path: filePath });
    });
  },

  /**
   * 获取指定版本的文件内容
   * @param filePath - 文件路径
   * @param version - 版本号
   * @returns Promise with version content
   */
  async getVersionContent(
    filePath: string,
    version: number
  ): Promise<{
    file_path: string;
    version: number;
    content: string;
    timestamp: string;
    file_size: number;
  }> {
    return new Promise((resolve, reject) => {
      const socket = getSocket();

      console.log('📤 发送请求: get_version_content', { file_path: filePath, version });

      // 设置超时
      const timeout = setTimeout(() => {
        socket.off('version_content');
        socket.off('version_content_error');
        reject(new Error('请求超时'));
      }, 10000);

      // 监听成功响应
      socket.once('version_content', (data) => {
        console.log('📥 收到响应: version_content', {
          file_path: data.file_path,
          version: data.version,
          content_length: data.content?.length || 0,
          timestamp: data.timestamp,
          file_size: data.file_size
        });
        clearTimeout(timeout);
        socket.off('version_content_error');
        resolve(data);
      });

      // 监听错误响应
      socket.once('version_content_error', (data) => {
        console.error('📥 收到错误: version_content_error', data);
        clearTimeout(timeout);
        socket.off('version_content');
        reject(new Error(data.error || '获取版本内容失败'));
      });

      // 发送请求
      socket.emit('get_version_content', { file_path: filePath, version });
    });
  },

  /**
   * 监听文件变化事件
   * @param callback - 文件变化时的回调函数
   * @returns 取消监听的函数
   */
  onFileChanged(
    callback: (data: {
      file_path: string;
      version: number;
      timestamp: string;
      file_size: number;
      file_hash: string;
    }) => void
  ): () => void {
    const socket = getSocket();

    const handler = (data: any) => {
      console.log('🔔 文件变化通知:', data);
      callback(data);
    };

    socket.on('file_changed', handler);

    // 返回取消监听的函数
    return () => {
      socket.off('file_changed', handler);
    };
  },
};
