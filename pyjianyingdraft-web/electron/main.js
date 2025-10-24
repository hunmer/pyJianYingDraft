const { app, BrowserWindow, ipcMain, shell, clipboard, dialog, protocol, net } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const { pathToFileURL } = require('url');

// 开发环境配置
const isDev = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 3000;
const BACKEND_PORT = 8000;
const BACKEND_HOST = 'localhost';

let mainWindow;
let backendProcess = null;
let backendLogStream = null;

// ==================== Monaco Editor 本地加载配置 ====================

/**
 * 注册自定义协议以支持 Monaco Editor 本地加载
 * 必须在 app.whenReady() 之前调用
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-asset',
    privileges: {
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

/**
 * 处理 app-asset:// 协议请求
 * 用于从 node_modules 或 public 目录加载资源
 */
function handleAssetProtocol(request) {
  const url = new URL(request.url);
  let filePath;

  // 解析路径
  if (url.pathname.startsWith('/monaco-editor/')) {
    // Monaco Editor 文件:从 node_modules 加载
    const relativePath = url.pathname.replace('/monaco-editor/', 'monaco-editor/');
    try {
      filePath = require.resolve(relativePath);
    } catch (error) {
      console.error('[Monaco] 无法解析文件:', relativePath, error);
      return new Response('File not found', { status: 404 });
    }
  } else {
    // 其他资源:从 public 目录加载
    const relativePath = url.pathname.replace(/^\//, '');
    filePath = path.join(app.getAppPath(), 'out', relativePath);
  }

  // 转换为 file:// URL 并使用 net.fetch 加载
  const fileUrl = pathToFileURL(filePath).toString();
  return net.fetch(fileUrl, { bypassCustomProtocolHandlers: true });
}

/**
 * 检查后端服务是否运行
 */
function checkBackendService() {
  return new Promise((resolve) => {
    const options = {
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * 启动后端服务
 */
function startBackendService() {
  return new Promise((resolve, reject) => {
    console.log('[Backend] 正在启动后端服务...');

    // 确定后端可执行文件路径
    let backendExePath;

    if (isDev) {
      // 开发环境:假设后端服务已手动启动
      console.log('[Backend] 开发环境,跳过自动启动后端服务');
      resolve(false);
      return;
    } else {
      // 生产环境:使用打包的可执行文件
      if (process.platform === 'win32') {
        backendExePath = path.join(process.resourcesPath, 'pyJianYingDraftServer.exe');
      } else {
        backendExePath = path.join(process.resourcesPath, 'pyJianYingDraftServer');
      }
    }

    // 检查可执行文件是否存在
    if (!fs.existsSync(backendExePath)) {
      console.error(`[Backend] 找不到后端可执行文件: ${backendExePath}`);
      reject(new Error(`后端可执行文件不存在: ${backendExePath}`));
      return;
    }

    console.log(`[Backend] 使用后端可执行文件: ${backendExePath}`);

    // 创建日志文件
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, `backend-${Date.now()}.log`);
    backendLogStream = fs.createWriteStream(logFile, { flags: 'a' });

    console.log(`[Backend] 日志文件: ${logFile}`);

    // 启动后端进程
    backendProcess = spawn(backendExePath, [], {
      cwd: path.dirname(backendExePath),
      stdio: ['ignore', 'pipe', 'pipe'],
      // Windows下设置环境变量强制UTF-8输出
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });

    // 记录输出 - 使用UTF-8解码
    backendProcess.stdout.on('data', (data) => {
      const message = data.toString('utf8');
      console.log(`[Backend STDOUT] ${message}`);
      backendLogStream.write(`[STDOUT] ${message}`);
    });

    backendProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      console.error(`[Backend STDERR] ${message}`);
      backendLogStream.write(`[STDERR] ${message}`);
    });

    backendProcess.on('error', (error) => {
      console.error('[Backend] 启动失败:', error);
      backendLogStream.write(`[ERROR] ${error.message}\n`);
      reject(error);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`[Backend] 进程退出 - 代码: ${code}, 信号: ${signal}`);
      backendLogStream.write(`[EXIT] Code: ${code}, Signal: ${signal}\n`);
      backendProcess = null;
    });

    // 等待服务启动
    let retries = 0;
    const maxRetries = 15;
    const checkInterval = 1000;

    const checkServiceReady = setInterval(async () => {
      retries++;
      console.log(`[Backend] 检查服务状态 (${retries}/${maxRetries})...`);

      const isRunning = await checkBackendService();

      if (isRunning) {
        console.log('[Backend] 服务启动成功!');
        clearInterval(checkServiceReady);
        resolve(true);
      } else if (retries >= maxRetries) {
        console.error('[Backend] 服务启动超时');
        clearInterval(checkServiceReady);
        reject(new Error('后端服务启动超时'));
      }
    }, checkInterval);
  });
}

/**
 * 停止后端服务
 */
function stopBackendService() {
  if (backendProcess) {
    console.log('[Backend] 正在停止后端服务...');
    backendProcess.kill();
    backendProcess = null;
  }

  if (backendLogStream) {
    backendLogStream.end();
    backendLogStream = null;
  }
}

async function createWindow() {
  // 检查并启动后端服务
  try {
    const isBackendRunning = await checkBackendService();

    if (!isBackendRunning) {
      console.log('[Backend] 后端服务未运行,尝试启动...');
      await startBackendService();
    } else {
      console.log('[Backend] 后端服务已运行');
    }
  } catch (error) {
    console.error('[Backend] 后端服务启动失败:', error);
    // 继续创建窗口,但显示错误信息
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // 开发环境禁用 webSecurity 以允许跨域加载 Monaco Editor
      // 生产环境保持启用以确保安全性
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, '../public/icon.png') // 如果有图标
  });

  console.log({isDev})
  // 加载应用
  if (isDev) {
    // 开发环境:连接到 Next.js 开发服务器
    mainWindow.loadURL(`http://localhost:${PORT}`);
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境:加载构建后的静态文件
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  // 注册自定义协议处理器
  protocol.handle('app-asset', handleAssetProtocol);
  console.log('[Monaco] 已注册 app-asset:// 协议处理器');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口关闭时退出应用 (macOS 除外)
app.on('window-all-closed', () => {
  // 停止后端服务
  stopBackendService();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  stopBackendService();
});

// 安全设置:禁止导航到外部 URL
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== `http://localhost:${PORT}` && !isDev) {
      event.preventDefault();
    }
  });
});

// ==================== IPC 处理器 ====================

/**
 * 复制文本到剪贴板
 */
ipcMain.handle('fs:copy-to-clipboard', async (event, text) => {
  try {
    clipboard.writeText(text);
    console.log('[IPC] 已复制到剪贴板:', text);
    return { success: true };
  } catch (error) {
    console.error('[IPC] 复制到剪贴板失败:', error);
    throw error;
  }
});

/**
 * 使用系统默认程序打开文件
 */
ipcMain.handle('fs:open-file', async (event, filePath) => {
  try {
    console.log('[IPC] 打开文件:', filePath);
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('[IPC] 打开文件失败:', error);
    throw error;
  }
});

/**
 * 在文件管理器中显示文件
 */
ipcMain.handle('fs:show-in-folder', async (event, filePath) => {
  try {
    console.log('[IPC] 在文件夹中显示:', filePath);
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('[IPC] 在文件夹中显示失败:', error);
    throw error;
  }
});

/**
 * 打开文件夹
 */
ipcMain.handle('fs:open-folder', async (event, folderPath) => {
  try {
    console.log('[IPC] 打开文件夹:', folderPath);
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error('[IPC] 打开文件夹失败:', error);
    throw error;
  }
});

/**
 * 选择文件对话框
 */
ipcMain.handle('fs:select-file', async (event, options) => {
  try {
    console.log('[IPC] 打开文件选择对话框:', options);
    const result = await dialog.showOpenDialog(mainWindow, options);
    console.log('[IPC] 文件选择结果:', result);
    return result;
  } catch (error) {
    console.error('[IPC] 文件选择失败:', error);
    throw error;
  }
});

/**
 * 选择目录对话框
 */
ipcMain.handle('fs:select-directory', async (event, options) => {
  try {
    console.log('[IPC] 打开目录选择对话框:', options);
    const result = await dialog.showOpenDialog(mainWindow, {
      ...options,
      properties: ['openDirectory']
    });
    console.log('[IPC] 目录选择结果:', result);
    return result;
  } catch (error) {
    console.error('[IPC] 目录选择失败:', error);
    throw error;
  }
});
