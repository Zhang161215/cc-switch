import { useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  RotateCw,
  Settings,
  ListPlus,
} from "lucide-react";
import { ApiKeyInfo, SwitchStrategy } from "../types";
import { buttonStyles, cardStyles, cn } from "../lib/styles";

interface MultiKeyManagerProps {
  apiKeys: ApiKeyInfo[];
  currentKeyIndex: number;
  switchStrategy: SwitchStrategy;
  onAddKey: (key: ApiKeyInfo) => void;
  onRemoveKey: (keyId: string) => void;
  onSelectKey: (index: number) => void;
  onUpdateStrategy: (strategy: SwitchStrategy) => void;
  onRefreshBalances: () => void;
}

const MultiKeyManager: React.FC<MultiKeyManagerProps> = ({
  apiKeys = [],
  currentKeyIndex = 0,
  switchStrategy = "manual",
  onAddKey,
  onRemoveKey,
  onSelectKey,
  onUpdateStrategy,
  onRefreshBalances,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchAddModal, setShowBatchAddModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ name: "", key: "" });
  const [batchKeysText, setBatchKeysText] = useState("");
  const [batchAddResults, setBatchAddResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 格式化数字显示
  const formatNumber = (num: number): string => {
    if (!num || num === 0) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  // 格式化百分比
  const formatPercentage = (ratio: number): string => {
    return `${(ratio * 100).toFixed(2)}%`;
  };

  // 策略选项
  const strategies = [
    { value: "manual", label: "手动切换", icon: Settings },
    { value: "round_robin", label: "轮询使用", icon: RotateCw },
    { value: "use_lowest", label: "优先最低", icon: TrendingDown },
    { value: "use_highest", label: "优先最高", icon: TrendingUp },
  ];

  // 添加新Key
  const handleAddKey = () => {
    if (newKeyData.key) {
      // 清除API key前后的空格
      const trimmedKey = newKeyData.key.trim();

      const newKey: ApiKeyInfo = {
        id: Date.now().toString(),
        key: trimmedKey,
        name: newKeyData.name || `Key ${apiKeys.length + 1}`,
        is_active: apiKeys.length === 0,
      };
      onAddKey(newKey);
      setNewKeyData({ name: "", key: "" });
      setShowAddModal(false);

      // 添加后立即触发余额刷新
      setTimeout(() => {
        if (onRefreshBalances) {
          onRefreshBalances();
        }
      }, 500);
    }
  };

  // 批量添加 Key
  const handleBatchAddKeys = () => {
    setBatchAddResults(null);

    // 按行分割，支持多种换行符
    const lines = batchKeysText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      setBatchAddResults({
        success: 0,
        failed: 0,
        errors: ["请输入至少一个 API Key"],
      });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const existingKeys = new Set(apiKeys.map((k) => k.key));
    let addedCount = 0;

    lines.forEach((line, index) => {
      // 支持两种格式：
      // 1. 仅 API Key：fk-xxxxx
      // 2. 名称+API Key：主Key,fk-xxxxx 或 主Key fk-xxxxx
      const parts = line.split(/[,\s]+/).filter((p) => p.length > 0);

      let name = "";
      let key = "";

      if (parts.length === 1) {
        // 仅 API Key
        key = parts[0].trim();
      } else if (parts.length >= 2) {
        // 名称 + API Key（最后一部分是 key）
        key = parts[parts.length - 1].trim();
        name = parts.slice(0, -1).join(" ").trim();
      }

      // 验证 API Key 格式
      if (!key.startsWith("fk-")) {
        results.failed++;
        results.errors.push(
          `第 ${index + 1} 行：API Key 格式错误（应以 fk- 开头）`,
        );
        return;
      }

      // 检查重复
      if (existingKeys.has(key)) {
        results.failed++;
        results.errors.push(`第 ${index + 1} 行：API Key 已存在`);
        return;
      }

      // 添加到集合，避免批量中重复
      existingKeys.add(key);

      // 生成默认名称
      const finalName = name || `Batch Key ${apiKeys.length + addedCount + 1}`;

      const newKey: ApiKeyInfo = {
        id: `${Date.now()}-${addedCount}`,
        key: key,
        name: finalName,
        is_active: apiKeys.length === 0 && addedCount === 0,
      };

      onAddKey(newKey);
      addedCount++;
      results.success++;
    });

    setBatchAddResults(results);

    // 如果全部成功，延迟关闭并刷新
    if (results.failed === 0) {
      setTimeout(() => {
        setShowBatchAddModal(false);
        setBatchKeysText("");
        setBatchAddResults(null);

        // 触发余额刷新
        if (onRefreshBalances) {
          onRefreshBalances();
        }
      }, 1500);
    }
  };

  // 刷新所有余额
  const handleRefreshAll = async () => {
    setRefreshing(true);
    await onRefreshBalances();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // 初次加载时自动刷新余额 - 已禁用自动刷新
  // useEffect(() => {
  //   if (apiKeys.length > 0 && !apiKeys.some(key => key.balance)) {
  //     handleRefreshAll();
  //   }
  // }, [apiKeys.length]);

  return (
    <div className="space-y-4">
      {/* 切换策略选择 */}
      <div className={cardStyles.base}>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          切换策略
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {strategies.map((strategy) => {
            const Icon = strategy.icon;
            const isActive = switchStrategy === strategy.value;
            return (
              <button
                key={strategy.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUpdateStrategy(strategy.value as SwitchStrategy);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                  isActive
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                )}
              >
                <Icon size={14} />
                {strategy.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* API Keys 列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            API Keys ({apiKeys.length})
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
              title="刷新所有余额"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              刷新余额
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowBatchAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg transition-colors"
            >
              <ListPlus size={14} />
              批量添加
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg transition-colors"
            >
              <Plus size={14} />
              添加 Key
            </button>
          </div>
        </div>

        {apiKeys.map((key, index) => {
          const isActive = index === currentKeyIndex;
          return (
            <div
              key={key.id}
              className={cn(
                cardStyles.interactive,
                isActive &&
                  "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900",
                key.balance &&
                  key.balance.remaining <= 0 &&
                  "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => onSelectKey(index)}
                      className="flex items-center gap-2"
                    >
                      {isActive ? (
                        <CheckCircle size={16} className="text-blue-500" />
                      ) : (
                        <Circle size={16} className="text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {key.name || `Key ${index + 1}`}
                      </span>
                    </button>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                        使用中
                      </span>
                    )}
                    {key.balance && key.balance.remaining <= 0 && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded">
                        ⚠️ 余额耗尽
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        API Key:
                      </span>
                      <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
                        {key.key.slice(0, 10)}...{key.key.slice(-6)}
                      </span>
                    </div>

                    {(() => {
                      // 使用默认值如果没有余额信息
                      const balance = key.balance || {
                        total_allowance: 20000000, // 默认20M
                        remaining: 20000000,
                        total_used: 0,
                        used_ratio: 0,
                      };
                      return (
                        <div className="flex items-center gap-4 mt-2">
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              额度:
                            </span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">
                              {formatNumber(balance.total_allowance)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              剩余:
                            </span>
                            <span
                              className={cn(
                                "ml-1 font-medium",
                                balance.remaining === 0
                                  ? "text-red-500"
                                  : "text-green-600 dark:text-green-400",
                              )}
                            >
                              {formatNumber(balance.remaining)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              使用率:
                            </span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">
                              {formatPercentage(balance.used_ratio)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {switchStrategy === "manual" && !isActive && (
                    <button
                      onClick={() => {
                        // 检查当前key余额
                        const balance = key.balance;
                        if (balance && balance.remaining <= 0) {
                          // 查找第一个有余额的key
                          const availableKeyIndex = apiKeys.findIndex(
                            (k, i) =>
                              i !== index &&
                              (!k.balance || k.balance.remaining > 0),
                          );

                          if (availableKeyIndex !== -1) {
                            onSelectKey(availableKeyIndex);
                            alert(
                              `Key "${key.name}" 余额不足，已自动切换到 "${apiKeys[availableKeyIndex].name}"`,
                            );
                          } else {
                            alert("所有Key余额都已耗尽，请添加新的API Key");
                          }
                        } else {
                          onSelectKey(index);
                        }
                      }}
                      disabled={key.balance && key.balance.remaining <= 0}
                      className={cn(
                        "text-sm py-1 px-2",
                        key.balance && key.balance.remaining <= 0
                          ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                          : buttonStyles.secondary,
                      )}
                    >
                      {key.balance && key.balance.remaining <= 0
                        ? "余额不足"
                        : "切换"}
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveKey(key.id)}
                    disabled={apiKeys.length === 1}
                    className={cn(
                      buttonStyles.icon,
                      "text-gray-500 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-500/10",
                      apiKeys.length === 1 && "opacity-50 cursor-not-allowed",
                    )}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* 添加新Key的占位按钮 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAddModal(true);
          }}
          className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all group"
        >
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400">
            <Plus size={18} />
            <span className="font-medium">添加新的 API Key</span>
          </div>
        </button>
      </div>

      {/* 添加 Key 模态框 */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            e.stopPropagation();
            // 如果点击背景，关闭模态框
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setNewKeyData({ name: "", key: "" });
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              添加新的 API Key
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  名称（可选）
                </label>
                <input
                  type="text"
                  value={newKeyData.name}
                  onChange={(e) =>
                    setNewKeyData({ ...newKeyData, name: e.target.value })
                  }
                  placeholder="例如：主要Key、备用Key等"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  API Key *
                </label>
                <input
                  type="text"
                  value={newKeyData.key}
                  onChange={(e) =>
                    setNewKeyData({ ...newKeyData, key: e.target.value })
                  }
                  placeholder="fk-..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddModal(false);
                  setNewKeyData({ name: "", key: "" });
                }}
                className={buttonStyles.secondary}
              >
                取消
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddKey();
                }}
                disabled={!newKeyData.key}
                className={cn(
                  buttonStyles.primary,
                  !newKeyData.key && "opacity-50 cursor-not-allowed",
                )}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量添加 Key 模态框 */}
      {showBatchAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowBatchAddModal(false);
              setBatchKeysText("");
              setBatchAddResults(null);
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              批量添加 API Keys
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  API Keys（每行一个）
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 space-y-1">
                  <p>支持以下格式：</p>
                  <ul className="list-disc list-inside pl-2">
                    <li>
                      仅 API Key：
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                        fk-xxxxx
                      </code>
                    </li>
                    <li>
                      名称 + API Key：
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                        主Key fk-xxxxx
                      </code>{" "}
                      或{" "}
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                        主Key,fk-xxxxx
                      </code>
                    </li>
                  </ul>
                </div>
                <textarea
                  value={batchKeysText}
                  onChange={(e) => setBatchKeysText(e.target.value)}
                  placeholder={
                    "示例：\nfk-abc123def456\n备用Key fk-xyz789uvw012\n主Key,fk-123456789abc"
                  }
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>

              {/* 添加结果显示 */}
              {batchAddResults && (
                <div
                  className={cn(
                    "p-4 rounded-lg border",
                    batchAddResults.failed === 0
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        batchAddResults.failed === 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-yellow-700 dark:text-yellow-400",
                      )}
                    >
                      添加结果
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      成功：
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {batchAddResults.success}
                      </span>{" "}
                      个
                    </p>
                    {batchAddResults.failed > 0 && (
                      <>
                        <p className="text-gray-700 dark:text-gray-300">
                          失败：
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {batchAddResults.failed}
                          </span>{" "}
                          个
                        </p>
                        {batchAddResults.errors.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                              错误详情：
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                              {batchAddResults.errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBatchAddModal(false);
                  setBatchKeysText("");
                  setBatchAddResults(null);
                }}
                className={buttonStyles.secondary}
              >
                {batchAddResults?.failed === 0 ? "完成" : "取消"}
              </button>
              {(!batchAddResults || batchAddResults.failed > 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBatchAddKeys();
                  }}
                  disabled={!batchKeysText.trim()}
                  className={cn(
                    buttonStyles.primary,
                    !batchKeysText.trim() && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {batchAddResults ? "重试" : "批量添加"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiKeyManager;
