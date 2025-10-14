import React, { useState, useEffect } from "react";
import { DroidProvider } from "../types";
import { Play, Edit3, Trash2, CheckCircle2, Key, Check, RefreshCw, ChevronDown } from "lucide-react";
import { buttonStyles, cardStyles, badgeStyles, cn } from "../lib/styles";

interface DroidProviderListProps {
  providers: DroidProvider[];
  currentProviderId: string;
  onSwitch: (id: string) => void;
  onEdit: (provider: DroidProvider) => void;
  onDelete: (id: string) => void;
  onUpdate?: (provider: DroidProvider) => void;
  onNotify?: (message: string, type: "success" | "error") => void;
}

interface BalanceInfo {
  totalAllowance: number;
  totalUsed: number;
  remaining: number;
  usedRatio: number;
  loading: boolean;
  error?: string;
}

const DroidProviderList: React.FC<DroidProviderListProps> = ({
  providers,
  currentProviderId,
  onSwitch,
  onEdit,
  onDelete,
  onUpdate,
  onNotify,
}) => {
  const [balances, setBalances] = useState<Record<string, BalanceInfo>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [showModelSelect, setShowModelSelect] = useState<Record<string, boolean>>({});
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // 可选的模型列表 - 动态添加余额信息
  const getAvailableModels = (providerId: string) => {
    const balance = balances[providerId];
    const models = [
      { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
      { value: "claude-opus-4-1-20250805", label: "Opus 4.1" }
    ];
    
    // 如果有余额信息，添加到显示名称中
    if (balance && !balance.loading) {
      if (balance.remaining <= 0) {
        return models.map(model => ({
          ...model,
          displayLabel: `${model.label} [D] ⚠️ 额度耗尽`
        }));
      } else {
        const remainingM = (balance.remaining / 1000000).toFixed(1);
        // 选择红黄绿圆形图标
        let indicator = "🟢";
        if (balance.usedRatio < 0.5) {
          indicator = "🟢"; // 绿色
        } else if (balance.usedRatio < 0.8) {
          indicator = "🟡"; // 黄色
        } else {
          indicator = "🔴"; // 红色
        }
        return models.map(model => ({
          ...model,
          displayLabel: `${model.label} [D] ${indicator} ${remainingM}M`
        }));
      }
    }
    
    return models.map(model => ({ ...model, displayLabel: model.label }));
  };

  // 格式化数字显示
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // 格式化百分比
  const formatPercentage = (ratio: number): string => {
    return (ratio * 100).toFixed(2) + '%';
  };

  // 获取余额信息
  const fetchBalance = async (provider: DroidProvider, checkAutoSwitch: boolean = true) => {
    if (!provider.api_key && (!provider.api_keys || provider.api_keys.length === 0)) return;

    console.log(`Fetching balance for provider ${provider.name}...`);
    setRefreshing(prev => ({ ...prev, [provider.id]: true }));
    setBalances(prev => ({
      ...prev,
      [provider.id]: { ...prev[provider.id], loading: true }
    }));

    try {
      let totalAllowance = 0;
      let totalUsed = 0;
      let currentKeyExhausted = false;
      
      // 检查是否有多个keys
      if (provider.api_keys && provider.api_keys.length > 0) {
        console.log(`Fetching balances for ${provider.api_keys.length} keys...`);
        const apiKeys = provider.api_keys.map(k => k.key);
        const balancesData = await window.api.fetchMultipleDroidBalances(apiKeys);
        console.log('Multiple balance data received:', balancesData);
        
        // 检查当前key是否已耗尽
        const currentKeyIndex = provider.current_key_index || 0;
        if (balancesData[currentKeyIndex]) {
          const currentKeyData = balancesData[currentKeyIndex];
          if (currentKeyData?.usage?.standard) {
            const keyAllowance = currentKeyData.usage.standard.totalAllowance || 0;
            const keyUsed = currentKeyData.usage.standard.orgTotalTokensUsed || 0;
            const keyRemaining = Math.max(0, keyAllowance - keyUsed);
            
            // 如果当前key余额为0或使用率超过99%，标记为已耗尽
            if (keyRemaining === 0 || (keyAllowance > 0 && keyUsed / keyAllowance > 0.99)) {
              currentKeyExhausted = true;
              console.log(`Current key ${currentKeyIndex} is exhausted. Remaining: ${keyRemaining}, Ratio: ${keyUsed / keyAllowance}`);
            }
          }
        }
        
        // 汇总所有keys的余额
        balancesData.forEach((data, index) => {
          if (data && data !== null && data.usage && data.usage.standard) {
            totalAllowance += (data.usage.standard.totalAllowance || 0);
            totalUsed += (data.usage.standard.orgTotalTokensUsed || 0);
          }
        });
      } else {
        // 单个key的余额查询
        console.log(`Calling fetchDroidBalance with key: ${provider.api_key.slice(0,10)}...`);
        const data = await window.api.fetchDroidBalance(provider.api_key);
        console.log('Single balance data received:', data);
        
        if (data.usage && data.usage.standard) {
          totalAllowance = data.usage.standard.totalAllowance || 0;
          totalUsed = data.usage.standard.orgTotalTokensUsed || 0;
          
          // 单key模式下也检查是否耗尽
          const remaining = Math.max(0, totalAllowance - totalUsed);
          if (remaining === 0 || (totalAllowance > 0 && totalUsed / totalAllowance > 0.99)) {
            currentKeyExhausted = true;
            console.log(`Single key is exhausted. Remaining: ${remaining}`);
          }
        }
      }
      
      const remaining = Math.max(0, totalAllowance - totalUsed);
      const usedRatio = totalAllowance > 0 ? totalUsed / totalAllowance : 0;

      setBalances(prev => ({
        ...prev,
        [provider.id]: {
          totalAllowance,
          totalUsed,
          remaining,
          usedRatio,
          loading: false,
        }
      }));
      
      // 如果是当前使用的provider，更新Factory配置中的显示名称
      if (provider.id === currentProviderId) {
        const baseModelName = provider.model === "claude-opus-4-1-20250805" 
          ? "Opus 4.1" 
          : "Sonnet 4.5";
        
        let newDisplayName: string;
        if (remaining <= 0) {
          // 所有key都耗尽了，显示警告
          newDisplayName = `${baseModelName} [D] ⚠️ 额度耗尽`;
        } else {
          // 有余额，显示余额信息
          const remainingM = (remaining / 1000000).toFixed(1);
          // 根据余额比例选择红黄绿圆形图标
          let indicator = "🟢"; // 默认绿色
          if (usedRatio < 0.5) {
            indicator = "🟢"; // 绿色：充足（使用率<50%）
          } else if (usedRatio < 0.8) {
            indicator = "🟡"; // 黄色：适中（使用率50-80%）
          } else {
            indicator = "🔴"; // 红色：偏低（使用率>80%）
          }
          newDisplayName = `${baseModelName} [D] ${indicator} ${remainingM}M`;
        }
        
        // 如果显示名称发生变化，更新provider
        if (provider.model_display_name !== newDisplayName) {
          const updatedProvider: DroidProvider = {
            ...provider,
            model_display_name: newDisplayName
          };
          
          // 调用onUpdate更新，这会自动更新.factory/config.json
          // 使用静默模式，不显示通知
          if (onUpdate) {
            (onUpdate as any)(updatedProvider, true);
          }
        }
      }
      
      // 如果当前key已耗尽且是当前使用的provider，尝试自动切换
      if (checkAutoSwitch && currentKeyExhausted && provider.id === currentProviderId) {
        console.log(`Current key exhausted for provider ${provider.name}`);
        
        // 根据切换策略进行切换
        const strategy = provider.switch_strategy || 'manual';
        
        if (strategy !== 'manual' && provider.api_keys && provider.api_keys.length > 1) {
          console.log(`Auto-switching with strategy: ${strategy}`);
          
          // 根据策略选择下一个key
          let newIndex = -1;
          const currentIndex = provider.current_key_index || 0;
          
          if (strategy === 'round_robin') {
            // 轮询：切换到下一个有余额的key
            for (let i = 1; i <= provider.api_keys.length; i++) {
              const idx = (currentIndex + i) % provider.api_keys.length;
              const keyInfo = provider.api_keys[idx];
              // 检查该key是否有余额（如果没有balance信息则认为有余额）
              if (!keyInfo.balance || keyInfo.balance.remaining > 0) {
                newIndex = idx;
                break;
              }
            }
          } else if (strategy === 'use_lowest') {
            // 使用最低余额的（但大于0）
            let lowestBalance = Infinity;
            provider.api_keys.forEach((key, idx) => {
              const balance = key.balance?.remaining || Infinity;
              if (balance > 0 && balance < lowestBalance) {
                lowestBalance = balance;
                newIndex = idx;
              }
            });
          } else if (strategy === 'use_highest') {
            // 使用最高余额的
            let highestBalance = 0;
            provider.api_keys.forEach((key, idx) => {
              const balance = key.balance?.remaining || 0;
              if (balance > highestBalance) {
                highestBalance = balance;
                newIndex = idx;
              }
            });
          }
          
          // 如果找到可用的key，进行切换
          if (newIndex >= 0 && newIndex !== currentIndex) {
            try {
              console.log(`Switching to key index ${newIndex}`);
              
              // 更新provider配置
              const updatedProvider = {
                ...provider,
                current_key_index: newIndex,
                api_key: provider.api_keys[newIndex].key
              };
              
              // 调用更新函数
              if (onUpdate) {
                (onUpdate as any)(updatedProvider, true); // 静默更新
              }
              
              // 通知用户
              const message = `余额耗尽，已自动切换到 ${provider.api_keys[newIndex].name || `Key ${newIndex + 1}`}`;
              if (onNotify) {
                onNotify(message, "success");
              }
              
              // 重新获取余额（不再检查自动切换，避免循环）
              setTimeout(() => {
                fetchBalance(provider, false);
              }, 1000);
            } catch (error) {
              console.error('Failed to auto-switch key:', error);
            }
          } else if (strategy !== 'manual') {
            // 所有key都耗尽了
            if (onNotify) {
              onNotify("所有API Key余额都已耗尽，请添加新的Key", "error");
            }
          }
        } else if (strategy === 'manual') {
          // 手动模式下只提醒用户
          if (onNotify) {
            onNotify("当前API Key余额已耗尽，请手动切换或添加新的Key", "error");
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch balance for ${provider.name}:`, error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      console.error('Full error details:', error);
      
      setBalances(prev => ({
        ...prev,
        [provider.id]: {
          totalAllowance: 0,
          totalUsed: 0,
          remaining: 0,
          usedRatio: 0,
          loading: false,
          error: errorMessage,
        }
      }));
    } finally {
      setRefreshing(prev => ({ ...prev, [provider.id]: false }));
    }
  };

  // 处理模型切换
  const handleModelChange = async (provider: DroidProvider, newModel: string) => {
    const models = getAvailableModels(provider.id);
    const modelInfo = models.find(m => m.value === newModel);
    if (!modelInfo) return;
    
    // 获取余额信息来构建显示名称
    const balance = balances[provider.id];
    let displayName = modelInfo.label;
    
    if (balance && !balance.loading) {
      if (balance.remaining <= 0) {
        // 余额耗尽
        displayName = `${modelInfo.label} [D] ⚠️ 额度耗尽`;
      } else {
        const remainingM = (balance.remaining / 1000000).toFixed(1);
        // 根据使用率选择红黄绿圆形图标
        let indicator = "🟢";
        if (balance.usedRatio < 0.5) {
          indicator = "🟢"; // 绿色
        } else if (balance.usedRatio < 0.8) {
          indicator = "🟡"; // 黄色
        } else {
          indicator = "🔴"; // 红色
        }
        displayName = `${modelInfo.label} [D] ${indicator} ${remainingM}M`;
      }
    }
    
    // 更新provider的模型
    const updatedProvider: DroidProvider = {
      ...provider,
      model: newModel,
      model_display_name: displayName
    };
    
    // 关闭下拉框
    setShowModelSelect(prev => ({ ...prev, [provider.id]: false }));
    
    // 直接调用onUpdate保存模型更改
    if (onUpdate) {
      onUpdate(updatedProvider);
    }
  };
  
  // 初始加载所有余额
  useEffect(() => {
    providers.forEach(provider => {
      if (!balances[provider.id] && (provider.api_key || (provider.api_keys && provider.api_keys.length > 0))) {
        fetchBalance(provider);
      }
    });
  }, [providers]);

  // 自动刷新余额（每10秒）
  useEffect(() => {
    if (autoRefreshEnabled && providers.length > 0) {
      // 立即执行一次检查
      providers.forEach(provider => {
        if (provider.id === currentProviderId && (provider.api_key || (provider.api_keys && provider.api_keys.length > 0))) {
          fetchBalance(provider);
        }
      });
      
      // 设置定时器
      const interval = setInterval(() => {
        console.log('自动检测余额状态...');
        // 只检查当前使用的provider，减少API调用
        const currentProvider = providers.find(p => p.id === currentProviderId);
        if (currentProvider && (currentProvider.api_key || (currentProvider.api_keys && currentProvider.api_keys.length > 0))) {
          fetchBalance(currentProvider);
        }
      }, 10000); // 10秒刷新一次

      return () => clearInterval(interval);
    }
  }, [providers, autoRefreshEnabled, currentProviderId, onUpdate]);
  
  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.model-dropdown')) {
        setShowModelSelect({});
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (providers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <Key size={24} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          还没有添加任何 Droid API Key
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          点击右上角"添加 Key"按钮开始
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {providers.map((provider) => {
        const isCurrent = provider.id === currentProviderId;
        const balance = balances[provider.id];
        const isRefreshing = refreshing[provider.id];
        
        return (
          <div
            key={provider.id}
            className={cn(
              isCurrent ? cardStyles.selected : cardStyles.interactive,
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {provider.name}
                  </h3>
                  {provider.api_keys && provider.api_keys.length > 0 && (
                    <div className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                      {provider.api_keys.length} Keys
                    </div>
                  )}
                  <div
                    className={cn(
                      badgeStyles.success,
                      !isCurrent && "invisible",
                    )}
                  >
                    <CheckCircle2 size={12} />
                    当前使用
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="font-medium">模型:</span>
                    <div className="relative model-dropdown">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowModelSelect(prev => ({ ...prev, [provider.id]: !prev[provider.id] }));
                        }}
                        className="flex items-center gap-1.5 px-2 py-1 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <span>
                          {provider.model_display_name || "Sonnet 4.5 [droid]"}
                        </span>
                        <ChevronDown size={14} className={cn(
                          "transition-transform",
                          showModelSelect[provider.id] ? "rotate-180" : ""
                        )} />
                      </button>
                      
                      {showModelSelect[provider.id] && (
                        <div className="absolute top-full left-0 mt-1 w-full min-w-[280px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 overflow-hidden">
                          {getAvailableModels(provider.id).map((model) => {
                            const isSelected = provider.model === model.value || 
                                             (!provider.model && model.value === "claude-sonnet-4-5-20250929");
                            return (
                              <button
                                key={model.value}
                                onClick={() => handleModelChange(provider, model.value)}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                                  isSelected && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                )}
                              >
                                {model.displayLabel}
                                {isSelected && <span className="ml-2 text-xs">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* API Key 信息 */}
                  {provider.api_keys && provider.api_keys.length > 0 ? (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <span className="font-medium">当前Key:</span>
                      <span className="font-mono text-gray-500 dark:text-gray-400">
                        {provider.api_keys[provider.current_key_index || 0]?.name || "主Key"}
                      </span>
                      {provider.switch_strategy && provider.switch_strategy !== "manual" && (
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          ({provider.switch_strategy === "round_robin" ? "轮询" : 
                            provider.switch_strategy === "use_lowest" ? "优先最低" : 
                            provider.switch_strategy === "use_highest" ? "优先最高" : "手动"})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <span className="font-medium">API Key:</span>
                      <span className="font-mono text-gray-500 dark:text-gray-400">
                        {provider.api_key.slice(0, 10)}...{provider.api_key.slice(-6)}
                      </span>
                    </div>
                  )}

                  {/* 余额信息 */}
                  {balance && !balance.error && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">总额度</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {balance.loading ? '...' : formatNumber(balance.totalAllowance)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">剩余</div>
                          <div className={cn(
                            "font-semibold",
                            balance.remaining === 0 
                              ? "text-red-500 dark:text-red-400" 
                              : "text-green-600 dark:text-green-400"
                          )}>
                            {balance.loading ? '...' : formatNumber(balance.remaining)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">使用率</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {balance.loading ? '...' : formatPercentage(balance.usedRatio)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {balance?.error && (
                    <div className="mt-2 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
                      余额查询失败: {balance.error}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {/* 刷新余额按钮 */}
                <button
                  onClick={() => fetchBalance(provider)}
                  disabled={isRefreshing}
                  className={buttonStyles.icon}
                  title="刷新余额"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </button>

                {/* 切换按钮 */}
                <button
                  onClick={() => onSwitch(provider.id)}
                  disabled={isCurrent}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors w-[90px] justify-center whitespace-nowrap",
                    isCurrent
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
                  )}
                >
                  {isCurrent ? <Check size={14} /> : <Play size={14} />}
                  {isCurrent ? "使用中" : "切换"}
                </button>

                {/* 编辑按钮 */}
                <button
                  onClick={() => onEdit(provider)}
                  className={buttonStyles.icon}
                  title="编辑"
                >
                  <Edit3 size={16} />
                </button>

                {/* 删除按钮 */}
                <button
                  onClick={() => onDelete(provider.id)}
                  disabled={isCurrent}
                  className={cn(
                    buttonStyles.icon,
                    isCurrent
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-500 hover:text-red-500 hover:bg-red-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10",
                  )}
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DroidProviderList;
