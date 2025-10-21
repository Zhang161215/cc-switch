import React, { useState, useEffect } from "react";
import { Settings, Save, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { DroidConfig } from "../types";

interface FactoryConfigEditorProps {
  onNotify?: (message: string, type: "success" | "error", duration?: number) => void;
}

const FactoryConfigEditor: React.FC<FactoryConfigEditorProps> = ({ onNotify }) => {
  const [config, setConfig] = useState<DroidConfig | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 加载配置
  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const factoryConfig = await window.api.getFactoryConfig();
      setConfig(factoryConfig);
    } catch (error) {
      console.error("加载 Factory 配置失败:", error);
      onNotify?.("加载配置失败", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // 保存配置
  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      await window.api.saveFactoryConfig(config);
      onNotify?.("配置已保存", "success", 2000);
    } catch (error) {
      console.error("保存 Factory 配置失败:", error);
      onNotify?.("保存配置失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // 重置配置
  const handleReset = async () => {
    if (window.confirm("确定要重新加载配置吗？未保存的更改将丢失。")) {
      await loadConfig();
      onNotify?.("配置已重新加载", "success", 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Settings className="h-4 w-4 animate-spin" />
          <span>加载配置中...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Factory 配置 (config.json)
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </div>

      {/* 配置内容 */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* 默认模型 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              默认模型 (default_model)
            </label>
            <input
              type="text"
              value={config.default_model || ""}
              onChange={(e) =>
                setConfig({ ...config, default_model: e.target.value || undefined })
              }
              placeholder="例如: claude-sonnet-4-5-20250929"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              在模型选择器中默认选中的模型标识
            </p>
          </div>

          {/* 启用成本跟踪 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enable_cost_tracking"
              checked={config.enable_cost_tracking || false}
              onChange={(e) =>
                setConfig({ ...config, enable_cost_tracking: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <label
              htmlFor="enable_cost_tracking"
              className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
            >
              启用成本跟踪 (enable_cost_tracking)
            </label>
          </div>

          {/* 启用提示词缓存 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enable_prompt_caching"
              checked={config.enable_prompt_caching || false}
              onChange={(e) =>
                setConfig({ ...config, enable_prompt_caching: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <label
              htmlFor="enable_prompt_caching"
              className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
            >
              启用提示词缓存 (enable_prompt_caching)
            </label>
          </div>

          {/* 自定义模型数量 */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              自定义模型: <span className="font-medium">{config.custom_models?.length || 0}</span> 个
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              自定义模型通过 Droid Provider 管理，在上方列表中添加和编辑
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Settings className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存配置
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-4 w-4" />
              重新加载
            </button>
          </div>

          {/* 配置文件路径提示 */}
          <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
            配置文件: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">~/.factory/config.json</code>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryConfigEditor;
