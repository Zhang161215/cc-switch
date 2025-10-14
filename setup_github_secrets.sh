#!/bin/bash

# 配置 GitHub Secrets 的辅助脚本
# 注意：需要先安装 GitHub CLI (gh) 并登录

echo "=== 配置 CC-Switch GitHub Secrets ==="
echo ""

# 检查 gh 是否已安装
if ! command -v gh &> /dev/null; then
    echo "错误: GitHub CLI (gh) 未安装"
    echo "请先安装: brew install gh"
    echo "然后登录: gh auth login"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo "错误: 未登录 GitHub"
    echo "请运行: gh auth login"
    exit 1
fi

# 读取私钥文件
PRIVATE_KEY_FILE="$HOME/.tauri/cc-switch.key"
if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "错误: 私钥文件不存在: $PRIVATE_KEY_FILE"
    echo "请先运行: pnpm tauri signer generate -w ~/.tauri/cc-switch.key"
    exit 1
fi

echo "找到私钥文件: $PRIVATE_KEY_FILE"
echo ""

# 提示用户输入密码
read -s -p "请输入生成密钥时设置的密码 (如果没有设置请直接回车): " KEY_PASSWORD
echo ""

# 获取私钥内容
PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE")

# 显示将要设置的内容（隐藏私钥详情）
echo "准备设置以下 Secrets:"
echo "1. TAURI_PRIVATE_KEY: [私钥内容]"
echo "2. TAURI_KEY_PASSWORD: [已输入]"
echo ""

# 确认仓库
read -p "请输入 GitHub 仓库名 (格式: owner/repo, 例如: farion1231/cc-switch): " REPO
echo ""

# 设置 Secrets
echo "正在设置 TAURI_PRIVATE_KEY..."
echo "$PRIVATE_KEY" | gh secret set TAURI_PRIVATE_KEY --repo="$REPO"

echo "正在设置 TAURI_KEY_PASSWORD..."
echo "$KEY_PASSWORD" | gh secret set TAURI_KEY_PASSWORD --repo="$REPO"

echo ""
echo "✅ GitHub Secrets 设置完成！"
echo ""
echo "验证步骤:"
echo "1. 访问: https://github.com/$REPO/settings/secrets/actions"
echo "2. 确认存在以下 Secrets:"
echo "   - TAURI_PRIVATE_KEY"
echo "   - TAURI_KEY_PASSWORD"
echo ""
echo "现在可以运行 GitHub Actions 工作流进行构建了！"
