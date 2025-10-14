# GitHub Actions 构建 Windows 版本指南

由于权限限制，无法直接推送GitHub Actions工作流文件。请按以下步骤手动创建：

## 快速开始（最简单方法）

### 1. 访问你的仓库
https://github.com/Zhang161215/cc-switch

### 2. 创建工作流文件
1. 点击 **Add file** → **Create new file**
2. 文件名输入：`.github/workflows/build.yml`
3. 复制下面的内容粘贴进去：

```yaml
name: Build CCD-Switch

on:
  workflow_dispatch:
  push:
    branches: [ main ]
    paths-ignore:
      - '**.md'
      - 'LICENSE'
      - '.github/**'
      - '!.github/workflows/build.yml'

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: dtolnay/rust-toolchain@stable
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        env:
          TAURI_SIGNING_PRIVATE_KEY: ""
        run: pnpm tauri build
      
      - name: Upload exe
        uses: actions/upload-artifact@v4
        with:
          name: ccd-switch-windows-exe
          path: src-tauri/target/release/*.exe
          
      - name: Upload MSI
        uses: actions/upload-artifact@v4
        with:
          name: ccd-switch-windows-msi
          path: src-tauri/target/release/bundle/msi/*.msi
```

### 3. 提交文件
点击页面底部的 **Commit new file** 按钮

### 4. 触发构建
- 方式1：自动触发 - 推送代码到main分支会自动构建
- 方式2：手动触发 - 在Actions页面点击 **Run workflow**

### 5. 下载文件
构建完成后（约10分钟），在Actions页面下载：
- `ccd-switch-windows-exe` - 独立exe文件
- `ccd-switch-windows-msi` - Windows安装包

## 备用方案（如果上面失败）

使用最简化版本：

```yaml
name: Build Windows Simple

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install -g pnpm
      - run: pnpm install
      - uses: dtolnay/rust-toolchain@stable  
      - run: pnpm tauri build --debug
        env:
          TAURI_SIGNING_PRIVATE_KEY: ""
      - uses: actions/upload-artifact@v4
        with:
          name: windows-exe
          path: src-tauri/target/**/*.exe
```

## 故障排除

如果构建失败，请检查：
1. Actions日志中的具体错误信息
2. 确保代码已经推送到GitHub
3. 检查pnpm-lock.yaml文件是否存在

## 生成的文件

- **cc-switch.exe** - 约30MB，独立可执行文件
- **CC Switch_3.5.1_x64.msi** - 约30MB，Windows安装包

选择exe文件可以直接运行，选择msi可以安装到系统。
