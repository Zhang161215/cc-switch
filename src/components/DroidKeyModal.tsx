import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DroidProvider, ApiKeyInfo, SwitchStrategy } from "../types";
import { droidProviderPresets } from "../config/droidProviderPresets";
import { X, ChevronDown, Sparkles } from "lucide-react";
import MultiKeyManager from "./MultiKeyManager";

interface DroidKeyModalProps {
  provider?: DroidProvider;
  onSubmit: (provider: DroidProvider) => void;
  onClose: () => void;
}

const DroidKeyModal: React.FC<DroidKeyModalProps> = ({
  provider,
  onSubmit,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  
  // 检查是否应该显示多key模式
  const shouldShowMultiKey = provider && provider.api_keys && provider.api_keys.length > 0;
  const [showMultiKey, setShowMultiKey] = useState(shouldShowMultiKey || false);
  
  const [formData, setFormData] = useState<DroidProvider>(
    provider || {
      id: "",
      name: "",
      api_key: "",
      api_keys: [],
      current_key_index: 0,
      switch_strategy: "manual" as SwitchStrategy,
      base_url: "https://droid2api-2st1n.sevalla.app",
      model: "claude-sonnet-4-5-20250929",
      model_display_name: "Sonnet 4.5 [droid]",
      provider: "anthropic",
      max_tokens: 200000,
      supports_prompt_caching: true
    }
  );

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = droidProviderPresets.find(p => p.name === presetName);
    if (preset) {
      setFormData({
        ...formData,
        name: preset.name,
        base_url: preset.base_url,
        model: preset.model,
        model_display_name: preset.model_display_name,
        provider: preset.provider,
        max_tokens: preset.max_tokens,
        supports_prompt_caching: preset.supports_prompt_caching,
      });
    }
  };

  const handleInputChange = (field: keyof DroidProvider, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 如果使用多Key模式，确保至少有一个key
    if (showMultiKey) {
      if (formData.name && formData.api_keys && formData.api_keys.length > 0) {
        // 设置主key为当前激活的key
        const finalData = {
          ...formData,
          api_key: formData.api_keys[formData.current_key_index || 0]?.key || ""
        };
        onSubmit(finalData);
      }
    } else {
      // 单Key模式
      if (formData.name && formData.api_key) {
        // 将单个key转换为api_keys数组
        const finalData = {
          ...formData,
          api_keys: [{
            id: "1",
            key: formData.api_key,
            name: "主Key",
            is_active: true
          }],
          current_key_index: 0,
          switch_strategy: "manual" as SwitchStrategy
        };
        onSubmit(finalData);
      }
    }
  };
  
  // 处理多Key操作
  const handleAddKey = (key: ApiKeyInfo) => {
    const newKeys = [...(formData.api_keys || []), key];
    setFormData({ ...formData, api_keys: newKeys });
  };

  const handleRemoveKey = (keyId: string) => {
    const newKeys = (formData.api_keys || []).filter(k => k.id !== keyId);
    setFormData({ 
      ...formData, 
      api_keys: newKeys,
      current_key_index: Math.min(formData.current_key_index || 0, newKeys.length - 1)
    });
  };

  const handleSelectKey = (index: number) => {
    setFormData({ ...formData, current_key_index: index });
  };

  const handleUpdateStrategy = (strategy: SwitchStrategy) => {
    setFormData({ ...formData, switch_strategy: strategy });
  };

  const handleRefreshBalances = async () => {
    if (!formData.api_keys || formData.api_keys.length === 0) return;
    
    try {
      // 提取所有的API Keys
      const apiKeys = formData.api_keys.map(k => k.key);
      
      // 批量查询余额
      const balances = await window.api.fetchMultipleDroidBalances(apiKeys);
      
      // 更新每个Key的余额信息
      const updatedKeys = formData.api_keys.map((key, index) => {
        const balanceData = balances[index];
        if (balanceData && balanceData !== null) {
          const totalAllowance = balanceData.totalAllowance || 0;
          const totalUsed = balanceData.totalUsed || 0;
          const remaining = totalAllowance - totalUsed;
          const usedRatio = totalAllowance > 0 ? totalUsed / totalAllowance : 0;
          
          return {
            ...key,
            balance: {
              totalAllowance,
              totalUsed,
              remaining,
              usedRatio,
              last_checked: Date.now()
            }
          };
        }
        return key;
      });
      
      setFormData({ ...formData, api_keys: updatedKeys });
    } catch (error) {
      console.error("Failed to refresh balances:", error);
    }
  };

  const isEditing = !!provider;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? "编辑 Droid Key" : "添加 Droid Key"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {!isEditing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-500 dark:text-blue-400" />
                    配置预设
                  </h3>
                </div>
                <div className="relative">
                  <select
                    value={selectedPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  >
                    <option value="">-- 请选择配置预设 --</option>
                    {droidProviderPresets.map((preset) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none"
                  />
                </div>
                {selectedPreset && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      已选择预设：<span className="font-medium">{selectedPreset}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 基础信息 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                基础信息
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  required
                  placeholder="例如：Droid Production"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    API Key 管理 <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!showMultiKey && !formData.api_keys?.length && formData.api_key) {
                        // 切换到多Key模式时，将单个key转为api_keys数组
                        setFormData({
                          ...formData,
                          api_keys: [{
                            id: "1",
                            key: formData.api_key,
                            name: "主Key",
                            is_active: true
                          }]
                        });
                      }
                      setShowMultiKey(!showMultiKey);
                    }}
                    className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    disabled={showMultiKey && formData.api_keys && formData.api_keys.length > 1}
                    title={showMultiKey && formData.api_keys && formData.api_keys.length > 1 ? "有多个Key时不能切换到单Key模式" : ""}
                  >
                    {showMultiKey ? "切换到单Key" : "切换到多Key"}
                  </button>
                </div>
                
                {showMultiKey ? (
                  <MultiKeyManager
                    apiKeys={formData.api_keys || []}
                    currentKeyIndex={formData.current_key_index || 0}
                    switchStrategy={formData.switch_strategy || "manual"}
                    onAddKey={handleAddKey}
                    onRemoveKey={handleRemoveKey}
                    onSelectKey={handleSelectKey}
                    onUpdateStrategy={handleUpdateStrategy}
                    onRefreshBalances={handleRefreshBalances}
                  />
                ) : (
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => handleInputChange("api_key", e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    required={!showMultiKey}
                    placeholder="fk-..."
                  />
                )}
              </div>
            </div>

            {/* 高级配置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                高级配置
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => handleInputChange("base_url", e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="https://droid2api-2st1n.sevalla.app"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    模型
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => handleInputChange("model", e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="claude-3-5-sonnet-20241022"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    显示名称
                  </label>
                  <input
                    type="text"
                    value={formData.model_display_name}
                    onChange={(e) => handleInputChange("model_display_name", e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="Sonnet 3.5 [droid]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Provider
              </label>
              <div className="relative">
                <select
                  value={formData.provider}
                  onChange={(e) => handleInputChange("provider", e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                >
                  <option value="anthropic">anthropic</option>
                  <option value="openai">openai</option>
                  <option value="custom">custom</option>
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg transition-colors"
            >
              {isEditing ? t("common.save") : t("common.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DroidKeyModal;
