# MHY Scanner - Electron版本

米哈游游戏扫码登录工具，基于Electron + Vue3 + Vite构建。支持从直播流中自动识别二维码并完成登录。

## 功能特性

- 🎮 **多游戏支持**: 支持崩坏3、原神、星穹铁道、绝区零
- 📺 **直播流扫描**: 从B站、抖音、虎牙等平台直播间实时获取二维码
- 📱 **屏幕扫描**: 自动识别屏幕上的二维码并登录
- 👥 **多账号管理**: 支持添加、管理多个游戏账号
- ⚡ **自动登录**: 检测到二维码后自动完成登录流程
- 🔧 **FFmpeg集成**: 内置FFmpeg支持，可处理各种视频流格式
- 🎨 **现代UI**: 基于Vue3的现代化用户界面

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **桌面应用**: Electron
- **状态管理**: Pinia
- **UI组件**: 自定义组件
- **二维码识别**: jsQR, @sec-ant/zxing-wasm
- **视频处理**: FFmpeg
- **图像处理**: Sharp
- **网络请求**: Axios
- **数据存储**: electron-store

## 开发环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- FFmpeg (已内置在项目中)

## 安装和运行

### 首次设置

```bash
# 克隆项目
git clone <repository-url>
cd Scanner

# 安装依赖
npm install

# 运行设置脚本（可选）
npm run setup
```

### 开发模式

```bash
# 启动开发服务器
npm run electron:dev
```

### 构建应用

```bash
# 构建Web资源
npm run build

# 打包Electron应用
npm run electron:build

# 仅打包不发布
npm run electron:pack

# 构建分发包
npm run electron:dist
```

## 项目结构

```
Scanner/
├── electron/                 # Electron主进程代码
│   ├── main.js              # 主进程入口
│   ├── main.qr-handler.js   # 二维码处理模块
│   ├── mihoyo-api.js        # 米哈游API接口
│   ├── preload.js           # 预加载脚本
│   └── qrWorker.js          # 二维码识别Worker
├── src/                     # Vue应用源码
│   ├── components/          # Vue组件
│   │   ├── AccountPanel.vue     # 账号面板
│   │   ├── AddAccountModal.vue  # 添加账号弹窗
│   │   ├── FunctionPanel.vue    # 功能面板
│   │   ├── Header.vue           # 头部组件
│   │   ├── LoginConfirmModal.vue # 登录确认弹窗
│   │   └── QRTestModal.vue      # 二维码测试弹窗
│   ├── composables/         # 组合式函数
│   │   ├── useMihoyoLogin.js    # 米哈游登录逻辑
│   │   ├── useQRScanner.js      # 二维码扫描逻辑
│   │   └── useStreamMonitor.js  # 直播流监控逻辑
│   ├── stores/              # 状态管理
│   │   ├── account.js           # 账号状态管理
│   │   └── settings.js          # 设置状态管理
│   ├── App.vue              # 根组件
│   ├── main.js              # Vue应用入口
│   └── style.css            # 全局样式
├── ffmpeg/                  # FFmpeg工具
│   ├── bin/                 # FFmpeg可执行文件
│   └── README.md            # FFmpeg设置说明
├── scripts/                 # 脚本文件
│   └── setup.js             # 设置脚本
├── package.json             # 项目配置
├── vite.config.js           # Vite配置
└── README.md                # 项目说明
```

## 核心功能模块

### 1. 直播流监控 (useStreamMonitor)
- 支持B站、抖音、虎牙等平台
- 实时获取直播流地址
- 使用FFmpeg处理视频流
- 从视频流中识别二维码
- 支持多种视频格式和编码

### 2. 二维码扫描 (useQRScanner)
- 屏幕截图和二维码识别
- 支持多种图像格式
- 实时扫描状态管理
- 使用jsQR和ZXing进行识别

### 3. 米哈游登录 (useMihoyoLogin)
- 获取登录二维码
- 查询登录状态
- 自动完成登录流程
- 支持多游戏类型

### 4. 账号管理 (account.js)
- 多账号存储和管理
- 默认账号设置
- 账号信息持久化
- 支持添加、删除、编辑账号

### 5. 设置管理 (settings.js)
- 应用设置存储
- 自动登录配置
- 用户偏好设置

## 使用说明

### 首次使用

1. **设置FFmpeg**: 按照 `ffmpeg/README.md` 中的说明复制FFmpeg文件到项目中
2. **添加账号**: 点击"添加账号"按钮，输入UID、用户名、游戏类型等信息
3. **配置设置**: 在设置中配置自动登录等选项

### 主要功能

1. **直播流扫描**: 
   - 选择直播平台（B站、抖音、虎牙）
   - 输入直播间ID
   - 程序会从直播流中实时识别二维码
   - 检测到二维码后自动完成登录

2. **屏幕扫描**: 
   - 选择账号后点击"开始监视屏幕"
   - 程序会自动识别屏幕上的二维码
   - 支持实时扫描和手动扫描

3. **自动登录**: 
   - 检测到二维码后，程序会自动完成登录流程
   - 支持手动确认和自动确认两种模式

## 支持的直播平台

| 平台 | 直播间ID获取方式 | 支持状态 |
|------|------------------|----------|
| B站 | `https://live.bilibili.com/<RID>` | ✅ 已支持 |
| 抖音 | `https://live.douyin.com/<RID>` | ✅ 已支持 |
| 虎牙 | `https://www.huya.com/<RID>` | ✅ 已支持 |

## 支持的游戏

| 游戏 | 游戏类型代码 | 支持状态 |
|------|-------------|----------|
| 崩坏3 | bh3 | ✅ 已支持 |
| 原神 | hk4e | ✅ 已支持 |
| 星穹铁道 | hkrpg | ✅ 已支持 |
| 绝区零 | zzz | ✅ 已支持 |

## FFmpeg设置

项目内置了FFmpeg支持，请按照以下步骤设置：

1. 下载FFmpeg Windows版本
2. 将以下文件复制到 `ffmpeg/bin/` 目录：
   - `ffmpeg.exe`
   - `ffprobe.exe`
   - 所有相关的 `.dll` 文件

详细说明请参考 `ffmpeg/README.md` 文件。

## 开发计划

- [x] 完善二维码识别功能
- [x] 实现直播流API集成
- [x] 添加FFmpeg支持
- [x] 优化用户界面
- [x] 添加错误处理和日志系统
- [x] 支持多直播平台
- [ ] 添加自动更新功能
- [ ] 支持更多直播平台
- [ ] 优化视频流处理性能

## 注意事项

- 本工具仅供学习和研究使用
- 请遵守相关游戏的使用条款
- 使用过程中请确保网络连接稳定
- 建议在测试环境中先验证功能
- 确保FFmpeg文件已正确放置在 `ffmpeg/bin/` 目录中
- 首次使用前请先添加游戏账号信息

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 致谢

- 原项目 [MHY_Scanner](https://github.com/Theresa-0328/MHY_Scanner)
