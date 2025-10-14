# Claude Code & Codex & Droid 供应商切换器

[![Version](https://img.shields.io/badge/version-3.5.0-blue.svg)](https://github.com/Zhang161215/cc-switch/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/Zhang161215/cc-switch/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

一个用于管理和切换 Claude Code、Codex 与 Droid 不同供应商配置的桌面应用。

> **📢 重要通知**：ccd-switch 即将进行大规模重构，请暂缓提交新的 PR，感谢理解与配合！

> v3.5.0 ：新增 **MCP 管理**、**配置导入/导出**、**端点速度测试**功能，完善国际化覆盖，新增 Longcat、kat-coder 预设，标准化发布文件命名规范。

> v3.4.0 ：新增 i18next 国际化（还有部分未完成）、对新模型（qwen-3-max, GLM-4.6, DeepSeek-V3.2-Exp）的支持、Claude 插件、单实例守护、托盘最小化及安装器优化等。

> v3.3.0 ：VS Code Codex 插件一键配置/移除（默认自动同步）、Codex 通用配置片段与自定义向导增强、WSL 环境支持、跨平台托盘与 UI 优化。（该 VS Code 写入功能已在 v3.4.x 停用）

> v3.2.0 ：全新 UI、macOS系统托盘、内置更新器、原子写入与回滚、改进暗色样式、单一事实源（SSOT）与一次性迁移/归档。

> v3.1.0 ：新增 Codex 供应商管理与一键切换，支持导入当前 Codex 配置为默认供应商，并在内部配置从 v1 → v2 迁移前自动备份（详见下文“迁移与归档”）。

> v3.0.0 重大更新：从 Electron 完全迁移到 Tauri 2.0，应用体积显著降低、启动性能大幅提升。

## 功能特性（v3.5.0）

- **MCP (Model Context Protocol) 管理**：完整的 MCP 服务器配置管理系统
  - 支持 stdio 和 http 服务器类型，并提供命令校验
  - 内置常用 MCP 服务器模板（如 mcp-fetch 等）
  - 实时启用/禁用 MCP 服务器，原子文件写入防止配置损坏
- **配置导入/导出**：备份和恢复你的供应商配置
  - 一键导出所有配置到 JSON 文件
  - 导入配置时自动验证并备份，自动轮换备份（保留最近 10 个）
  - 带有详细状态反馈的进度模态框
- **端点速度测试**：测试 API 端点响应时间
  - 测量不同供应商端点的延迟，可视化连接质量指示器
  - 帮助用户选择最快的供应商
- **国际化与语言切换**：完整的 i18next 国际化覆盖，默认显示中文，可在设置中快速切换到英文，界面文案自动实时刷新。
- **Claude 插件同步**：内置按钮可一键应用或恢复 Claude 插件配置，切换供应商后立即生效。
- **供应商预设扩展**：新增 Longcat、kat-coder 等预设，更新 GLM 供应商配置至最新模型。
- **系统托盘与窗口行为**：窗口关闭可最小化到托盘，macOS 支持托盘模式下隐藏/显示 Dock，托盘切换时同步 Claude/Codex/Droid/插件状态。
- **单实例**：保证同一时间仅运行一个实例，避免多开冲突。
- **标准化发布命名**：所有平台发布文件使用一致的版本标签命名（macOS: `.tar.gz` / `.zip`，Windows: `.msi` / `-Portable.zip`，Linux: `.AppImage` / `.deb`）。

## 界面预览

### 主界面

![主界面](screenshots/main.png)

### Droid多Key管理

![Droid多Key管理](screenshots/droid-management.png)

### 添加供应商

![添加供应商](screenshots/add.png)

## 下载安装

### 系统要求

- **Windows**: Windows 10 及以上
- **macOS**: macOS 10.15 (Catalina) 及以上
- **Linux**: Ubuntu 22.04+ / Debian 11+ / Fedora 34+ 等主流发行版

### Windows 用户

从 [Releases](../../releases) 页面下载最新版本的 `ccd-switch-v{版本号}-Windows.msi` 安装包或者 `ccd-switch-v{版本号}-Windows-Portable.zip` 绿色版。

### macOS 用户

**方式一：通过 Homebrew 安装（推荐）**

```bash
brew tap Zhang161215/ccdswitch
brew install --cask ccd-switch
```

更新：

```bash
brew upgrade --cask ccd-switch
```

**方式二：手动下载**

从 [Releases](../../releases) 页面下载 `ccd-switch-v{版本号}-macOS.zip` 解压使用。

> **注意**：由于作者没有苹果开发者账号，首次打开可能出现"未知开发者"警告，请先关闭，然后前往"系统设置" → "隐私与安全性" → 点击"仍要打开"，之后便可以正常打开

### Linux 用户

从 [Releases](../../releases) 页面下载最新版本的 `ccd-switch-v{版本号}-Linux.deb` 包或者 `ccd-switch-v{版本号}-Linux.AppImage` 安装包。

## 使用说明

1. 点击"添加供应商"添加你的 API 配置
2. 切换方式：
   - 在主界面选择供应商后点击切换
   - 或通过“系统托盘（菜单栏）”直接选择目标供应商，立即生效
3. 切换会写入对应应用的“live 配置文件”（Claude：`settings.json`；Codex：`auth.json` + `config.toml`；Droid：Factory AI 配置）
4. 重启或新开终端以确保生效
5. 若需切回官方登录，在预设中选择“官方登录”并切换即可；重启终端后按官方流程登录

### 检查更新

- 在“设置”中点击“检查更新”，若内置 Updater 配置可用将直接检测与下载；否则会回退打开 Releases 页面

### Codex 说明（SSOT）

- 配置目录：`~/.codex/`
  - live 主配置：`auth.json`（必需）、`config.toml`（可为空）
- API Key 字段：`auth.json` 中使用 `OPENAI_API_KEY`
- 切换行为（不再写“副本文件”）：
  - 供应商配置统一保存在 `~/.ccd-switch/config.json`
  - 切换时将目标供应商写回 live 文件（`auth.json` + `config.toml`）
  - 采用“原子写入 + 失败回滚”，避免半写状态；`config.toml` 可为空
- 导入默认：当该应用无任何供应商时，从现有 live 主配置创建一条默认项并设为当前
- 官方登录：可切换到预设“Codex 官方登录”，重启终端后按官方流程登录

### Claude Code 说明（SSOT）

- 配置目录：`~/.claude/`
  - live 主配置：`settings.json`（优先）或历史兼容 `claude.json`
- API Key 字段：`env.ANTHROPIC_AUTH_TOKEN`
- 切换行为（不再写“副本文件”）：
  - 供应商配置统一保存在 `~/.ccd-switch/config.json`
  - 切换时将目标供应商 JSON 直接写入 live 文件（优先 `settings.json`）
  - 编辑当前供应商时，先写 live 成功，再更新应用主配置，保证一致性
- 导入默认：当该应用无任何供应商时，从现有 live 主配置创建一条默认项并设为当前
- 官方登录：可切换到预设“Claude 官方登录”，重启终端后可使用 `/login` 完成登录

### Droid 说明

- **多 API Key 管理**：支持同时管理多个 Factory AI API Key
  - 汇总显示所有 Key 的总额度、剩余额度和使用率
  - 支持为每个 Key 设置名称标识
- **自动切换策略**：
  - **手动**：用户手动选择使用哪个 Key
  - **轮询**：按顺序循环使用每个 Key
  - **优先最低**：优先使用余额最少的 Key（节省高额度 Key）
  - **优先最高**：优先使用余额最多的 Key（充分利用高额度 Key）
- **Factory 配置集成**：
  - 直接管理 Factory AI 的 config.json 文件
  - 支持查看、编辑和删除 Factory 自定义模型
- **预设配置**：内置 Droid Official (Sonnet 4.5) 和 Droid Official (Opus 4.1) 预设

### 迁移与归档（自 v3.2.0 起）

- 一次性迁移：首次启动 3.2.0 及以上版本会扫描旧的“副本文件”并合并到 `~/.ccd-switch/config.json`
  - Claude：`~/.claude/settings-*.json`（排除 `settings.json` / 历史 `claude.json`）
  - Codex：`~/.codex/auth-*.json` 与 `config-*.toml`（按名称成对合并）
- 去重与当前项：按“名称（忽略大小写）+ API Key”去重；若当前为空，将 live 合并项设为当前
- 归档与清理：
  - 归档目录：`~/.ccd-switch/archive/<timestamp>/<category>/...`
  - 归档成功后删除原副本；失败则保留原文件（保守策略）
- v1 → v2 结构升级：会额外生成 `~/.ccd-switch/config.v1.backup.<timestamp>.json` 以便回滚
- 注意：迁移后不再持续归档日常切换/编辑操作，如需长期审计请自备备份方案

## 开发

### 环境要求

- Node.js 18+
- pnpm 8+
- Rust 1.75+
- Tauri CLI 2.0+

### 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 类型检查
pnpm typecheck

# 代码格式化
pnpm format

# 检查代码格式
pnpm format:check

# 构建应用
pnpm build

# 构建调试版本
pnpm tauri build --debug
```

### Rust 后端开发

```bash
cd src-tauri

# 格式化 Rust 代码
cargo fmt

# 运行 clippy 检查
cargo clippy

# 运行测试
cargo test
```

## 技术栈

- **[Tauri 2](https://tauri.app/)** - 跨平台桌面应用框架（集成 updater/process/opener/log/tray-icon）
- **[React 18](https://react.dev/)** - 用户界面库
- **[TypeScript](https://www.typescriptlang.org/)** - 类型安全的 JavaScript
- **[Vite](https://vitejs.dev/)** - 极速的前端构建工具
- **[Rust](https://www.rust-lang.org/)** - 系统级编程语言（后端）

## 项目结构

```
├── src/                   # 前端代码 (React + TypeScript)
│   ├── components/       # React 组件
│   ├── config/          # 预设供应商配置
│   ├── lib/             # Tauri API 封装
│   └── utils/           # 工具函数
├── src-tauri/            # 后端代码 (Rust)
│   ├── src/             # Rust 源代码
│   │   ├── commands.rs  # Tauri 命令定义
│   │   ├── config.rs    # 配置文件管理
│   │   ├── provider.rs  # 供应商管理逻辑
│   │   └── store.rs     # 状态管理
│   ├── capabilities/    # 权限配置
│   └── icons/           # 应用图标资源
└── screenshots/          # 界面截图
```

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新详情。

## Electron 旧版

[Releases](../../releases) 里保留 v2.0.3 Electron 旧版

如果需要旧版 Electron 代码，可以拉取 electron-legacy 分支

## 贡献

欢迎提交 Issue 反馈问题和建议！

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Zhang161215/cc-switch&type=Date)](https://www.star-history.com/#Zhang161215/cc-switch&Date)

## License

MIT © Jason Young
