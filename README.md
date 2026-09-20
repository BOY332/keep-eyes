# keep-eyes

一个基于 Electron、React 和 TypeScript 的 Windows 桌面护眼提醒软件。

keep-eyes 在后台记录用眼时间，在达到设定时间后通过桌面提醒引导用户休息。应用支持系统托盘运行、本地设置保存、休息倒计时以及多屏幕休息遮罩。

## 功能简介

- Windows 系统托盘运行，提供可识别的应用图标
- 可配置用眼间隔、休息时长、延后时长和提前提醒时间
- 提前提醒同时显示在所有已连接屏幕顶部，透明、置顶、紧凑且不抢焦点
- 提醒弹窗支持：
  - 开始休息
  - 延后提醒
  - 暂停提醒
  - 关闭当前弹窗
- 关闭提前提醒不会修改原定计划，到时间后仍会按照计划提醒
- 开始休息后默认在所有屏幕显示黑屏遮罩；也可选择锁定 Windows
- 双屏缩放不同时，遮罩会反复对准每一块屏幕，避免只盖住笔记本屏
- 屏幕重新亮起或显示器插拔不会自动结束休息倒计时
- 用户设置保存在本地，不需要登录或联网

> 注意：当前版本尚未接入会议软件、全屏演示或投屏状态自动检测。开会或演示前，建议从弹窗或系统托盘选择“暂停提醒”。

## 环境要求

- Windows 10 x64 或 Windows 11 x64
- Node.js 22.12 或更高版本
- npm

## 安装依赖

在项目根目录执行：

```powershell
npm install
```

Electron 的开发运行文件会安装到：

```text
node_modules/electron/dist/
```

如果本地已有完整的 `node_modules`，通常不需要重复安装依赖。

## 准备本地 Electron 压缩包

为了避免 `electron-builder` 在打包时从网络下载 Electron，本项目使用 `package.json` 中配置的本地压缩包：

```json
"electronDist": "./build/electron/electron-v43.4.1-win32-x64.zip"
```

打包前必须存在：

```text
build/electron/electron-v43.4.1-win32-x64.zip
```

文件名必须与当前配置匹配： Electron `43.4.1`、Windows (`win32`)、`x64`。

### Windows PowerShell 下载

请在项目根目录执行：

```powershell
$ElectronVersion = "43.4.1"
$ElectronFile = "electron-v$ElectronVersion-win32-x64.zip"
$ElectronDirectory = Join-Path (Get-Location) "build\electron"
$ElectronUrl = "https://github.com/electron/electron/releases/download/v$ElectronVersion/$ElectronFile"

New-Item -ItemType Directory -Force $ElectronDirectory | Out-Null
Invoke-WebRequest `
  -Uri $ElectronUrl `
  -OutFile (Join-Path $ElectronDirectory $ElectronFile)
```

如果 GitHub 下载较慢，可将 `$ElectronUrl` 改为：

```powershell
$ElectronUrl = "https://npmmirror.com/mirrors/electron/v$ElectronVersion/$ElectronFile"
Invoke-WebRequest `
  -Uri $ElectronUrl `
  -OutFile (Join-Path $ElectronDirectory $ElectronFile)
```


## 本地开发运行

```powershell
npm run dev
```

该命令会同时启动：

- Vite 渲染进程开发服务器：`http://127.0.0.1:5173`
- Electron 主进程

开发过程中修改源代码后，按照当前 Vite/Electron 配置重新加载或重启即可。

## 检查、测试和构建

```powershell
# 类型检查
npm run typecheck

# 运行测试
npm test -- --run

# 构建渲染进程和 Electron 主进程
npm run build
```

构建产物主要位于：

```text
dist/
dist-electron/
```

## 构建 Windows 安装程序

执行：

```powershell
npm run dist:win
```

该命令会依次：

1. 构建渲染进程和 Electron 主进程；
2. 使用 `electron-builder` 构建 Windows x64 NSIS 安装程序；
3. 将安装程序输出到 `release/` 目录。

成功后通常可以在以下位置找到安装包：

```text
release/keep-eyes Setup 0.1.0.exe
```

安装程序支持：

- 自定义安装路径
- 创建桌面快捷方式
- 创建开始菜单快捷方式
- Windows 标准卸载入口
- 普通卸载时保留用户设置

## 直接运行未打包版本

构建完成后，也可以直接运行解包目录中的程序：

```powershell
.\release\win-unpacked\keep-eyes.exe
```

## 项目结构

```text
src/
├─ main/       Electron 主进程、托盘、提醒调度和 Windows 集成
├─ preload/    受限的 IPC 预加载桥接
├─ renderer/   React 用户界面
└─ shared/     共享类型、设置和提醒状态机

build/
└─ electron/   用于打包的 Electron Windows 二进制压缩包

release/
└─             Windows 安装程序和解包产物
```

## 许可证

本项目使用 MIT License。



