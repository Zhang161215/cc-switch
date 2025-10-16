import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { DroidProvider } from "../types";
import { Play, Edit3, Trash2, CheckCircle2, Key, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { buttonStyles, cardStyles, badgeStyles, cn } from "../lib/styles";

export interface DroidProviderListRef {
  fetchBalance: (providerId: string) => Promise<void>;
}

interface DroidProviderListProps {
  providers: DroidProvider[];
  currentProviderId: string;
  onSwitch: (id: string) => void;
  onEdit: (provider: DroidProvider) => void;
  onDelete: (id: string) => void;
  onUpdate?: (provider: DroidProvider, silent?: boolean) => void;
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

const DroidProviderList = forwardRef<DroidProviderListRef, DroidProviderListProps>(({
  providers,
  currentProviderId,
  onSwitch,
  onEdit,
  onDelete,
  onUpdate,
  onNotify,
}, ref) => {
  const [balances, setBalances] = useState<Record<string, BalanceInfo>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  // 获取余额信息
  const fetchBalance = async (provider: DroidProvider) => {
    if (!provider.api_key) return;

    console.log(`Fetching balance for provider ${provider.name}...`);
    setRefreshing(prev => ({ ...prev, [provider.id]: true }));
    setBalances(prev => ({
      ...prev,
      [provider.id]: { ...prev[provider.id], loading: true }
    }));

    try {
      let totalAllowance = 0;
      let totalUsed = 0;

      // 单个key的余额查询
      console.log(`Calling fetchDroidBalance with key: ${provider.api_key.slice(0,10)}...`);
      const data = await window.api.fetchDroidBalance(provider.api_key);
      console.log('Balance data received:', data);

      if (data.usage && data.usage.standard) {
        totalAllowance = data.usage.standard.totalAllowance || 0;
        totalUsed = data.usage.standard.orgTotalTokensUsed || 0;
      }

      const remaining = Math.max(0, totalAllowance - totalUsed);
      const usedRatio = totalAllowance > 0 ? totalUsed / totalAllowance : 0;

      const balanceData = {
        totalAllowance,
        totalUsed,
        remaining,
        usedRatio,
        loading: false,
      };

      setBalances(prev => ({
        ...prev,
        [provider.id]: balanceData
      }));

      // 保存余额数据到 provider，并清除失效标记（查询成功说明账号有效）
      if (onUpdate) {
        const updatedProvider = {
          ...provider,
          balance: {
            total_allowance: totalAllowance,
            total_used: totalUsed,
            remaining,
            used_ratio: usedRatio,
            last_checked: Date.now()
          },
          is_invalid: false // 查询成功，清除失效标记
        };
        await onUpdate(updatedProvider, true); // 静默更新，不显示通知
      }
    } catch (error) {
      console.error(`Failed to fetch balance for ${provider.name}:`, error);
      let errorMessage = 'Unknown error';
      let is401 = false;

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }

      // 检测是否为401错误
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        is401 = true;
        errorMessage = 'API Key 已失效（401 Unauthorized）';
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

      // 如果是401错误，标记账号失效
      if (is401 && onUpdate) {
        const updatedProvider = {
          ...provider,
          is_invalid: true
        };
        await onUpdate(updatedProvider, true);

        // 通知用户账号已失效
        if (onNotify) {
          onNotify(`账号 "${provider.name}" 已失效，请检查 API Key`, 'error');
        }
      }
    } finally {
      setRefreshing(prev => ({ ...prev, [provider.id]: false }));
    }
  };


  // 刷新所有账号的余额
  const refreshAllBalances = async () => {
    for (const provider of providers) {
      if (provider.api_key) {
        await fetchBalance(provider);
      }
    }
  };

  // 从缓存加载余额数据
  useEffect(() => {
    const cachedBalances: Record<string, BalanceInfo> = {};
    providers.forEach(provider => {
      if (provider.balance) {
        cachedBalances[provider.id] = {
          totalAllowance: provider.balance.total_allowance,
          totalUsed: provider.balance.total_used,
          remaining: provider.balance.remaining,
          usedRatio: provider.balance.used_ratio,
          loading: false
        };
      }
    });
    setBalances(cachedBalances);
  }, [providers]);

  // Expose fetchBalance function to parent via ref
  useImperativeHandle(ref, () => ({
    fetchBalance: async (providerId: string) => {
      const provider = providers.find(p => p.id === providerId);
      if (provider) {
        await fetchBalance(provider);
      }
    }
  }), [providers]);


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

  // 计算总计数据
  const summary = Object.values(balances).reduce(
    (acc, balance) => {
      if (balance && !balance.loading && !balance.error) {
        acc.totalAllowance += balance.totalAllowance;
        acc.totalUsed += balance.totalUsed;
        acc.totalRemaining += balance.remaining;
        acc.validCount += 1;
      }
      return acc;
    },
    { totalAllowance: 0, totalUsed: 0, totalRemaining: 0, validCount: 0 }
  );

  const totalUsedRatio = summary.totalAllowance > 0
    ? summary.totalUsed / summary.totalAllowance
    : 0;

  return (
    <div className="space-y-4">
      {/* 汇总统计卡片 */}
      {summary.validCount > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                总体统计
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {providers.length} 个 Key（{summary.validCount} 个已查询）
              </div>
            </div>
            <button
              onClick={refreshAllBalances}
              disabled={Object.values(refreshing).some(r => r)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                Object.values(refreshing).some(r => r)
                  ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              )}
              title="刷新所有账号余额"
            >
              <RefreshCw size={12} className={Object.values(refreshing).some(r => r) ? 'animate-spin' : ''} />
              刷新全部
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* 总额 */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-md p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">总额度</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                {(summary.totalAllowance / 1000000).toFixed(1)}M
              </div>
            </div>

            {/* 已用 */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-md p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">已使用</div>
              <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                {(summary.totalUsed / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {(totalUsedRatio * 100).toFixed(1)}%
              </div>
            </div>

            {/* 剩余 */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-md p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">剩余</div>
              <div className={cn(
                "text-base font-bold",
                totalUsedRatio >= 0.8
                  ? "text-red-600 dark:text-red-400"
                  : totalUsedRatio >= 0.5
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-green-600 dark:text-green-400"
              )}>
                {(summary.totalRemaining / 1000000).toFixed(1)}M
              </div>
            </div>
          </div>

          {/* 总体进度条 */}
          <div className="mt-2">
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  totalUsedRatio >= 0.8
                    ? "bg-red-500"
                    : totalUsedRatio >= 0.5
                    ? "bg-yellow-500"
                    : "bg-green-500"
                )}
                style={{ width: `${Math.min(100, totalUsedRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* API Key 列表 */}
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
                  <div
                    className={cn(
                      badgeStyles.success,
                      !isCurrent && "invisible",
                    )}
                  >
                    <CheckCircle2 size={12} />
                    当前使用
                  </div>
                  {/* 失效标识 */}
                  {provider.is_invalid && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertTriangle size={12} />
                      已失效
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-sm">
                  {/* API Key 信息 */}
                  <div className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">API Key:</span>
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {provider.api_key.slice(0, 10)}...{provider.api_key.slice(-6)}
                      </span>
                    </div>
                    {balance && !balance.loading && !balance.error && (
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          已用 {(balance.totalUsed / 1000000).toFixed(1)}M / 总额 {(balance.totalAllowance / 1000000).toFixed(1)}M
                        </div>
                        <div className={cn(
                          "text-sm font-medium",
                          balance.remaining === 0
                            ? "text-red-500 dark:text-red-400"
                            : balance.usedRatio > 0.8
                            ? "text-orange-500 dark:text-orange-400"
                            : "text-green-600 dark:text-green-400"
                        )}>
                          剩余 {(balance.remaining / 1000000).toFixed(1)}M
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 余额进度条 */}
                  {balance && !balance.error && (
                    <div className="mt-2">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            balance.usedRatio >= 0.8
                              ? "bg-red-500"
                              : balance.usedRatio >= 0.5
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          )}
                          style={{ width: `${Math.min(100, balance.usedRatio * 100)}%` }}
                        />
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
});

DroidProviderList.displayName = 'DroidProviderList';

export default DroidProviderList;
