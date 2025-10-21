import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DroidProvider } from "../types";
import { X, Eye, EyeOff, ListPlus, Plus } from "lucide-react";
import { buttonStyles, cn } from "../lib/styles";

interface DroidKeyModalProps {
  provider?: DroidProvider;
  onSubmit: (provider: DroidProvider) => void;
  onBatchSubmit?: (providers: DroidProvider[]) => void; // 新增批量提交回调
  onClose: () => void;
}

const DroidKeyModal: React.FC<DroidKeyModalProps> = ({
  provider,
  onSubmit,
  onBatchSubmit,
  onClose,
}) => {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false); // 批量模式切换
  const [batchKeysText, setBatchKeysText] = useState("");
  const [batchAddResults, setBatchAddResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const [formData, setFormData] = useState<DroidProvider>(
    provider || {
      id: "",
      name: "",
      api_key: ""
    }
  );

  const handleInputChange = (field: keyof DroidProvider, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.api_key) {
      // 如果名称为空，自动生成默认名称（fk-后六位）
      const finalData = {
        ...formData,
        name: formData.name.trim() || `fk-${formData.api_key.slice(-6)}`
      };
      console.log("[DroidKeyModal] Submitting data:", finalData);
      onSubmit(finalData);
    }
  };

  // 批量添加处理
  const handleBatchSubmit = () => {
    setBatchAddResults(null);

    // 按行分割，支持多种换行符
    const lines = batchKeysText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
      setBatchAddResults({
        success: 0,
        failed: 0,
        errors: ["请输入至少一个 API Key"]
      });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    const validProviders: DroidProvider[] = [];
    const seenKeys = new Set<string>();

    lines.forEach((line, index) => {
      // 支持两种格式：
      // 1. 仅 API Key：fk-xxxxx
      // 2. 名称+API Key：主Key,fk-xxxxx 或 主Key fk-xxxxx
      const parts = line.split(/[,\s]+/).filter(p => p.length > 0);

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
        results.errors.push(`第 ${index + 1} 行：API Key 格式错误（应以 fk- 开���）`);
        return;
      }

      // 检查批量中的重复
      if (seenKeys.has(key)) {
        results.failed++;
        results.errors.push(`第 ${index + 1} 行：API Key 重复`);
        return;
      }

      seenKeys.add(key);

      // 生成默认名称
      const finalName = name || `fk-${key.slice(-6)}`;

      const newProvider: DroidProvider = {
        id: `${Date.now()}-${validProviders.length}`,
        api_key: key,
        name: finalName,
      };

      validProviders.push(newProvider);
      results.success++;
    });

    setBatchAddResults(results);

    // 如果有成功的，调用批量提交
    if (validProviders.length > 0 && onBatchSubmit) {
      onBatchSubmit(validProviders);

      // 如果全部成功，延迟关闭
      if (results.failed === 0) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
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
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {isEditing ? "编辑 Droid Key" : "添加 Droid Key"}
            </h2>
            {/* 批量模式切换按钮（仅在新增模式显示） */}
            {!isEditing && onBatchSubmit && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchMode(false);
                    setBatchAddResults(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md transition-colors",
                    !isBatchMode
                      ? "bg-blue-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                >
                  <Plus size={14} />
                  单个添加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchMode(true);
                    setBatchAddResults(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md transition-colors",
                    isBatchMode
                      ? "bg-purple-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                >
                  <ListPlus size={14} />
                  批量添加
                </button>
              </div>
            )}
          </div>
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
        {!isBatchMode ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* 基础信息 */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                  基础信息
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    名称（可选）
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="留空则显示为 fk-后六位"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={formData.api_key}
                      onChange={(e) => handleInputChange("api_key", e.target.value)}
                      className="w-full px-3 py-2 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                      required
                      placeholder="fk-..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                      aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  API Keys（每行一个）
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 space-y-1">
                  <p>支持以下格式：</p>
                  <ul className="list-disc list-inside pl-2">
                    <li>仅 API Key：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">fk-xxxxx</code></li>
                    <li>名称 + API Key：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">主Key fk-xxxxx</code> 或 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">主Key,fk-xxxxx</code></li>
                  </ul>
                </div>
                <textarea
                  value={batchKeysText}
                  onChange={(e) => setBatchKeysText(e.target.value)}
                  placeholder={"示例：\nfk-abc123def456\n备用Key fk-xyz789uvw012\n主Key,fk-123456789abc"}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 font-mono text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 focus:border-purple-500 dark:focus:border-purple-400 transition-colors"
                />
              </div>

              {/* 添加结果显示 */}
              {batchAddResults && (
                <div className={cn(
                  "p-4 rounded-lg border",
                  batchAddResults.failed === 0
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-sm font-medium",
                      batchAddResults.failed === 0
                        ? "text-green-700 dark:text-green-400"
                        : "text-yellow-700 dark:text-yellow-400"
                    )}>
                      添加结果
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      成功：<span className="font-semibold text-green-600 dark:text-green-400">{batchAddResults.success}</span> 个
                    </p>
                    {batchAddResults.failed > 0 && (
                      <>
                        <p className="text-gray-700 dark:text-gray-300">
                          失败：<span className="font-semibold text-red-600 dark:text-red-400">{batchAddResults.failed}</span> 个
                        </p>
                        {batchAddResults.errors.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">错误详情：</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
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

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <button
                type="button"
                onClick={onClose}
                className={buttonStyles.secondary}
              >
                {batchAddResults?.failed === 0 ? "完成" : t("common.cancel")}
              </button>
              {(!batchAddResults || batchAddResults.failed > 0) && (
                <button
                  type="button"
                  onClick={handleBatchSubmit}
                  disabled={!batchKeysText.trim()}
                  className={cn(
                    "px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 rounded-lg transition-colors",
                    !batchKeysText.trim() && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {batchAddResults ? "重试" : "批量添加"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DroidKeyModal;
