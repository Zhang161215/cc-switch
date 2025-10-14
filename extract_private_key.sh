#!/bin/bash

# 提取并格式化Tauri私钥用于GitHub Secrets

echo "=== 提取 Tauri 私钥 ==="
echo ""

PRIVATE_KEY_FILE="$HOME/.tauri/cc-switch.key"

if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "错误: 私钥文件不存在: $PRIVATE_KEY_FILE"
    exit 1
fi

# 读取整个私钥文件内容
PRIVATE_KEY_CONTENT=$(cat "$PRIVATE_KEY_FILE")

echo "私钥文件内容（用于 TAURI_PRIVATE_KEY）："
echo "========================================"
echo "$PRIVATE_KEY_CONTENT"
echo "========================================"
echo ""

echo "重要提示："
echo "1. 将上面的全部内容（包括 'untrusted comment' 行）复制到 GitHub Secrets 的 TAURI_PRIVATE_KEY"
echo "2. 确保包含了所有行，不要遗漏任何内容"
echo "3. 如果你设置了密码，请在 TAURI_KEY_PASSWORD 中输入该密码"
echo "4. 如果没有设置密码，TAURI_KEY_PASSWORD 留空即可"
echo ""

# 尝试解码base64内容以验证格式
echo "验证私钥格式..."
if echo "$PRIVATE_KEY_CONTENT" | head -n 1 | grep -q "untrusted comment"; then
    echo "✅ 私钥格式正确（未加密格式）"
elif echo "$PRIVATE_KEY_CONTENT" | base64 -d 2>/dev/null | head -n 1 | grep -q "untrusted comment"; then
    echo "⚠️  私钥是base64编码的，需要解码"
    echo ""
    echo "解码后的内容："
    echo "========================================"
    echo "$PRIVATE_KEY_CONTENT" | base64 -d
    echo "========================================"
    echo ""
    echo "请使用解码后的内容作为 TAURI_PRIVATE_KEY"
else
    echo "❌ 无法识别的私钥格式"
fi
