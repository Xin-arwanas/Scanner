# FFmpeg 设置说明

本项目需要FFmpeg来处理直播流。请按照以下步骤设置：

## 下载FFmpeg

1. 访问 [FFmpeg官网](https://ffmpeg.org/download.html)
2. 下载Windows版本的FFmpeg（推荐使用 "release builds"）
3. 解压下载的文件

## 复制文件

将以下文件复制到 `ffmpeg/bin/` 目录中：

- `ffmpeg.exe` - 主要的FFmpeg可执行文件
- `ffprobe.exe` - FFprobe工具

## 目录结构

```
Scanner/
├── ffmpeg/
│   └── bin/
│       ├── ffmpeg.exe
│       └── ffprobe.exe
```

## 注意事项

- FFmpeg的二进制文件已被添加到 `.gitignore` 中，不会被提交到版本控制
- 项目现在使用相对路径 `./ffmpeg/bin/ffmpeg.exe` 来调用FFmpeg

## 验证安装

启动项目后，如果FFmpeg路径正确，直播流扫描功能应该能正常工作。
