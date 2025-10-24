import type { NextConfig } from "next";

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
};

export default nextConfig;
