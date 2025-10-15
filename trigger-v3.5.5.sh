#!/bin/bash

# 加载token
if [ -f .env.local ]; then
    source .env.local
else
    echo "❌ 找不到.env.local文件"
    exit 1
fi

echo "🚀 触发v3.5.5版本构建"
echo "========================"

VERSION="3.5.5"

# 首先提交工作流修复
echo "📤 提交工作流修复..."
git add .github/workflows/auto-release-workflow.yml
git commit -m "fix: 修复Windows和Linux构建产物路径问题

- 添加带架构的完整路径支持
- 添加调试信息显示所有构建文件位置
- 确保所有平台的文件都能被正确找到并上传"
git push origin main

echo ""
echo "⏳ 等待GitHub同步工作流..."
sleep 5

# 触发新版本构建
echo "📦 触发v$VERSION构建..."
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/Zhang161215/cc-switch/actions/workflows/auto-release-workflow.yml/dispatches" \
  -d "{
    \"ref\": \"main\",
    \"inputs\": {
      \"version\": \"$VERSION\"
    }
  }" 2>&1)

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" == "204" ]; then
    echo "✅ v$VERSION 构建已触发！"
    echo ""
    echo "📊 查看进度："
    echo "https://github.com/Zhang161215/cc-switch/actions"
    echo ""
    echo "这次应该能正确上传所有平台的安装包了："
    echo "- Windows: .msi 和 .exe"
    echo "- macOS: .dmg" 
    echo "- Linux: .deb 和 .AppImage"
else
    echo "❌ 触发失败 (HTTP $http_code)"
fi
