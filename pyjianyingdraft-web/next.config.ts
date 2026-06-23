import type { NextConfig } from "next";
import path from "node:path";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // 启用 React DevTools 支持
  reactStrictMode: true,

  // 禁用图片优化（静态资源友好）
  images: {
    unoptimized: true,
  },

  // 生产环境优化
  compiler: {
    removeConsole: isProd ? {
      exclude: ['error', 'warn'], // 保留错误和警告日志
    } : false,
  },

  typescript: {
    // !! 警告 !!
    // 危险地允许生产构建即使有类型错误也能成功完成
    ignoreBuildErrors: true,
  },
  eslint: {
    // 警告：这允许生产构建即使有 ESLint 错误也能成功完成
    ignoreDuringBuilds: true,
  },

  // react-dev-inspector 源码注入：dev 模式下用 webpack loader 给 JSX 元素
  // 注入 data-inspector-* 属性（turbopack 不执行 webpack loader，故 dev 用 --webpack）。
  webpack(config, { dev }) {
    if (dev) {
      config.module.rules.push({
        test: /\.[jt]sx?$/,
        include: path.join(process.cwd(), "src"),
        enforce: "pre",
        use: [
          { loader: path.join(process.cwd(), "inspect-source-loader.cjs") },
        ],
      });
    }
    return config;
  },

  async rewrites() {
    // react-dev-inspector 默认请求 /__open-stack-frame-in-editor。
    // Next.js App Router 中双下划线目录是 private folder（不生成路由），
    // 故改写到真实 route handler /api/open-in-editor。
    return [
      {
        source: '/__open-stack-frame-in-editor',
        destination: '/api/open-in-editor',
      },
    ];
  },
};

export default nextConfig;
