import React, { useState, useEffect } from "react";
import { Settings, Save, RotateCcw, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface FactoryConfigEditorProps {
  onNotify?: (message: string, type: "success" | "error", duration?: number) => void;
}

const FactoryConfigEditor: React.FC<FactoryConfigEditorProps> = ({ onNotify }) => {
  const [configText, setConfigText] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 加载配置
  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const factoryConfig = await window.api.getFactoryConfig();
      // 将配置对象转换为格式化的 JSON 文本
      setConfigText(JSON.stringify(factoryConfig, null, 2));
      setJsonError(null);
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

  // 验证 JSON 格式
  const validateJson = (text: string): boolean => {
    try {
      JSON.parse(text);
      setJsonError(null);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        setJsonError(error.message);
      } else {
        setJsonError("JSON 格式错误");
      }
      return false;
    }
  };

  // 处理文本变化
  const handleTextChange = (text: string) => {
    setConfigText(text);
    // 实时验证 JSON
    if (text.trim()) {
      validateJson(text);
    }
  };

  // 保存配置
  const handleSave = async () => {
    if (!configText.trim()) {
      onNotify?.("配置不能为空", "error");
      return;
    }

    // 验证 JSON
    if (!validateJson(configText)) {
      onNotify?.("JSON 格式错误，请检查后重试", "error");
      return;
    }

    setIsSaving(true);
    try {
      const config = JSON.parse(configText);
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
          {/* JSON 编辑器 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                配置内容 (JSON 格式)
              </label>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">~/.factory/config.json</code>
              </div>
            </div>
            
            <textarea
              value={configText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-y"
              placeholder='{
  "custom_models": [],
  "default_model": "claude-sonnet-4-5-20250929",
  "enable_cost_tracking": true,
  "enable_prompt_caching": true
}'
            />

            {/* JSON 错误提示 */}
            {jsonError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-600 dark:text-red-400">
                  <div className="font-medium">JSON 格式错误</div>
                  <div className="text-xs mt-1 opacity-90">{jsonError}</div>
                </div>
              </div>
            )}

            {/* 配置说明 */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">
                配置项说明
              </div>
              <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
                <li>• <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">custom_models</code> - 自定义模型数组（通过 Droid Provider 管理）</li>
                <li>• <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">default_model</code> - 默认模型标识</li>
                <li>• <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">enable_cost_tracking</code> - 启用成本跟踪</li>
                <li>• <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">enable_prompt_caching</code> - 启用提示词缓存</li>
                <li>• <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">supports_prompt_caching</code> - 支持提示词缓存（模型级别）</li>
              </ul>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !!jsonError}
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
        </div>
      )}
    </div>
  );
};

export default FactoryConfigEditor;
