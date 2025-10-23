import React, { useState, useEffect } from "react";
import { Trash2, Edit3, RefreshCw, FileJson } from "lucide-react";
import { buttonStyles, cardStyles, cn } from "../lib/styles";

interface FactoryCustomModel {
  model_display_name: string;
  model: string;
  base_url: string;
  api_key: string;
  provider?: string;
  max_tokens?: number;
  supports_prompt_caching?: boolean;
}

interface FactoryModelsListProps {
  onNotify?: (message: string, type: "success" | "error") => void;
}

const FactoryModelsList: React.FC<FactoryModelsListProps> = ({ onNotify }) => {
  const [models, setModels] = useState<FactoryCustomModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingModel, setEditingModel] = useState<FactoryCustomModel | null>(
    null,
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 加载 Factory 自定义模型
  const loadFactoryModels = async () => {
    setLoading(true);
    try {
      const factoryModels = await window.api.getFactoryCustomModels();
      setModels(factoryModels);
    } catch (error) {
      console.error("Failed to load Factory models:", error);
      onNotify?.("加载 Factory 模型失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 删除模型
  const handleDelete = async (modelDisplayName: string) => {
    if (!confirm(`确定要删除 "${modelDisplayName}" 吗？`)) return;

    try {
      await window.api.deleteFactoryCustomModel(modelDisplayName);
      await loadFactoryModels();
      onNotify?.("模型已删除", "success");
    } catch (error) {
      console.error("Failed to delete model:", error);
      onNotify?.("删除失败", "error");
    }
  };

  // 编辑模型
  const handleEdit = (model: FactoryCustomModel) => {
    setEditingModel(model);
    setIsEditModalOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingModel) return;

    try {
      // 这里应该有一个编辑表单，暂时简化处理
      await window.api.updateFactoryCustomModel(
        editingModel.model_display_name,
        editingModel,
      );
      await loadFactoryModels();
      setIsEditModalOpen(false);
      setEditingModel(null);
      onNotify?.("模型已更新", "success");
    } catch (error) {
      console.error("Failed to update model:", error);
      onNotify?.("更新失败", "error");
    }
  };

  // 初始加载
  useEffect(() => {
    loadFactoryModels();
  }, []);

  if (models.length === 0 && !loading) {
    return null; // 没有Factory配置时不显示
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileJson size={20} className="text-blue-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Factory 配置的模型
          </h3>
        </div>
        <button
          onClick={loadFactoryModels}
          disabled={loading}
          className={buttonStyles.icon}
          title="刷新"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-3">
        {models.map((model) => (
          <div
            key={model.model_display_name}
            className={cn(
              cardStyles.interactive,
              "bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/20",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {model.model_display_name}
                  </h4>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                    Factory Config
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="font-medium">模型 ID:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                      {model.model}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Base URL:</span>
                    <span className="text-gray-900 dark:text-gray-100 text-xs truncate max-w-xs">
                      {model.base_url}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="font-medium">API Key:</span>
                    <span className="font-mono text-gray-500 dark:text-gray-400 text-xs">
                      {model.api_key.slice(0, 10)}...{model.api_key.slice(-6)}
                    </span>
                  </div>

                  {model.supports_prompt_caching && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      ✓ 支持 Prompt Caching
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEdit(model)}
                  className={buttonStyles.icon}
                  title="编辑"
                >
                  <Edit3 size={16} />
                </button>

                <button
                  onClick={() => handleDelete(model.model_display_name)}
                  className={cn(
                    buttonStyles.icon,
                    "text-gray-500 hover:text-red-500 hover:bg-red-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10",
                  )}
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 简单的编辑模态框 */}
      {isEditModalOpen && editingModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">编辑模型</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  显示名称
                </label>
                <input
                  type="text"
                  value={editingModel.model_display_name}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      model_display_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={editingModel.api_key}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      api_key: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingModel(null);
                }}
                className={buttonStyles.secondary}
              >
                取消
              </button>
              <button onClick={handleSaveEdit} className={buttonStyles.primary}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryModelsList;
