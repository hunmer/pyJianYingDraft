/**
 * WebSocket连接管理
 * 使用Socket.IO客户端与后端通信
 */

import { io, Socket } from 'socket.io-client';
import {
  CozeSubscribeRequest,
  CozeSubscribeResponse,
  CozeUnsubscribeRequest,
  CozePluginData,
  WorkflowMonitorData
} from '@/types/coze';

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

/**
 * Coze插件相关的WebSocket API
 */
export const socketCozeApi = {
  /**
   * 订阅Coze数据推送
   * @param request - 订阅请求参数
   * @returns Promise with subscribe response
   */
  async subscribe(request: CozeSubscribeRequest): Promise<CozeSubscribeResponse> {
    return new Promise((resolve, reject) => {
      const socket = getSocket();

      console.log('📤 发送Coze订阅请求:', request);

      // 设置超时
      const timeout = setTimeout(() => {
        socket.off('coze_subscribed');
        socket.off('coze_subscribe_error');
        reject(new Error('Coze订阅请求超时'));
      }, 10000);

      // 监听成功响应
      socket.once('coze_subscribed', (data: CozeSubscribeResponse) => {
        console.log('📥 收到Coze订阅成功响应:', data);
        clearTimeout(timeout);
        socket.off('coze_subscribe_error');
        resolve(data);
      });

      // 监听错误响应
      socket.once('coze_subscribe_error', (data: { error: string; client_id?: string }) => {
        console.error('📥 收到Coze订阅错误响应:', data);
        clearTimeout(timeout);
        socket.off('coze_subscribed');
        reject(new Error(data.error || 'Coze订阅失败'));
      });

      // 发送订阅请求
      socket.emit('subscribe_coze_data', {
        client_id: request.clientId,
        workflow_id: request.workflowId
      });
    });
  },

  /**
   * 取消订阅Coze数据推送
   * @param request - 取消订阅请求参数
   * @returns Promise with unsubscribe response
   */
  async unsubscribe(request: CozeUnsubscribeRequest): Promise<{ success: boolean; message: string; client_id: string }> {
    return new Promise((resolve, reject) => {
      const socket = getSocket();

      console.log('📤 发送Coze取消订阅请求:', request);

      // 设置超时
      const timeout = setTimeout(() => {
        socket.off('coze_unsubscribed');
        socket.off('coze_unsubscribe_error');
        reject(new Error('Coze取消订阅请求超时'));
      }, 10000);

      // 监听成功响应
      socket.once('coze_unsubscribed', (data: any) => {
        console.log('📥 收到Coze取消订阅成功响应:', data);
        clearTimeout(timeout);
        socket.off('coze_unsubscribe_error');
        resolve(data);
      });

      // 监听错误响应
      socket.once('coze_unsubscribe_error', (data: { error: string }) => {
        console.error('📥 收到Coze取消订阅错误响应:', data);
        clearTimeout(timeout);
        socket.off('coze_unsubscribed');
        reject(new Error(data.error || 'Coze取消订阅失败'));
      });

      // 发送取消订阅请求
      socket.emit('unsubscribe_coze_data', {
        client_id: request.clientId
      });
    });
  },

  /**
   * 监听Coze数据更新事件
   * @param callback - 数据更新时的回调函数
   * @returns 取消监听的函数
   */
  onDataUpdate(
    callback: (data: WorkflowMonitorData) => void
  ): () => void {
    const socket = getSocket();

    const handler = (rawData: any) => {
      console.log('🔔 收到Coze数据更新:', rawData);

      // 转换数据格式
      const monitorData: WorkflowMonitorData = {
        id: rawData.id,
        clientId: rawData.client_id,
        workflowId: rawData.workflow_id,
        workflowName: rawData.workflow_name,
        data: {
          type: rawData.data.type,
          data: rawData.data.data,
          clientId: rawData.data.clientId,
          timestamp: rawData.data.timestamp
        },
        receivedAt: rawData.received_at,
        isRead: rawData.is_read || false
      };

      callback(monitorData);
    };

    socket.on('coze_data_update', handler);

    // 返回取消监听的函数
    return () => {
      socket.off('coze_data_update', handler);
    };
  },

  /**
   * 监听Coze订阅状态变化
   * @param callback - 订阅状态变化时的回调函数
   * @returns 取消监听的函数
   */
  onSubscribeStatusChange(
    callback: (data: { success: boolean; client_id: string; message: string }) => void
  ): () => void {
    const socket = getSocket();

    const subscribeHandler = (data: any) => {
      console.log('🔔 Coze订阅状态变化:', data);
      callback(data);
    };

    const unsubscribeHandler = (data: any) => {
      console.log('🔔 Coze取消订阅状态变化:', data);
      callback(data);
    };

    socket.on('coze_subscribed', subscribeHandler);
    socket.on('coze_unsubscribed', unsubscribeHandler);

    // 返回取消监听的函数
    return () => {
      socket.off('coze_subscribed', subscribeHandler);
      socket.off('coze_unsubscribed', unsubscribeHandler);
    };
  },

  /**
   * 监听Coze订阅错误事件
   * @param callback - 错误发生时的回调函数
   * @returns 取消监听的函数
   */
  onSubscribeError(
    callback: (error: { error: string; client_id?: string }) => void
  ): () => void {
    const socket = getSocket();

    const handler = (data: any) => {
      console.error('🔔 Coze订阅错误:', data);
      callback(data);
    };

    socket.on('coze_subscribe_error', handler);
    socket.on('coze_unsubscribe_error', handler);

    // 返回取消监听的函数
    return () => {
      socket.off('coze_subscribe_error', handler);
      socket.off('coze_unsubscribe_error', handler);
    };
  },
};
