import { useState, useEffect } from "react";
import { DroidCustomModel } from "../types";
import { Settings, Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/styles";

interface DroidDefaultModelSelectorProps {
  onNotify?: (message: string, type: "success" | "error") => void;
}

const REASONING_EFFORTS = [
  { value: "off", label: "关闭" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

const AUTONOMY_MODES = [
  { value: "auto-low", label: "低自主" },
  { value: "auto-high", label: "高自主" },
];

export default function DroidDefaultModelSelector({
  onNotify,
}: DroidDefaultModelSelectorProps) {
  const [customModels, setCustomModels] = useState<DroidCustomModel[]>([]);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [reasoningEffort, setReasoningEffort] = useState<string>("high");
  const [autonomyMode, setAutonomyMode] = useState<string>("auto-high");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [models, defaultModel] = await Promise.all([
        window.api.getFactoryCustomModels(),
        window.api.getDroidDefaultModel(),
      ]);
      setCustomModels(models);
      setCurrentModel(defaultModel);
      if (defaultModel) {
        setSelectedModel(defaultModel);
      }
    } catch (error) {
      console.error("加载模型数据失败:", error);
    }
  };

  const handleSave = async () => {
    if (!selectedModel) {
      onNotify?.("请选择一个模型", "error");
      return;
    }

    setLoading(true);
    try {
      await window.api.setDroidDefaultModel(
        selectedModel,
        reasoningEffort,
        autonomyMode,
      );
      setCurrentModel(selectedModel);
      onNotify?.("默认模型设置成功", "success");
      setIsOpen(false);
    } catch (error) {
      onNotify?.(`设置失败: ${error}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const getModelDisplayName = (modelId: string): string => {
    if (modelId.startsWith("custom:")) {
      const displayName = modelId.replace("custom:", "").replace(/-\d+$/, "");
      return displayName;
    }
    return modelId;
  };

  const buildModelId = (model: DroidCustomModel, index: number): string => {
    return `custom:${model.model_display_name}-${index}`;
  };

  if (customModels.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
          "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
          "hover:border-blue-300 dark:hover:border-blue-600",
        )}
      >
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            默认模型
          </span>
          {currentModel && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
              {getModelDisplayName(currentModel)}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "text-gray-400 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            {/* 模型选择 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                选择自定义模型
              </label>
              <div className="grid grid-cols-1 gap-2">
                {customModels.map((model, index) => {
                  const modelId = buildModelId(model, index);
                  const isSelected = selectedModel === modelId;
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedModel(modelId)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-600",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-medium truncate",
                            isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"
                          )}>
                            {model.model_display_name}
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {model.model}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded ml-2 flex-shrink-0">
                        {model.provider}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 推理级别 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                推理级别 (reasoningEffort)
              </label>
              <div className="flex gap-2">
                {REASONING_EFFORTS.map((effort) => (
                  <button
                    key={effort.value}
                    onClick={() => setReasoningEffort(effort.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md transition-all",
                      reasoningEffort === effort.value
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600",
                    )}
                  >
                    {effort.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自主模式 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                自主模式 (autonomyMode)
              </label>
              <div className="flex gap-2">
                {AUTONOMY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setAutonomyMode(mode.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md transition-all",
                      autonomyMode === mode.value
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600",
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={loading || !selectedModel}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  loading || !selectedModel
                    ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white",
                )}
              >
                <Check size={14} />
                {loading ? "保存中..." : "保存设置"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
