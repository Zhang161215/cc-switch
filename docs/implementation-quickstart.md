# Claude Code 多 API 地址功能 - 快速实施指南

## 🚀 快速开始

### 第一步：数据结构调整（30分钟）

1. **修改 `src/types.ts`**
```typescript
// 在 ProviderMeta 接口中添加
export interface ProviderMeta {
  custom_endpoints?: Record<string, CustomEndpoint>;
  
  // 新增字段
  selected_endpoint?: string;  // 当前选中的端点
  endpoint_latencies?: Record<string, {
    latency: number;
    status: 'online' | 'offline' | 'testing';  
    lastTested: number;
  }>;
}
```

### 第二步：提取测速逻辑（1小时）

2. **创建 `src/utils/endpointUtils.ts`**
```typescript
// 从 EndpointSpeedTest 组件提取核心测速逻辑
export async function testEndpoint(url: string, timeoutMs = 5000) {
  // 复用现有测速代码
}

export async function testMultipleEndpoints(urls: string[]) {
  // 批量测速
}
```

### 第三步：UI 组件增强（2小时）

3. **修改 `src/components/ProviderList.tsx`**

添加端点状态显示：
```jsx
// 在每个 Provider 卡片中添加
<div className="endpoint-info">
  <span className="current-endpoint">
    {getCurrentEndpoint(provider)}
  </span>
  <span className={getLatencyColor(latency)}>
    {latency ? `${latency}ms` : '未测试'}
  </span>
  <button onClick={() => setExpanded(!expanded)}>
    {endpoints.length} 个端点 ▼
  </button>
</div>
```

4. **创建端点列表组件**
```jsx
// 展开显示所有端点
{expanded && (
  <EndpointList
    provider={provider}
    endpoints={getEndpoints(provider)}
    onSwitch={handleSwitchEndpoint}
    onTest={handleTestEndpoint}
  />
)}
```

### 第四步：功能实现（2小时）

5. **端点切换功能**
```typescript
async function switchEndpoint(provider: Provider, newUrl: string) {
  // 1. 更新配置中的 URL
  provider.settingsConfig.env.ANTHROPIC_BASE_URL = newUrl;
  
  // 2. 更新 meta 中的选中端点
  provider.meta.selected_endpoint = newUrl;
  
  // 3. 保存到后端
  await window.api.updateProvider(provider, appType);
  
  // 4. 提示成功
  showNotification('端点已切换', 'success');
}
```

6. **批量测速功能**
```typescript
async function testAllEndpoints(provider: Provider) {
  const urls = Object.keys(provider.meta?.custom_endpoints || {});
  const results = await testMultipleEndpoints(urls);
  
  // 更新测速结果
  provider.meta.endpoint_latencies = results;
  
  // 自动选择最快的
  const fastest = selectFastestEndpoint(results);
  if (fastest) {
    await switchEndpoint(provider, fastest);
  }
}
```

### 第五步：样式美化（30分钟）

7. **延迟颜色方案**
```typescript
function getLatencyColor(latency: number | null): string {
  if (!latency) return 'text-gray-400';
  if (latency < 100) return 'text-green-500';
  if (latency < 300) return 'text-yellow-500';
  if (latency < 1000) return 'text-orange-500';
  return 'text-red-500';
}
```

## 📋 测试清单

- [ ] 单个端点测速功能正常
- [ ] 批量测速不阻塞 UI
- [ ] 端点切换后配置正确保存
- [ ] 测速结果正确显示颜色
- [ ] 自动选择最快端点
- [ ] 端点不可用时的降级处理

## 🎯 核心功能优先级

### P0 - 必须实现（第一天）
1. ✅ 显示当前端点和延迟
2. ✅ 端点切换功能
3. ✅ 单个端点测速

### P1 - 重要功能（第二天）
4. ⏳ 批量测速
5. ⏳ 自动选择最快
6. ⏳ 端点列表展开/折叠

### P2 - 体验优化（第三天）
7. ⏳ 测速结果缓存
8. ⏳ 后台定期测速
9. ⏳ 导入/导出配置

## 💡 开发提示

1. **复用现有代码**
   - EndpointSpeedTest 组件已有完整的测速逻辑
   - 直接提取 testApiEndpoints 方法使用

2. **避免重复测试**
   - 缓存测速结果 30 分钟
   - 使用 lastTested 时间戳判断

3. **性能优化**
   - 使用 HEAD 请求而非 GET
   - 并发限制最多 5 个请求
   - 超时设置 5 秒

4. **用户体验**
   - 测速时显示 loading 动画
   - 切换端点后立即生效
   - 失败时显示友好提示

## 🐛 常见问题

**Q: 端点测速总是失败？**
A: 检查 CORS 设置，某些端点可能不支持 HEAD 请求

**Q: 切换端点后不生效？**
A: 确保更新了 settingsConfig 并调用了 updateProvider

**Q: UI 卡顿？**
A: 批量测速时使用 Promise.allSettled 避免阻塞

## 📚 相关文件

- `/src/components/ProviderForm/EndpointSpeedTest.tsx` - 现有测速组件
- `/src/types.ts` - 类型定义
- `/src/components/ProviderList.tsx` - 供应商列表
- `/src/lib/tauri-api.ts` - 后端 API 调用

## ✨ 完成标志

当以下功能都实现时，即可认为基础版本完成：

1. 用户能看到每个供应商的多个端点
2. 能测试各端点的延迟并显示
3. 能快速切换到不同端点
4. 切换后配置正确保存并生效

---

祝开发顺利！有问题随时问我喵~ 🐾
