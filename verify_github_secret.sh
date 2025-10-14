#!/bin/bash

echo "=== GitHub Secrets 配置验证 ==="
echo ""

# 读取私钥文件
PRIVATE_KEY_FILE="$HOME/.tauri/cc-switch.key"

if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "❌ 错误: 私钥文件不存在: $PRIVATE_KEY_FILE"
    exit 1
fi

# 读取文件内容
FILE_CONTENT=$(cat "$PRIVATE_KEY_FILE")

# 检查是否是base64编码
if echo "$FILE_CONTENT" | head -n 1 | grep -q "^dW50cnVzdGVkIGNvbW1lbnQ6"; then
    echo "📦 检测到: 私钥文件是base64编码的"
    echo ""
    echo "正在解码..."
    DECODED_CONTENT=$(echo "$FILE_CONTENT" | base64 -d)
    echo ""
    echo "✅ 解码成功！"
    echo ""
    echo "========================================="
    echo "请将以下内容（两行）复制到 GitHub Secrets 的 TAURI_PRIVATE_KEY："
    echo "========================================="
    echo "$DECODED_CONTENT"
    echo "========================================="
    echo ""
    echo "重要提示："
    echo "1. 必须包含两行内容"
    echo "2. 第一行: untrusted comment: rsign encrypted secret key"
    echo "3. 第二行: RWRTY0IyBpXTwd2Y... (密钥内容)"
    echo "4. 不要添加额外的空行或空格"
else
    echo "✅ 私钥文件已经是正确格式"
    echo ""
    echo "========================================="
    echo "请将以下内容复制到 GitHub Secrets 的 TAURI_PRIVATE_KEY："
    echo "========================================="
    echo "$FILE_CONTENT"
    echo "========================================="
fi

echo ""
echo "📝 GitHub Secrets 设置步骤："
echo "1. 访问: https://github.com/你的用户名/cc-switch/settings/secrets/actions"
echo "2. 编辑 TAURI_PRIVATE_KEY"
echo "3. 粘贴上面框内的全部内容（确保是两行）"
echo "4. 保存更改"
echo ""
echo "⚠️  常见错误："
echo "- 只复制了密钥行，没有包含注释行"
echo "- 在内容前后添加了额外的空行"
echo "- 复制时丢失了换行符，变成了一行"
