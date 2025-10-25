import React, { useState, useEffect } from "react";
import { DroidProvider } from "../types";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "../lib/styles";

interface BalanceInfo {
  status: 'loading' | 'success' | 'error';
  data?: {
    totalAllowance: number;
    totalUsed: number;
    remaining: number;
    usedRatio: number;
    startDate?: number;
    endDate?: number;
  };
  error?: string;
}

interface PreviewProvider {
  provider: DroidProvider;
  balance: BalanceInfo;
}

interface BatchPreviewModalProps {
  providers: DroidProvider[];
  onConfirm: (selectedProviders: DroidProvider[]) => void;
  onCancel: () => void;
}

const BatchPreviewModal: React.FC<BatchPreviewModalProps> = ({
  providers,
  onConfirm,
  onCancel,
}) => {
  const [previewProviders, setPreviewProviders] = useState<PreviewProvider[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  // 格式化数字显示
  const formatNumber = (num: number): string => {
    if (!num || num === 0) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  // 初始化并查询余额
  useEffect(() => {
    const initialPreview = providers.map(provider => ({
      provider,
      balance: { status: 'loading' as const }
    }));
    setPreviewProviders(initialPreview);

    // 默认全选
    const allIds = new Set(providers.map(p => p.id));
    setSelectedIds(allIds);

    fetchAllBalances();
  }, []);

  // 切换选中状态
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 全选/全不选
  const toggleSelectAll = () => {
    if (selectedIds.size === previewProviders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(previewProviders.map(p => p.provider.id)));
    }
  };

  // 并行查询所有余额
  const fetchAllBalances = async () => {
    await Promise.all(providers.map(async (provider, index) => {
      try {
        const data = await window.api.fetchDroidBalance(provider.api_key);
        const totalAllowance = data.usage?.standard?.totalAllowance || 0;
        const totalUsed = data.usage?.standard?.orgTotalTokensUsed || 0;
        const remaining = Math.max(0, totalAllowance - totalUsed);
        const usedRatio = totalAllowance > 0 ? totalUsed / totalAllowance : 0;
        const startDate = data.usage?.startDate;
        // 尝试多个可能的到期时间字段名
        const endDate = data.usage?.endDate 
          || data.usage?.expiresAt 
          || data.usage?.expiryDate 
          || data.usage?.validUntil 
          || data.usage?.end_date
          || data.usage?.expires_at;

        setPreviewProviders(prev => {
          const newPrev = [...prev];
          newPrev[index] = {
            ...newPrev[index],
            balance: {
              status: 'success',
              data: { totalAllowance, totalUsed, remaining, usedRatio, startDate, endDate }
            }
          };
          return newPrev;
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setPreviewProviders(prev => {
          const newPrev = [...prev];
          newPrev[index] = {
            ...newPrev[index],
            balance: { status: 'error', error: errorMessage }
          };
          return newPrev;
        });
      }
    }));
  };

  const handleConfirm = () => {
    setIsConfirming(true);
    const selectedProviders = previewProviders
      .filter(p => selectedIds.has(p.provider.id))
      .map(p => p.provider);
    onConfirm(selectedProviders);
  };

  // 统计信息
  const stats = {
    total: previewProviders.length,
    loading: previewProviders.filter(p => p.balance.status === 'loading').length,
    success: previewProviders.filter(p => p.balance.status === 'success').length,
    error: previewProviders.filter(p => p.balance.status === 'error').length,
  };

  const allLoaded = stats.loading === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              批量添加预览 ({selectedIds.size}/{stats.total})
            </h2>
          </div>

          {/* 进度指示 */}
          {!allLoaded && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              <span>查询中 {stats.success + stats.error}/{stats.total}</span>
            </div>
          )}
        </div>

        {/* 工具栏 */}
        {allLoaded && (
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-600 dark:text-green-400">✓ {stats.success}</span>
              {stats.error > 0 && <span className="text-red-600 dark:text-red-400">✗ {stats.error}</span>}
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {selectedIds.size === previewProviders.length ? '取消全选' : '全选'}
            </button>
          </div>
        )}

        {/* Provider 列表 */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {previewProviders.map((item, index) => {
              const { provider, balance } = item;
              const isLoading = balance.status === 'loading';
              const isSuccess = balance.status === 'success';
              const isError = balance.status === 'error';
              const isSelected = selectedIds.has(provider.id);

              return (
                <div
                  key={index}
                  onClick={() => toggleSelection(provider.id)}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer",
                    isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700",
                    isLoading && "opacity-60",
                    isError && "border-red-300 dark:border-red-700",
                    !isSelected && "hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* 复选框 */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                        isSelected
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300 dark:border-gray-600"
                      )}>
                        {isSelected && (
                          <CheckCircle2 size={12} className="text-white" />
                        )}
                      </div>
                    </div>

                    {/* 账号信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isLoading && <Loader2 size={14} className="animate-spin text-blue-500" />}
                        {isSuccess && !isError && <span className="text-green-500">✓</span>}
                        {isError && <span className="text-red-500">✗</span>}
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {provider.name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {provider.api_key.slice(0, 8)}...{provider.api_key.slice(-4)}
                        </span>
                      </div>

                      {/* 余额信息 */}
                      {isLoading && (
                        <div className="text-xs text-gray-400">查询中...</div>
                      )}

                      {isSuccess && balance.data && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">
                              总{formatNumber(balance.data.totalAllowance)}
                            </span>
                            <span className={cn(
                              "font-medium",
                              balance.data.remaining === 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            )}>
                              余{formatNumber(balance.data.remaining)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {(balance.data.usedRatio * 100).toFixed(0)}%
                            </span>
                            {balance.data.remaining === 0 && (
                              <span className="text-yellow-600 dark:text-yellow-400">⚠️ 已耗尽</span>
                            )}
                          </div>

                          {/* 进度条 */}
                          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                balance.data.usedRatio >= 0.8
                                  ? "bg-red-500"
                                  : balance.data.usedRatio >= 0.5
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              )}
                              style={{ width: `${Math.min(100, balance.data.usedRatio * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isError && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {balance.error || '查询失败'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {!allLoaded ? (
              "查询中..."
            ) : stats.error > 0 ? (
              <span className="text-yellow-600 dark:text-yellow-400">
                ⚠️ {stats.error}个失败
              </span>
            ) : selectedIds.size === 0 ? (
              <span className="text-red-600 dark:text-red-400">
                请至少选择一个账号
              </span>
            ) : (
              `已选 ${selectedIds.size} 个`
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className={cn(
                "px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors",
                isConfirming && "opacity-50 cursor-not-allowed"
              )}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!allLoaded || isConfirming || selectedIds.size === 0}
              className={cn(
                "px-4 py-1.5 text-sm font-medium text-white rounded transition-colors",
                isConfirming
                  ? "bg-green-600 cursor-wait"
                  : !allLoaded || selectedIds.size === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-purple-500 hover:bg-purple-600"
              )}
            >
              {isConfirming ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  添加中
                </span>
              ) : (
                `确认添加 ${selectedIds.size} 个`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchPreviewModal;
