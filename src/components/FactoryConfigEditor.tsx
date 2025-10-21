import React, { useState, useEffect } from "react";
import { Settings, ChevronDown, ChevronUp, Edit3, Trash2, Plus, Save, X, Eye, EyeOff } from "lucide-react";
import { DroidConfig, DroidCustomModel } from "../types";
import { isLinux } from "../lib/platform";

interface FactoryConfigEditorProps {
  onNotify?: (message: string, type: "success" | "error", duration?: number) => void;
}

const FactoryConfigEditor: React.FC<FactoryConfigEditorProps> = ({ onNotify }) => {
  const [config, setConfig] = useState<DroidConfig | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<DroidCustomModel | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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

  // 打开添加模型对话框
  const handleAddModel = () => {
    setEditingModel({
      model_display_name: "",
      model: "",
      base_url: "",
      api_key: "",
      provider: "anthropic",
      max_tokens: 8192,
      supports_prompt_caching: false,
    });
    setEditingIndex(-1);
    setIsModalOpen(true);
  };

  // 打开编辑模型对话框
  const handleEditModel = (model: DroidCustomModel, index: number) => {
    setEditingModel({ ...model });
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  // 保存模型
  const handleSaveModel = async () => {
    if (!editingModel || !config) return;

    // 验证必填字段
    if (!editingModel.model_display_name || !editingModel.model || !editingModel.base_url || !editingModel.api_key || !editingModel.provider) {
      onNotify?.("请填写所有必填字段", "error");
      return;
    }

    try {
      const newModels = [...config.custom_models];
      if (editingIndex >= 0) {
        // 编辑现有模型
        newModels[editingIndex] = editingModel;
      } else {
        // 添加新模型
        newModels.push(editingModel);
      }

      const newConfig = { ...config, custom_models: newModels };
      await window.api.saveFactoryConfig(newConfig);
      setConfig(newConfig);
      setIsModalOpen(false);
      onNotify?.("模型配置已保存", "success", 2000);
    } catch (error) {
      console.error("保存模型失败:", error);
      onNotify?.("保存失败", "error");
    }
  };

  // 删除模型
  const handleDeleteModel = async (index: number) => {
    if (!config) return;
    
    if (!window.confirm("确定要删除这个模型配置吗？")) return;

    try {
      const newModels = config.custom_models.filter((_, i) => i !== index);
      const newConfig = { ...config, custom_models: newModels };
      await window.api.saveFactoryConfig(newConfig);
      setConfig(newConfig);
      onNotify?.("模型已删除", "success", 2000);
    } catch (error) {
      console.error("删除模型失败:", error);
      onNotify?.("删除失败", "error");
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

  if (!config) return null;

  return (
    <>
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
              Factory 自定义模型配置 ({config.custom_models.length})
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
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* 添加按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleAddModel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                添加模型
              </button>
            </div>

            {/* 模型列表 */}
            {config.custom_models.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                暂无自定义模型配置
              </div>
            ) : (
              <div className="space-y-2">
                {config.custom_models.map((model, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {model.model_display_name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {model.provider} · {model.model}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {model.base_url}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditModel(model, index)}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteModel(index)}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 配置文件路径 */}
            <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
              配置文件: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">~/.factory/config.json</code>
            </div>
          </div>
        )}
      </div>

      {/* 编辑模型对话框 */}
      {isModalOpen && editingModel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          {/* Backdrop */}
          <div className={`absolute inset-0 bg-black/50 dark:bg-black/70${isLinux() ? "" : " backdrop-blur-sm"}`} />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {editingIndex >= 0 ? "编辑自定义模型" : "添加自定义模型"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {/* model_display_name */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  模型显示名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingModel.model_display_name}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, model_display_name: e.target.value })
                  }
                  placeholder="例如: Sonnet 4.5"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* model */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  模型标识 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingModel.model}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, model: e.target.value })
                  }
                  placeholder="例如: claude-sonnet-4-5-20250929"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* provider */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  提供商 <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingModel.provider}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, provider: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="anthropic">anthropic</option>
                  <option value="openai">openai</option>
                  <option value="generic-chat-completion-api">generic-chat-completion-api</option>
                </select>
              </div>

              {/* base_url */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  API 端点 <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={editingModel.base_url}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, base_url: e.target.value })
                  }
                  placeholder="例如: https://api.anthropic.com"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* api_key */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  API Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={editingModel.api_key}
                    onChange={(e) =>
                      setEditingModel({ ...editingModel, api_key: e.target.value })
                    }
                    placeholder="sk-ant-..."
                    autoComplete="off"
                    className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {editingModel.api_key && (
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* max_tokens */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  最大令牌数
                </label>
                <input
                  type="number"
                  value={editingModel.max_tokens || 8192}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, max_tokens: parseInt(e.target.value) || 8192 })
                  }
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* supports_prompt_caching */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="supports_prompt_caching"
                  checked={editingModel.supports_prompt_caching || false}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, supports_prompt_caching: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
                />
                <label
                  htmlFor="supports_prompt_caching"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                >
                  支持提示词缓存
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveModel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FactoryConfigEditor;
