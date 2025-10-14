# 修复 GitHub Secrets 配置

## 问题诊断
你的私钥文件是 base64 编码的，但 GitHub Actions 需要原始格式。

## 解决方案

### 步骤 1: 更新 TAURI_PRIVATE_KEY

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中：

1. 点击 `TAURI_PRIVATE_KEY` 旁边的编辑按钮
2. 将 Secret 值替换为以下内容（完整复制，包括两行）：

```
untrusted comment: rsign encrypted secret key
RWRTY0IyBpXTwd2Ycoma1WQdA3d8dg9KpU8OLE5FVJokOTxeM1EAABAAAAAAAAAAAAIAAAAA/s3z9LlO81247mK2z59EJQcIn//RfFty/rDtoo/gRlB2pDNDZ9K9rhhbl6DQyOQ1IEtTqeNZsFBHcWGQkdignhreiNQoOO9DTbuzJSi/uol7/sY+fT3cHMpmRw9DQtJKZsTFCMC5aII=
```

### 步骤 2: 确认 TAURI_KEY_PASSWORD

确保 `TAURI_KEY_PASSWORD` 包含你生成密钥时设置的密码。

### 步骤 3: 验证环境变量名称

工作流文件已更新为使用正确的环境变量名：
- `TAURI_SIGNING_PRIVATE_KEY` (而不是 TAURI_PRIVATE_KEY)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (而不是 TAURI_KEY_PASSWORD)

## 验证方法

更新 Secrets 后，重新运行 GitHub Actions 工作流，应该能成功签名并构建应用。

## 注意事项

1. **不要**使用 base64 编码的版本
2. **确保**包含 "untrusted comment" 那一行
3. **确保**密钥是两行（注释行 + 密钥行）
4. **确保**密码正确（如果设置了的话）
