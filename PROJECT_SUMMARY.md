# MHY Scanner Electron 项目总结

## 项目概述

本项目是基于原MHY_Scanner C++/Qt项目重写的Electron版本，使用现代Web技术栈实现相同的功能。项目采用Vite + Electron + Vue3架构，提供了更好的开发体验和跨平台支持。

## 技术架构

### 前端技术栈
- **Vue 3**: 使用Composition API和响应式系统
- **Vite**: 快速的构建工具和开发服务器
- **原生CSS**: 自定义样式，无第三方UI框架依赖
- **ES6+**: 现代JavaScript特性

### 桌面应用
- **Electron**: 跨平台桌面应用框架
- **主进程**: 应用生命周期管理、系统API调用
- **渲染进程**: Vue应用运行环境
- **预加载脚本**: 安全的IPC通信桥梁

### 状态管理
- **组合式函数**: 使用Vue 3的Composition API
- **响应式状态**: 基于Vue的响应式系统
- **数据持久化**: 使用electron-store

## 核心功能模块

### 1. 账号管理 (Account Management)
- **文件**: `src/stores/account.js`
- **功能**: 多账号存储、选择、删除、默认设置
- **数据持久化**: 使用electron-store保存到本地

### 2. 二维码扫描 (QR Code Scanner)
- **文件**: `src/composables/useQRScanner.js`
- **功能**: 屏幕截图、二维码识别、实时扫描
- **依赖**: qrcode-reader, Jimp

### 3. 直播流监控 (Live Stream Monitor)
- **文件**: `src/composables/useStreamMonitor.js`
- **功能**: 多平台直播流获取、视频流解析、二维码识别
- **支持平台**: B站、抖音、虎牙

### 4. 米哈游登录 (Mihoyo Login)
- **文件**: `src/composables/useMihoyoLogin.js`
- **功能**: 获取登录二维码、状态查询、自动登录
- **支持游戏**: 崩坏3、原神、星穹铁道、绝区零

### 5. 用户界面组件
- **Header**: 应用标题和主要操作按钮
- **AccountPanel**: 账号列表和管理功能
- **FunctionPanel**: 扫描功能和设置选项
- **AddAccountModal**: 添加账号的模态框

## 项目结构

```
mhy-scanner-electron/
├── electron/                 # Electron主进程
│   ├── main.js              # 主进程入口
│   └── preload.js           # 预加载脚本
├── src/                     # Vue应用源码
│   ├── components/          # Vue组件
│   │   ├── Header.vue
│   │   ├── AccountPanel.vue
│   │   ├── FunctionPanel.vue
│   │   └── AddAccountModal.vue
│   ├── composables/         # 组合式函数
│   │   ├── useQRScanner.js
│   │   ├── useStreamMonitor.js
│   │   └── useMihoyoLogin.js
│   ├── stores/              # 状态管理
│   │   ├── account.js
│   │   └── settings.js
│   ├── data/                # 演示数据
│   ├── App.vue              # 根组件
│   ├── main.js              # Vue应用入口
│   └── style.css            # 全局样式
├── scripts/                 # 构建脚本
├── assets/                  # 静态资源
├── package.json             # 项目配置
├── vite.config.js           # Vite配置
└── README.md                # 项目说明
```

## 开发工作流

### 开发模式
```bash
npm run electron:dev
```
- 启动Vite开发服务器 (端口5173)
- 启动Electron应用
- 支持热重载和实时调试

### 构建发布
```bash
npm run electron:build
```
- 构建Vue应用
- 打包Electron应用
- 生成可执行文件

## 与原项目的对比

| 特性 | 原项目 (C++/Qt) | 新项目 (Electron/Vue3) |
|------|------------------|------------------------|
| 开发语言 | C++ | JavaScript/TypeScript |
| UI框架 | Qt | Vue 3 |
| 跨平台 | 需要编译 | 一次构建，多平台运行 |
| 开发效率 | 较低 | 较高 |
| 包大小 | 较小 | 较大 |
| 性能 | 较高 | 中等 |
| 维护性 | 中等 | 较高 |
| 社区支持 | 中等 | 较高 |

## 实现的功能

### ✅ 已完成
- [x] 项目基础架构搭建
- [x] Vue 3组件开发
- [x] Electron主进程配置
- [x] 状态管理系统
- [x] 用户界面设计
- [x] 账号管理功能
- [x] 设置管理功能
- [x] 基础二维码扫描框架
- [x] 直播流监控框架
- [x] 米哈游登录API集成

### 🚧 待完善
- [ ] 真实的屏幕截图功能
- [ ] 完整的二维码识别实现
- [ ] 直播流API的具体实现
- [ ] 错误处理和日志系统
- [ ] 自动更新功能
- [ ] 更多直播平台支持

## 技术亮点

1. **现代化架构**: 使用Vue 3 Composition API和Vite构建工具
2. **类型安全**: 准备支持TypeScript迁移
3. **响应式设计**: 适配不同屏幕尺寸
4. **模块化设计**: 清晰的代码组织和职责分离
5. **开发体验**: 热重载、调试工具、错误提示
6. **跨平台**: 一次开发，多平台运行

## 部署说明

### 开发环境
1. 安装Node.js 16+
2. 运行 `npm run setup`
3. 运行 `npm run electron:dev`

### 生产环境
1. 运行 `npm run electron:build`
2. 在 `dist-electron/` 目录找到可执行文件
3. 分发到目标平台

## 后续计划

1. **功能完善**: 实现完整的二维码识别和登录流程
2. **性能优化**: 优化内存使用和响应速度
3. **用户体验**: 添加更多交互反馈和错误处理
4. **平台扩展**: 支持更多直播平台和游戏
5. **自动化**: 添加CI/CD和自动更新功能

## 总结

本项目成功将原有的C++/Qt桌面应用迁移到现代Web技术栈，在保持核心功能的同时，提供了更好的开发体验和跨平台支持。项目采用模块化设计，代码结构清晰，易于维护和扩展。虽然在某些性能方面可能不如原生应用，但在开发效率和跨平台兼容性方面具有明显优势。
