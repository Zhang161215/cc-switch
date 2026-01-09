import { useState, useEffect } from "react";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Plus,
  Save,
  X,
  Eye,
  EyeOff,
  Star,
} from "lucide-react";
import { FactoryCustomModelWithId } from "../types";
import { isLinux } from "../lib/platform";

interface FactoryConfigEditorProps {
  onNotify?: (
    message: string,
    type: "success" | "error",
    duration?: number,
  ) => void;
}

const FactoryConfigEditor: React.FC<FactoryConfigEditorProps> = ({
  onNotify,
}) => {
  const [models, setModels] = useState<FactoryCustomModelWithId[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<FactoryCustomModelWithId | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  // 加载配置
  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const customModels = await window.api.getFactoryCustomModelsWithId();
      setModels(customModels);
      // 加载默认模型
      const defaultModelId = await window.api.getDroidDefaultModel();
      setDefaultModel(defaultModelId);
    } catch (error) {
      console.error("加载 Factory 配置失败:", error);
      onNotify?.("加载配置失败", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 设置默认模型
  const handleSetDefaultModel = async (model: FactoryCustomModelWithId) => {
    setSavingDefault(true);
    try {
      await window.api.setDroidDefaultModel(model.id);
      setDefaultModel(model.id);
      onNotify?.(`已设置 ${model.displayName} 为默认模型`, "success");
    } catch (error) {
      onNotify?.(`设置失败: ${error}`, "error");
    } finally {
      setSavingDefault(false);
    }
  };

  // 获取默认模型显示名称
  const getDefaultModelName = (): string | null => {
    if (!defaultModel || models.length === 0) return null;
    const model = models.find(m => m.id === defaultModel);
    return model?.displayName || null;
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // 创建新模型的默认值
  const createEmptyModel = (index: number): FactoryCustomModelWithId => ({
    id: "",  // 将在保存时生成
    displayName: "",
    model: "",
    baseUrl: "",
    apiKey: "",
    provider: "anthropic",
    index: index,
    maxOutputTokens: 8192,
    noImageSupport: false,
  });

  // 打开添加模型对话框
  const handleAddModel = () => {
    setEditingModel(createEmptyModel(models.length));
    setEditingIndex(-1);
    setIsModalOpen(true);
  };

  // 打开编辑模型对话框
  const handleEditModel = (model: FactoryCustomModelWithId, index: number) => {
    setEditingModel({ ...model });
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  // 保存模型
  const handleSaveModel = async () => {
    if (!editingModel) return;

    // 验证必填字段
    if (
      !editingModel.displayName ||
      !editingModel.model ||
      !editingModel.baseUrl ||
      !editingModel.apiKey ||
      !editingModel.provider
    ) {
      onNotify?.("请填写所有必填字段", "error");
      return;
    }

    try {
      const newModels = [...models];
      
      if (editingIndex >= 0) {
        // 编辑现有模型 - 保持原有 id
        newModels[editingIndex] = {
          ...editingModel,
          index: editingIndex,
        };
      } else {
        // 添加新模型 - 生成新 id
        const newIndex = models.length;
        const newModel: FactoryCustomModelWithId = {
          ...editingModel,
          id: `custom:${editingModel.displayName}-${newIndex}`,
          index: newIndex,
        };
        newModels.push(newModel);
      }

      await window.api.saveFactoryCustomModels(newModels);
      setModels(newModels);
      setIsModalOpen(false);
      onNotify?.("模型配置已保存", "success", 2000);
    } catch (error) {
      console.error("保存模型失败:", error);
      onNotify?.("保存失败", "error");
    }
  };

  // 删除模型
  const handleDeleteModel = async (index: number) => {
    if (!window.confirm("确定要删除这个模型配置吗？")) return;

    try {
      const newModels = models.filter((_, i) => i !== index);
      // 重新分配 index
      const reindexedModels = newModels.map((m, i) => ({
        ...m,
        index: i,
        id: `custom:${m.displayName}-${i}`,
      }));
      
      await window.api.saveFactoryCustomModels(reindexedModels);
      setModels(reindexedModels);
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

  const defaultModelName = getDefaultModelName();

  return (
    <>
      <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* 标题栏 */}
        <button
          className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Settings className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-shrink-0">
              Factory 自定义模型配置
            </span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded flex-shrink-0">
              {models.length} 个
            </span>
            {defaultModelName && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded truncate">
                默认: {defaultModelName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </button>

        {/* 展开内容 */}
        {isExpanded && (
          <div className="p-3 pt-0 border-t border-gray-200 dark:border-gray-700">
            {/* 添加模型按钮 */}
            <div className="flex justify-end mb-3 mt-3">
              <button
                onClick={handleAddModel}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加模型
              </button>
            </div>

            {/* 模型列表 */}
            {models.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                暂无自定义模型配置
              </div>
            ) : (
              <div className="space-y-2">
                {models.map((model, index) => {
                  const isDefault = defaultModel === model.id;
                  return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      isDefault 
                        ? "border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10" 
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {model.displayName}
                        </span>
                        {isDefault && (
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            默认
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {model.provider} · {model.model}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {model.baseUrl}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {!isDefault && (
                        <button
                          onClick={() => handleSetDefaultModel(model)}
                          disabled={savingDefault}
                          className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 rounded-md transition-colors"
                          title="设为默认"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 模型编辑对话框 */}
      {isModalOpen && editingModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 ${isLinux() ? "max-h-[80vh] overflow-y-auto" : ""}`}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingIndex >= 0 ? "编辑模型" : "添加模型"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 显示名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  显示名称 *
                </label>
                <input
                  type="text"
                  value={editingModel.displayName}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      displayName: e.target.value,
                    })
                  }
                  placeholder="例如: Claude Opus 4.5"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* 模型 ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  模型 ID *
                </label>
                <input
                  type="text"
                  value={editingModel.model}
                  onChange={(e) =>
                    setEditingModel({ ...editingModel, model: e.target.value })
                  }
                  placeholder="例如: claude-opus-4-5-20251101"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base URL *
                </label>
                <input
                  type="text"
                  value={editingModel.baseUrl}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      baseUrl: e.target.value,
                    })
                  }
                  placeholder="例如: https://api.anthropic.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={editingModel.apiKey}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        apiKey: e.target.value,
                      })
                    }
                    placeholder="输入 API Key"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Provider *
                </label>
                <select
                  value={editingModel.provider}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      provider: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="generic-chat-completion-api">Generic Chat Completion</option>
                </select>
              </div>

              {/* Max Output Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  最大输出 Tokens
                </label>
                <input
                  type="number"
                  value={editingModel.maxOutputTokens || ""}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      maxOutputTokens: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="例如: 8192"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveModel}
                className="flex items-center gap-1 px-4 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors"
              >
                <Save className="h-4 w-4" />
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
