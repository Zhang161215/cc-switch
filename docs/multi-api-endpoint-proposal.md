# Claude Code 多 API 地址管理与测速功能方案

## 一、需求背景

当前系统虽然支持多个 API Key 管理，但每个 Provider 只能配置一个 API 地址。实际使用中，用户可能有多个可用的 API 端点（官方、镜像站、代理等），需要：
1. 为每个 API Key 配置不同的 API 地址
2. 实时了解各端点的连接质量
3. 自动选择最优的 API 端点

## 二、现状分析

### 现有组件
- **MultiKeyManager**: 已实现多 Key 管理，支持轮询、优先最低/最高等切换策略
- **EndpointSpeedTest**: 已实现端点测速功能，可测试延迟并自动选择
- **DroidProvider**: 支持 api_keys 数组和 base_url 字段

### 存在问题
1. API 地址与 Provider 绑定，不能为每个 Key 单独配置
2. 测速功能独立存在，未整合到 Key 管理界面
3. 缺少基于延迟的智能切换策略

## 三、解决方案

### 3.1 数据结构增强

```typescript
// 扩展 ApiKeyInfo 类型
export interface ApiKeyInfo {
  id: string;
  key: string;
  name?: string;
  is_active: boolean;
  last_used?: number;
  
  // 新增字段
  base_url?: string;        // 该 Key 专用的 API 地址
  latency?: number;          // 最近测速延迟（ms）
  last_tested?: number;      // 最后测速时间
  status?: 'online' | 'offline' | 'testing' | 'unknown';  // 连接状态
  success_rate?: number;     // 成功率统计
  
  balance?: {
    total_allowance: number;
    total_used: number;
    remaining: number;
    used_ratio: number;
    last_checked?: number;
  };
}

// 新增切换策略
export type SwitchStrategy = 
  | 'manual'        // 手动切换
  | 'round_robin'   // 轮询使用
  | 'use_lowest'    // 优先最低余额
  | 'use_highest'   // 优先最高余额
  | 'use_fastest';  // 优先最快（新增）
```

### 3.2 UI 设计

#### 3.2.1 MultiKeyManager 增强

```jsx
// 每个 API Key 卡片显示
<div className="api-key-card">
  <div className="key-header">
    <span className="key-name">{key.name}</span>
    <span className="key-status">
      {/* 显示延迟，根据速度显示不同颜色 */}
      {key.latency ? (
        <span className={getLatencyColor(key.latency)}>
          {key.latency}ms
        </span>
      ) : (
        <span className="text-gray">未测试</span>
      )}
    </span>
  </div>
  
  <div className="key-details">
    <div className="api-url">
      {key.base_url || defaultBaseUrl}
      <button onClick={() => editApiUrl(key.id)}>编辑</button>
      <button onClick={() => testSpeed(key.id)}>测速</button>
    </div>
    
    <div className="key-balance">
      余额: {formatBalance(key.balance)}
    </div>
  </div>
</div>

// 批量操作栏
<div className="batch-actions">
  <button onClick={testAllSpeeds}>
    <Zap /> 测试所有
  </button>
  <button onClick={refreshAllBalances}>
    <RefreshCw /> 刷新余额
  </button>
</div>
```

#### 3.2.2 DroidKeyModal 增强

```jsx
// 添加/编辑 Key 时可配置 API 地址
<div className="form-group">
  <label>API 地址（可选）</label>
  <div className="api-url-input">
    <input 
      value={formData.base_url}
      onChange={(e) => handleInputChange("base_url", e.target.value)}
      placeholder="留空使用默认地址"
    />
    <button onClick={showPresetUrls}>选择预设</button>
    <button onClick={testCurrentUrl}>测试</button>
  </div>
  
  {/* 预设地址快速选择 */}
  {showPresets && (
    <div className="preset-urls">
      <div onClick={() => selectUrl("https://api.anthropic.com")}>
        官方 API
      </div>
      <div onClick={() => selectUrl("https://api.claude.ai")}>
        Claude.ai
      </div>
      <div onClick={() => selectUrl(customUrl)}>
        自定义...
      </div>
    </div>
  )}
</div>
```

### 3.3 测速功能实现

#### 3.3.1 单个测速

```typescript
async function testApiSpeed(keyId: string): Promise<number> {
  const key = apiKeys.find(k => k.id === keyId);
  if (!key) return -1;
  
  const url = key.base_url || defaultBaseUrl;
  const startTime = performance.now();
  
  try {
    // 发送测试请求（HEAD 或轻量级 API 调用）
    const response = await fetch(`${url}/v1/messages`, {
      method: 'HEAD',
      headers: {
        'x-api-key': key.key,
      },
      signal: AbortSignal.timeout(5000), // 5秒超时
    });
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    // 更新 Key 信息
    updateKeyLatency(keyId, latency, 'online');
    return latency;
    
  } catch (error) {
    updateKeyLatency(keyId, null, 'offline');
    return -1;
  }
}
```

#### 3.3.2 批量测速

```typescript
async function testAllSpeeds(): Promise<void> {
  setIsTesting(true);
  
  // 并行测试所有 API
  const testPromises = apiKeys.map(key => 
    testApiSpeed(key.id).catch(() => -1)
  );
  
  const results = await Promise.all(testPromises);
  
  // 如果开启了"优先最快"，自动切换
  if (switchStrategy === 'use_fastest') {
    const fastestIndex = findFastestValidKey(results);
    if (fastestIndex !== -1) {
      await switchToKey(fastestIndex);
    }
  }
  
  setIsTesting(false);
}
```

### 3.4 智能切换策略

```typescript
// 新增"优先最快"策略实现
function selectKeyByStrategy(strategy: SwitchStrategy): number {
  switch (strategy) {
    case 'use_fastest':
      // 选择延迟最低且有余额的 Key
      const validKeys = apiKeys.filter(k => 
        k.status === 'online' && 
        k.balance?.remaining > 0
      );
      
      if (validKeys.length === 0) return -1;
      
      validKeys.sort((a, b) => 
        (a.latency || 999999) - (b.latency || 999999)
      );
      
      return apiKeys.indexOf(validKeys[0]);
      
    case 'round_robin':
      // 轮询逻辑
      return (currentKeyIndex + 1) % apiKeys.length;
      
    // ... 其他策略
  }
}
```

### 3.5 批量添加增强

支持批量导入时指定不同的 API 地址：

```
# 格式：名称,API Key,API 地址
主力Key,fk-xxx,https://api.anthropic.com
备用Key,fk-yyy,https://api.claude.ai
代理Key,fk-zzz,https://proxy.example.com
```

## 四、实施计划

### 第一阶段（核心功能）- 3天
1. ✅ 修改 `types.ts`，扩展 `ApiKeyInfo` 数据结构
2. ✅ 更新 `MultiKeyManager` UI，显示延迟和 API 地址
3. ✅ 实现单个 Key 测速功能
4. ✅ 实现批量测速功能
5. ✅ 集成测速结果显示（颜色区分）

### 第二阶段（增强功能）- 2天
6. ✅ `DroidKeyModal` 添加 API 地址配置
7. ✅ 实现预设地址快速选择
8. ✅ 添加"优先最快"切换策略
9. ✅ 支持批量导入时配置地址
10. ✅ 测速结果持久化存储

### 第三阶段（高级功能）- 2天
11. ⏳ 后台定期测速（可配置间隔）
12. ⏳ 故障自动转移机制
13. ⏳ 性能统计面板（成功率、平均延迟等）
14. ⏳ 导出/导入配置功能

## 五、技术细节

### 5.1 测速实现
- 使用 HEAD 请求减少带宽消耗
- 并行测试提高效率
- 设置合理超时（5秒）
- 缓存测速结果，避免频繁测试

### 5.2 颜色方案
```typescript
function getLatencyColor(latency: number): string {
  if (latency < 100) return 'text-green-500';   // 优秀
  if (latency < 300) return 'text-green-400';   // 良好
  if (latency < 500) return 'text-yellow-500';  // 一般
  if (latency < 1000) return 'text-orange-500'; // 较慢
  return 'text-red-500';                         // 很慢
}
```

### 5.3 存储结构
```json
{
  "providers": [{
    "id": "xxx",
    "name": "My Provider",
    "api_keys": [
      {
        "id": "key1",
        "key": "fk-xxx",
        "name": "主力",
        "base_url": "https://api.anthropic.com",
        "latency": 45,
        "last_tested": 1709000000000,
        "status": "online",
        "balance": {...}
      }
    ],
    "current_key_index": 0,
    "switch_strategy": "use_fastest"
  }]
}
```

## 六、用户体验优化

1. **实时反馈**
   - 测速时显示 loading 动画
   - 成功/失败立即更新状态
   - 自动切换时弹出通知

2. **智能提示**
   - 延迟过高时建议切换
   - 余额不足时自动寻找替代
   - 所有 Key 失效时提醒添加

3. **性能优化**
   - 测速结果缓存 30 分钟
   - 避免重复测试相同地址
   - 后台低优先级更新

## 七、预期效果

1. **可用性提升**
   - 多地址冗余，单点故障不影响使用
   - 自动故障转移，无需手动干预

2. **性能优化**
   - 自动选择最快端点
   - 减少 API 调用延迟
   - 提升整体响应速度

3. **管理便利**
   - 直观的延迟显示
   - 批量管理和测试
   - 智能切换策略

## 八、后续扩展

1. **区域优化**：根据用户地理位置推荐最近的端点
2. **负载均衡**：根据请求量动态分配
3. **成本优化**：结合价格因素选择最经济的方案
4. **监控告警**：API 异常时及时通知

## 九、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 频繁测速导致 API 限流 | 测速失败 | 使用 HEAD 请求，设置测速间隔限制 |
| 网络波动影响测速准确性 | 选择次优端点 | 多次测速取平均值，增加历史权重 |
| 存储数据增长 | 性能下降 | 定期清理历史数据，只保留最近记录 |

## 十、总结

本方案通过扩展现有的多 Key 管理功能，添加多 API 地址配置和智能测速选择，可以显著提升系统的可用性和性能。实施分为三个阶段，优先完成核心功能，再逐步增强，确保稳定可控的迭代。
