# 修复 GitHub Actions 签名错误

## 问题原因
错误信息 "Missing comment in secret key" 表明 GitHub Secrets 中的私钥格式不正确。

## 正确的私钥内容

**请将以下完整内容（包括两行）复制到 GitHub Secrets 的 `TAURI_PRIVATE_KEY`：**

```
untrusted comment: rsign encrypted secret key
RWRTY0IyBpXTwd2Ycoma1WQdA3d8dg9KpU8OLE5FVJokOTxeM1EAABAAAAAAAAAAAAIAAAAA/s3z9LlO81247mK2z59EJQcIn//RfFty/rDtoo/gRlB2pDNDZ9K9rhhbl6DQyOQ1IEtTqeNZsFBHcWGQkdignhreiNQoOO9DTbuzJSi/uol7/sY+fT3cHMpmRw9DQtJKZsTFCMC5aII=
```

## 设置步骤

1. **访问 GitHub Secrets 页面**
   - URL: `https://github.com/你的用户名/cc-switch/settings/secrets/actions`

2. **编辑 TAURI_PRIVATE_KEY**
   - 点击 `TAURI_PRIVATE_KEY` 旁边的编辑按钮（铅笔图标）

3. **粘贴正确的内容**
   - 删除原有内容
   - 粘贴上面的两行内容（注意保持换行）
   - 确保没有额外的空行或空格

4. **保存更改**
   - 点击 "Update secret" 按钮

## 验证格式

正确的格式应该是：
- **第1行**：`untrusted comment: rsign encrypted secret key`
- **第2行**：`RWRTY0IyBpXTwd2Y...`（长密钥字符串）

## 常见错误

❌ **错误1**：只有密钥行，缺少注释行
```
RWRTY0IyBpXTwd2Y...
```

❌ **错误2**：base64编码的内容（单行）
```
dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5Cl...
```

❌ **错误3**：多余的空行
```

untrusted comment: rsign encrypted secret key
RWRTY0IyBpXTwd2Y...

```

✅ **正确**：两行，没有多余空行
```
untrusted comment: rsign encrypted secret key
RWRTY0IyBpXTwd2Y...
```

## 测试

更新后，重新运行 GitHub Actions 工作流：
1. 进入 Actions 页面
2. 选择失败的工作流
3. 点击 "Re-run all jobs"

如果设置正确，构建应该能成功签名。
