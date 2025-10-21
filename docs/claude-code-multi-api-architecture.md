# Claude Code 多 API 地址管理架构设计

## 系统架构图

```
┌──────────────────────────────────────────────────────────┐
│                      用户界面层                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              ProviderList (增强版)               │    │
│  │                                                  │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │         Provider Card                     │  │    │
│  │  │  ┌────────────────────────────────────┐  │  │    │
│  │  │  │ Claude Official                     │  │  │    │
│  │  │  │ api.anthropic.com • 45ms ✅         │  │  │    │
│  │  │  │ [展开端点 ▼]  [测速 ⚡]  [切换]    │  │  │    │
│  │  │  └────────────────────────────────────┘  │  │    │
│  │  │                                           │  │    │
│  │  │  ┌─── 展开的端点列表 ───────────────────┐ │  │    │
│  │  │  │ ○ api.anthropic.com      45ms  ✅  │ │  │    │
│  │  │  │ ○ api-us.anthropic.com  120ms ✅  │ │  │    │
│  │  │  │ ○ api-eu.anthropic.com  280ms ⚠️  │ │  │    │
│  │  │  │ ○ custom.proxy.com      ❌ 离线    │ │  │    │
│  │  │  └────────────────────────────────────┘  │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │         EndpointSpeedTest (复用)                │    │
│  │  • 测速核心逻辑                                  │    │
│  │  • 端点管理                                      │    │
│  │  • 结果缓存                                      │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                       数据管理层                          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Provider 数据结构:                                        │
│  {                                                        │
│    id: "provider_1",                                     │
│    name: "Claude Official",                              │
│    settingsConfig: {                                     │
│      env: {                                              │
│        ANTHROPIC_BASE_URL: "https://api.anthropic.com" ← 当前使用
│      }                                                   │
│    },                                                     │
│    meta: {                                               │
│      custom_endpoints: {                                 │
│        "https://api.anthropic.com": {                   │
│          url: "https://api.anthropic.com",              │
│          addedAt: 1709000000,                           │
│          lastUsed: 1709100000                           │
│        },                                                 │
│        "https://api-us.anthropic.com": { ... },        │
│        "https://api-eu.anthropic.com": { ... }         │
│      },                                                   │
│      selected_endpoint: "https://api.anthropic.com", ← 新增
│      endpoint_latencies: {                           ← 新增
│        "https://api.anthropic.com": {                   │
│          latency: 45,                                    │
│          status: "online",                               │
│          lastTested: 1709100000                          │
│        },                                                 │
│        ...                                               │
│      }                                                    │
│    }                                                      │
│  }                                                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                        服务层                             │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  测速服务                        端点管理服务             │
│  ┌──────────────┐              ┌──────────────┐         │
│  │ testEndpoint │              │ addEndpoint  │         │
│  │ testBatch    │              │ removeEndpoint│        │
│  │ cacheResults │              │ switchEndpoint│        │
│  └──────────────┘              └──────────────┘         │
│                                                           │
│  Tauri API 层                                             │
│  ┌────────────────────────────────────────────┐         │
│  │ • updateProvider()                          │         │
│  │ • getProviders()                            │         │
│  │ • testApiEndpoints()                        │         │
│  │ • addCustomEndpoint()                       │         │
│  └────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

## 数据流程

### 1. 测速流程

```
用户点击"测速"
      ↓
获取所有端点列表
      ↓
并行发起测速请求 ──┐
      ↓             │
┌─────────┐    ┌─────────┐    ┌─────────┐
│ 端点 1  │    │ 端点 2  │    │ 端点 3  │
│ HEAD请求│    │ HEAD请求│    │ HEAD请求│
│   45ms  │    │  120ms  │    │  超时   │
└─────────┘    └─────────┘    └─────────┘
      ↓             ↓              ↓
      └─────────────┴──────────────┘
                    ↓
            收集所有结果
                    ↓
         更新 endpoint_latencies
                    ↓
            UI 实时更新
                    ↓
      自动选择最快端点（可选）
```

### 2. 切换端点流程

```
用户选择端点
      ↓
验证端点可用性
      ↓
更新 settingsConfig.env.ANTHROPIC_BASE_URL
      ↓
更新 meta.selected_endpoint
      ↓
调用 updateProvider() 保存
      ↓
应用新配置到 Claude Code
      ↓
显示切换成功提示
```

### 3. 端点管理流程

```
添加端点:
用户输入 URL → 格式验证 → 连通性测试 → 保存到 custom_endpoints

删除端点:
选择端点 → 确认删除 → 从 custom_endpoints 移除 → 如果是当前端点则切换

批量导入:
解析预设 endpointCandidates → 合并到 custom_endpoints → 批量测速
```

## UI 组件设计

### ProviderList 增强版

```jsx
<ProviderCard>
  {/* 主区域 */}
  <div className="provider-main">
    <div className="provider-info">
      <h3>{provider.name}</h3>
      <span className="website">{provider.websiteUrl}</span>
    </div>
    
    {/* 端点状态指示器 */}
    <EndpointIndicator
      url={currentEndpoint}
      latency={latency}
      status={status}
    />
    
    {/* 操作按钮 */}
    <div className="actions">
      <button onClick={toggleExpand}>
        {expanded ? <ChevronUp /> : <ChevronDown />}
        {endpointCount} 个端点
      </button>
      <button onClick={testAll}>
        <Zap /> 测速
      </button>
      <button onClick={switchProvider}>
        启用
      </button>
    </div>
  </div>
  
  {/* 展开区域 */}
  {expanded && (
    <EndpointsList
      endpoints={endpoints}
      current={currentEndpoint}
      latencies={latencies}
      onSelect={handleSelectEndpoint}
      onTest={handleTestEndpoint}
      onAdd={handleAddEndpoint}
    />
  )}
</ProviderCard>
```

### EndpointIndicator 组件

```jsx
function EndpointIndicator({ url, latency, status }) {
  const getStatusIcon = () => {
    switch(status) {
      case 'online':
        return <CheckCircle className="text-green-500" />;
      case 'offline':
        return <XCircle className="text-red-500" />;
      case 'testing':
        return <Loader2 className="animate-spin" />;
      default:
        return <Circle className="text-gray-400" />;
    }
  };
  
  const getLatencyBadge = () => {
    if (!latency) return null;
    
    const color = getLatencyColor(latency);
    return (
      <span className={`latency-badge ${color}`}>
        {latency}ms
      </span>
    );
  };
  
  return (
    <div className="endpoint-indicator">
      {getStatusIcon()}
      <span className="url">{url}</span>
      {getLatencyBadge()}
    </div>
  );
}
```

### EndpointsList 组件

```jsx
function EndpointsList({ 
  endpoints, 
  current, 
  latencies,
  onSelect,
  onTest,
  onAdd 
}) {
  return (
    <div className="endpoints-list">
      <div className="list-header">
        <h4>可用端点</h4>
        <button onClick={onAdd} className="add-btn">
          <Plus size={14} /> 添加
        </button>
      </div>
      
      <div className="endpoints">
        {endpoints.map(endpoint => {
          const isCurrent = endpoint.url === current;
          const latency = latencies[endpoint.url];
          
          return (
            <div 
              key={endpoint.url}
              className={cn(
                "endpoint-item",
                isCurrent && "current"
              )}
            >
              <input
                type="radio"
                checked={isCurrent}
                onChange={() => onSelect(endpoint.url)}
              />
              
              <span className="url">{endpoint.url}</span>
              
              <div className="endpoint-actions">
                {latency ? (
                  <span className={getLatencyColor(latency.latency)}>
                    {latency.latency}ms
                  </span>
                ) : (
                  <button onClick={() => onTest(endpoint.url)}>
                    测试
                  </button>
                )}
                
                {!isCurrent && (
                  <button onClick={() => onSelect(endpoint.url)}>
                    使用
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {endpoints.length === 0 && (
        <div className="empty-state">
          <p>暂无配置端点</p>
          <button onClick={onAdd}>添加第一个端点</button>
        </div>
      )}
    </div>
  );
}
```

## 性能优化策略

1. **缓存机制**
   - 测速结果缓存 30 分钟
   - 使用 localStorage 持久化
   - 支持手动刷新

2. **并发控制**
   - 批量测速限制并发数（最多 5 个）
   - 使用 Promise.allSettled 处理失败
   - 超时控制（5 秒）

3. **UI 优化**
   - 虚拟滚动（端点超过 10 个时）
   - 防抖处理频繁切换
   - Loading 状态管理

## 错误处理

1. **网络错误**
   - 自动重试机制（最多 3 次）
   - 降级到备用端点
   - 友好的错误提示

2. **配置错误**
   - 配置验证
   - 回滚机制
   - 错误日志记录

3. **并发冲突**
   - 操作队列
   - 乐观锁
   - 状态同步

## 部署计划

### Phase 1: MVP (第1-2天)
- [x] 数据结构设计
- [x] 基础 UI 实现
- [x] 单个端点测速
- [x] 端点切换功能

### Phase 2: 增强功能 (第3-4天)
- [ ] 批量测速
- [ ] 自动选择最优
- [ ] 端点管理界面
- [ ] 测速结果缓存

### Phase 3: 优化体验 (第5天)
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 用户引导
- [ ] 数据统计
