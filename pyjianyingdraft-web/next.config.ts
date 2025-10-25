import type { NextConfig } from "next";
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */

  // 启用 React DevTools 支持
  reactStrictMode: true,

  // 静态导出配置(用于 Electron 打包)
  output: 'export',

  // 禁用图片优化(静态导出不支持)
  images: {
    unoptimized: true,
  },

  // 配置静态资源路径
  trailingSlash: true,

  // 使用相对路径以支持 Electron (仅在生产环境)
  ...(isProd && { assetPrefix: './' }),

  typescript: {
    // !! 警告 !!
    // 危险地允许生产构建即使有类型错误也能成功完成
    ignoreBuildErrors: true,
  },
  eslint: {
    // 警告：这允许生产构建即使有 ESLint 错误也能成功完成
    ignoreDuringBuilds: true,
  },

  // Webpack 配置 - Monaco Editor 本地加载
  webpack: (config, { isServer }) => {
    // Monaco Editor 只在客户端使用
    if (!isServer) {
      // 配置公共路径，确保 Monaco Editor 的 worker 文件能正确加载
      config.output = config.output || {};
      config.output.publicPath = isProd ? './_next/' : '/_next/';

      config.plugins.push(
        new MonacoWebpackPlugin({
          // 指定需要的语言
          languages: ['json', 'javascript', 'typescript', 'css', 'html'],
          // 指定需要的功能
          features: [
            'bracketMatching',
            'clipboard',
            'coreCommands',
            'cursorUndo',
            'find',
            'format',
            'hover',
            'inPlaceReplace',
            'iPadShowKeyboard',
            'links',
            'suggest',
            'wordHighlighter',
            'wordOperations',
            'wordPartOperations',
          ],
          // 自定义 worker 文件名，避免与 Next.js 的路径冲突
          filename: '[name].worker.js',
        })
      );
    }

    return config;
  },
};

export default nextConfig;
