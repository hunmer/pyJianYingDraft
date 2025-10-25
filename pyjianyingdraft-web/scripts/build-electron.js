#!/usr/bin/env node
/**
 * Electron 打包优化脚本
 * 1. 备份 package.json
 * 2. 移除 dependencies (Electron 主进程不需要外部依赖)
 * 3. 执行 electron-builder
 * 4. 恢复 package.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');
const BACKUP_PATH = path.join(__dirname, '../package.json.backup');

console.log('🔧 开始优化 Electron 打包...\n');

try {
  // 1. 备份 package.json
  console.log('📦 备份 package.json...');
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(packageJson, null, 2));
  console.log('✓ 备份完成\n');

  // 2. 创建优化的 package.json (移除 dependencies)
  console.log('🧹 移除 dependencies...');
  const optimizedPackageJson = {
    ...packageJson,
    dependencies: {}, // Electron 主进程只使用 Node.js 内置模块,不需要外部依赖
  };
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(optimizedPackageJson, null, 2));
  console.log('✓ dependencies 已清空\n');

  // 3. 执行 electron-builder
  console.log('🚀 执行 electron-builder...\n');
  execSync('electron-builder --config electron-builder.json', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  console.log('\n✓ 打包完成\n');

} catch (error) {
  console.error('❌ 打包失败:', error.message);
  process.exitCode = 1;
} finally {
  // 4. 恢复 package.json
  if (fs.existsSync(BACKUP_PATH)) {
    console.log('🔄 恢复 package.json...');
    fs.copyFileSync(BACKUP_PATH, PACKAGE_JSON_PATH);
    fs.unlinkSync(BACKUP_PATH);
    console.log('✓ 已恢复\n');
  }
}

console.log('✅ 完成!');
