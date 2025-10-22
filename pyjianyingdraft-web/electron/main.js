const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// 开发环境配置
const isDev = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 3001;
const BACKEND_PORT = 8000;
const BACKEND_HOST = 'localhost';

let mainWindow;
let backendProcess = null;
let backendLogStream = null;

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
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // 记录输出
    backendProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`[Backend STDOUT] ${message}`);
      backendLogStream.write(`[STDOUT] ${message}`);
    });

    backendProcess.stderr.on('data', (data) => {
      const message = data.toString();
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
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png') // 如果有图标
  });

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
