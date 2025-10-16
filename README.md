# MHY Scanner - Electron版本

米哈游游戏扫码登录工具，基于Electron + Vue3 + Vite构建。

## 功能特性

- 🎮 **多游戏支持**: 支持崩坏3、原神、星穹铁道、绝区零
- 📱 **屏幕扫描**: 自动识别屏幕上的二维码并登录
- 📺 **直播流扫描**: 从B站、抖音、虎牙等平台直播间获取二维码
- 👥 **多账号管理**: 支持添加、管理多个游戏账号
- ⚡ **自动登录**: 检测到二维码后自动完成登录流程
- 🎨 **现代UI**: 基于Vue3的现代化用户界面

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **桌面应用**: Electron
- **状态管理**: Pinia (计划中)
- **UI组件**: 自定义组件
- **二维码识别**: qrcode-reader
- **图像处理**: Jimp

## 开发环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

## 安装和运行

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run electron:dev
```

### 构建应用

```bash
# 构建Web资源
npm run build

# 打包Electron应用
npm run electron:build
```

## 项目结构

```
mhy-scanner-electron/
├── electron/                 # Electron主进程代码
│   ├── main.js              # 主进程入口
│   └── preload.js           # 预加载脚本
├── src/                     # Vue应用源码
│   ├── components/          # Vue组件
│   ├── composables/         # 组合式函数
│   ├── stores/              # 状态管理
│   ├── App.vue              # 根组件
│   ├── main.js              # Vue应用入口
│   └── style.css            # 全局样式
├── assets/                  # 静态资源
├── package.json             # 项目配置
├── vite.config.js           # Vite配置
└── README.md                # 项目说明
```

## 核心功能模块

### 1. 二维码扫描 (useQRScanner)
- 屏幕截图和二维码识别
- 支持多种图像格式
- 实时扫描状态管理

### 2. 直播流监控 (useStreamMonitor)
- 支持B站、抖音、虎牙等平台
- 实时获取直播流地址
- 从视频流中识别二维码

### 3. 米哈游登录 (useMihoyoLogin)
- 获取登录二维码
- 查询登录状态
- 自动完成登录流程

### 4. 账号管理 (useAccountStore)
- 多账号存储和管理
- 默认账号设置
- 账号信息持久化

## 使用说明

1. **添加账号**: 点击"添加账号"按钮，输入UID、用户名、游戏类型等信息
2. **屏幕扫描**: 选择账号后点击"开始监视屏幕"，程序会自动识别屏幕上的二维码
3. **直播流扫描**: 选择直播平台和输入直播间ID，程序会从直播流中识别二维码
4. **自动登录**: 检测到二维码后，程序会自动完成登录流程

## 支持的直播平台

| 平台 | 直播间ID获取方式 |
|------|------------------|
| B站 | `https://live.bilibili.com/<RID>` |
| 抖音 | `https://live.douyin.com/<RID>` |
| 虎牙 | `https://www.huya.com/<RID>` |

## 开发计划

- [ ] 完善二维码识别功能
- [ ] 实现真实的屏幕截图
- [ ] 添加直播流API集成
- [ ] 优化用户界面
- [ ] 添加错误处理和日志系统
- [ ] 支持更多直播平台
- [ ] 添加自动更新功能

## 注意事项

- 本工具仅供学习和研究使用
- 请遵守相关游戏的使用条款
- 使用过程中请确保网络连接稳定
- 建议在测试环境中先验证功能

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 致谢

- 原项目 [MHY_Scanner](https://github.com/Theresa-0328/MHY_Scanner)
- Vue.js 团队
- Electron 团队
- 所有贡献者
