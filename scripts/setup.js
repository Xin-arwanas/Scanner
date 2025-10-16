#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 MHY Scanner Electron 项目设置开始...\n');

// 检查Node.js版本
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ 错误: 需要Node.js 16.0.0或更高版本');
  console.error(`当前版本: ${nodeVersion}`);
  process.exit(1);
}

console.log(`✅ Node.js版本检查通过: ${nodeVersion}`);

// 检查npm版本
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm版本: ${npmVersion}`);
} catch (error) {
  console.error('❌ 无法获取npm版本');
  process.exit(1);
}

// 创建必要的目录
const directories = [
  'assets',
  'dist',
  'logs'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 创建目录: ${dir}`);
  }
});

// 创建示例图标文件
const iconPath = path.join('assets', 'icon.png');
if (!fs.existsSync(iconPath)) {
  // 创建一个简单的占位图标
  const placeholderIcon = `
# 这是一个占位图标文件
# 请将您的应用图标文件放在这里
# 支持的格式: .png, .ico, .icns
# 建议尺寸: 256x256 像素
`;
  fs.writeFileSync(iconPath, placeholderIcon);
  console.log('📄 创建占位图标文件: assets/icon.png');
}

// 安装依赖
console.log('\n📦 安装依赖包...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ 依赖安装完成');
} catch (error) {
  console.error('❌ 依赖安装失败');
  process.exit(1);
}

// 创建开发环境配置
const envContent = `# 开发环境配置
NODE_ENV=development
VITE_APP_TITLE=MHY Scanner
VITE_APP_VERSION=1.0.0
`;

if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', envContent);
  console.log('📄 创建环境配置文件: .env');
}

console.log('\n🎉 项目设置完成！');
console.log('\n📋 下一步操作:');
console.log('1. 运行开发模式: npm run electron:dev');
console.log('2. 构建应用: npm run electron:build');
console.log('3. 查看README.md了解更多信息');
console.log('\n💡 提示: 请确保将您的应用图标放在assets/目录下');
