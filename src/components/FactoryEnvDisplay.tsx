import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Key, RefreshCw, AlertCircle } from 'lucide-react';

export interface FactoryEnvDisplayRef {
  refresh: () => void;
}

interface FactoryEnvDisplayProps {
  currentProviderId?: string;
}

export const FactoryEnvDisplay = forwardRef<FactoryEnvDisplayRef, FactoryEnvDisplayProps>(({ currentProviderId }, ref) => {
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null);
  const [envApiKey, setEnvApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      // 获取当前选中 provider 的所有信息
      const providers = await window.api.getDroidProviders();
      const currentProvider = providers.find(p => p.id === currentProviderId);

      // 设置当前使用的 API key
      if (currentProvider) {
        setCurrentApiKey(currentProvider.api_key);
      } else {
        setCurrentApiKey(null);
      }

      // 获取环境变量中的 API key
      const envKey = await window.api.getFactoryApiKeyEnv();
      setEnvApiKey(envKey);
    } catch (error) {
      console.error('获取 API Key 信息失败:', error);
      setCurrentApiKey(null);
      setEnvApiKey(null);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchKeys
  }));

  useEffect(() => {
    fetchKeys();
  }, [currentProviderId]);

  // 检测 API key 是否一致
  const keysMatch = currentApiKey && envApiKey && currentApiKey === envApiKey;
  const showWarning = currentApiKey && envApiKey && !keysMatch;

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            当前 API Key 状态
          </h3>
        </div>
        <button
          onClick={fetchKeys}
          disabled={loading}
          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
          title="刷新"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 当前使用的 API Key */}
      <div className="text-sm mb-3">
        <div className="text-blue-700 dark:text-blue-300 mb-1 font-medium">
          当前使用 (应用配置):
        </div>
        {currentApiKey ? (
          <div className="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded border border-blue-200 dark:border-blue-700 break-all">
            {currentApiKey.slice(0, 10)}...{currentApiKey.slice(-6)}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 italic">
            未选择 Provider
          </div>
        )}
      </div>

      {/* 环境变量中的 API Key */}
      <div className="text-sm">
        <div className="text-blue-700 dark:text-blue-300 mb-1 font-medium">
          环境变量 (FACTORY_API_KEY):
        </div>
        {envApiKey ? (
          <div className="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded border border-blue-200 dark:border-blue-700 break-all">
            {envApiKey.slice(0, 10)}...{envApiKey.slice(-6)}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 italic">
            未设置
          </div>
        )}
      </div>

      {/* 警告提示 */}
      {showWarning && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-700 dark:text-yellow-300">
            <strong>注意：</strong>环境变量与当前使用的 API Key 不一致。在新的终端窗口中，请执行 <code className="bg-yellow-100 dark:bg-yellow-900 px-1 py-0.5 rounded">source ~/.zshrc</code> 来更新环境变量。
          </div>
        </div>
      )}

      {keysMatch && currentApiKey && (
        <div className="mt-3 flex items-start gap-2 text-xs text-green-600 dark:text-green-400">
          <div className="mt-0.5">✓</div>
          <div>环境变量已同步，在新终端中执行 <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">source ~/.zshrc</code> 即可使用。</div>
        </div>
      )}
    </div>
  );
});
