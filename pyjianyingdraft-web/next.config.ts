import type { NextConfig } from "next";

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
};

export default nextConfig;
