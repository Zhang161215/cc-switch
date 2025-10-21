# Claude Code 模块多 API 地址管理与测速功能方案

## 一、需求分析

主人想要为 Claude Code 模块（包括 Claude 和 Codex）的供应商增加多 API 地址管理功能，并显示测速信息。

### 当前系统现状

1. **Provider 结构**：
   - 每个 Provider 只有一个 API 地址（存储在 `settingsConfig.env.ANTHROPIC_BASE_URL`）
   - 支持 `meta.custom_endpoints` 存储自定义端点列表

2. **已有组件**：
   - `EndpointSpeedTest`：端点测速组件，支持测试延迟、管理端点
   - `ProviderForm`：编辑界面集成了测速功能，但只能选择单个地址

3. **问题**：
   - 列表界面无法看到多个可用端点
   - 无法快速切换端点
   - 无法直观看到各端点的连接质量

## 二、解决方案

### 2.1 数据结构增强

```typescript
// 扩展 Provider 类型的 meta 字段
export interface ProviderMeta {
  // 自定义端点列表
  custom_endpoints?: Record<string, CustomEndpoint>;
  
  // 新增：当前选中的端点
  selected_endpoint?: string;
  
  // 新增：端点测速结果缓存
  endpoint_latencies?: Record<string, {
    latency: number;    // 延迟毫秒数
    status: 'online' | 'offline' | 'testing';
    lastTested: number; // 最后测试时间戳
  }>;
}
```

### 2.2 UI 设计方案

#### 方案 A：在列表中直接展示（推荐）

```jsx
// ProviderList 组件增强
<div className="provider-card">
  <div className="provider-header">
    <h3>{provider.name}</h3>
    {/* 在标题右侧显示当前端点状态 */}
    <span className="endpoint-status">
      {currentEndpoint} • {latency}ms
    </span>
  </div>
  
  {/* 展开显示所有可用端点 */}
  <div className="endpoints-list">
    <div className="endpoints-header">
      <span>可用端点 ({endpoints.length})</span>
      <button onClick={testAll}>
        <Zap /> 测试全部
      </button>
    </div>
    
    {endpoints.map(endpoint => (
      <div className="endpoint-item">
        <span className="endpoint-url">{endpoint.url}</span>
        <span className={getLatencyColor(endpoint.latency)}>
          {endpoint.latency}ms
        </span>
        <button onClick={() => selectEndpoint(endpoint)}>
          使用
        </button>
      </div>
    ))}
  </div>
</div>
```

#### 方案 B：弹出式端点管理器

```jsx
// 新增 EndpointQuickSwitch 组件
<button onClick={openEndpointManager} className="endpoint-switch-btn">
  <Zap /> {currentEndpoint} • {latency}ms
</button>

// 弹出的管理面板
<EndpointQuickSwitch
  provider={provider}
  endpoints={endpoints}
  currentEndpoint={currentEndpoint}
  onSelect={handleEndpointSelect}
  onTest={handleTest}
/>
```

### 2.3 测速功能集成

#### 2.3.1 复用现有测速逻辑

```typescript
// 从 EndpointSpeedTest 提取测速核心逻辑
export async function testEndpoint(url: string, apiKey?: string): Promise<{
  latency: number | null;
  status: 'online' | 'offline';
  error?: string;
}> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${url}/v1/messages`, {
      method: 'HEAD',
      headers: apiKey ? { 'x-api-key': apiKey } : {},
      signal: AbortSignal.timeout(5000),
    });
    
    const latency = Math.round(performance.now() - startTime);
    return { latency, status: 'online' };
  } catch (error) {
    return { latency: null, status: 'offline', error: String(error) };
  }
}
```

#### 2.3.2 批量测速

```typescript
export async function testAllEndpoints(
  provider: Provider,
  endpoints: string[]
): Promise<Map<string, TestResult>> {
  const results = new Map();
  
  // 并行测试所有端点
  const tests = endpoints.map(async (url) => {
    const result = await testEndpoint(url);
    results.set(url, result);
  });
  
  await Promise.all(tests);
  
  // 缓存结果到 provider.meta
  await saveEndpointLatencies(provider.id, results);
  
  return results;
}
```

### 2.4 端点管理功能

#### 2.4.1 添加端点

- 在编辑界面通过 EndpointSpeedTest 组件添加
- 支持预设端点（从 providerPresets 的 endpointCandidates 加载）
- 支持手动输入自定义端点

#### 2.4.2 切换端点

```typescript
async function switchEndpoint(
  provider: Provider, 
  newEndpoint: string
): Promise<void> {
  // 更新配置中的 API 地址
  const config = provider.settingsConfig;
  config.env.ANTHROPIC_BASE_URL = newEndpoint;
  
  // 更新 meta 中的选中端点
  provider.meta = {
    ...provider.meta,
    selected_endpoint: newEndpoint
  };
  
  // 保存并应用
  await window.api.updateProvider(provider, appType);
  
  // 显示切换成功提示
  showNotification(`已切换到 ${newEndpoint}`, 'success');
}
```

#### 2.4.3 自动选择最快端点

```typescript
function selectFastestEndpoint(
  testResults: Map<string, TestResult>
): string | null {
  let fastest: { url: string; latency: number } | null = null;
  
  for (const [url, result] of testResults) {
    if (result.status === 'online' && result.latency !== null) {
      if (!fastest || result.latency < fastest.latency) {
        fastest = { url, latency: result.latency };
      }
    }
  }
  
  return fastest?.url || null;
}
```

### 2.5 视觉设计

#### 延迟颜色方案

```typescript
function getLatencyColor(latency: number | null): string {
  if (latency === null) return 'text-gray-400';     // 未测试
  if (latency < 100) return 'text-green-500';       // 优秀
  if (latency < 300) return 'text-green-400';       // 良好  
  if (latency < 500) return 'text-yellow-500';      // 一般
  if (latency < 1000) return 'text-orange-500';     // 较慢
  return 'text-red-500';                             // 很慢
}
```

#### 状态图标

```jsx
function EndpointStatus({ status, latency }) {
  if (status === 'testing') {
    return <Loader2 className="animate-spin" size={14} />;
  }
  
  if (status === 'offline') {
    return <AlertCircle className="text-red-500" size={14} />;
  }
  
  return (
    <span className={getLatencyColor(latency)}>
      <Zap size={14} /> {latency}ms
    </span>
  );
}
```

## 三、实施计划

### 第一阶段：核心功能（2天）

1. ✅ 扩展 ProviderMeta 结构，添加端点管理字段
2. ✅ 提取测速核心逻辑到独立模块
3. ✅ 在 ProviderList 中显示当前端点和延迟
4. ✅ 实现端点快速切换功能

### 第二阶段：增强功能（2天）

5. ✅ 实现批量测速功能
6. ✅ 添加端点展开/折叠显示
7. ✅ 实现自动选择最快端点
8. ✅ 测速结果缓存和持久化

### 第三阶段：优化体验（1天）

9. ⏳ 添加端点管理快捷键
10. ⏳ 后台定期自动测速
11. ⏳ 端点健康状态监控
12. ⏳ 导入/导出端点配置

## 四、技术要点

### 4.1 性能优化

- 测速结果缓存 30 分钟，避免频繁测试
- 使用 HEAD 请求减少带宽消耗
- 并行测试提高效率
- 列表虚拟滚动（端点多时）

### 4.2 用户体验

- 实时显示测试进度
- 清晰的延迟颜色标识
- 一键批量测速
- 智能推荐最快端点

### 4.3 错误处理

- 端点不可用时自动降级
- 测速超时合理处理
- 配置更新失败回滚

## 五、示例代码

### 5.1 ProviderList 集成

```tsx
// components/ProviderList.tsx 增强
const ProviderList: React.FC<ProviderListProps> = ({ ... }) => {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set());
  
  const handleTestAllEndpoints = async (provider: Provider) => {
    setTestingProviders(prev => new Set(prev).add(provider.id));
    
    const endpoints = getProviderEndpoints(provider);
    const results = await testAllEndpoints(provider, endpoints);
    
    // 自动选择最快
    const fastest = selectFastestEndpoint(results);
    if (fastest && fastest !== getCurrentEndpoint(provider)) {
      await switchEndpoint(provider, fastest);
    }
    
    setTestingProviders(prev => {
      const next = new Set(prev);
      next.delete(provider.id);
      return next;
    });
  };
  
  return (
    <div className="provider-card">
      {/* 主要信息 */}
      <div className="provider-main">
        <h3>{provider.name}</h3>
        <EndpointStatus 
          endpoint={getCurrentEndpoint(provider)}
          latency={getEndpointLatency(provider)}
        />
      </div>
      
      {/* 端点列表（展开时显示） */}
      {expandedProviders.has(provider.id) && (
        <EndpointsList
          provider={provider}
          onSwitch={switchEndpoint}
          onTestAll={handleTestAllEndpoints}
          isTesting={testingProviders.has(provider.id)}
        />
      )}
    </div>
  );
};
```

### 5.2 快速切换组件

```tsx
// components/EndpointQuickSwitch.tsx
export const EndpointQuickSwitch: React.FC<Props> = ({
  provider,
  onClose
}) => {
  const endpoints = getProviderEndpoints(provider);
  const current = getCurrentEndpoint(provider);
  
  return (
    <div className="endpoint-switch-panel">
      <div className="panel-header">
        <h4>切换 API 端点</h4>
        <button onClick={testAll}>
          <Zap /> 测试全部
        </button>
      </div>
      
      <div className="endpoints-list">
        {endpoints.map(endpoint => (
          <div 
            key={endpoint.url}
            className={cn(
              "endpoint-item",
              endpoint.url === current && "selected"
            )}
            onClick={() => handleSwitch(endpoint.url)}
          >
            <span className="url">{endpoint.url}</span>
            <LatencyBadge latency={endpoint.latency} />
          </div>
        ))}
      </div>
      
      <div className="panel-footer">
        <button onClick={addNewEndpoint}>
          <Plus /> 添加端点
        </button>
      </div>
    </div>
  );
};
```

## 六、预期效果

1. **直观展示**：在供应商列表中直接看到各端点状态
2. **快速切换**：一键切换到最优端点
3. **智能选择**：自动推荐和切换到延迟最低的端点
4. **实时监控**：随时了解各端点健康状态

## 七、后续扩展

1. **高级策略**：
   - 根据时间段选择不同端点
   - 基于成功率的智能切换
   - 负载均衡策略

2. **监控告警**：
   - 端点异常通知
   - 性能下降预警
   - 自动故障转移

3. **数据分析**：
   - 端点性能趋势图
   - 成功率统计
   - 使用频率分析

## 八、总结

本方案通过扩展现有的 Provider 结构和复用 EndpointSpeedTest 组件的测速能力，为 Claude Code 模块添加多 API 地址管理功能。用户可以直观地看到各端点的连接质量，快速切换端点，并自动选择最优配置，显著提升使用体验。
