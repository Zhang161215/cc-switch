import { useState, useEffect } from "react";
import { DroidSession, FactoryCustomModelWithId } from "../types";
import {
  History,
  Terminal,
  Copy,
  Check,
  Clock,
  Zap,
  Trash2,
  AlertTriangle,
  Settings,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Folder,
} from "lucide-react";
import { buttonStyles, cardStyles, cn } from "../lib/styles";

interface DroidSessionHistoryProps {
  onNotify?: (message: string, type: "success" | "error") => void;
}

const DroidSessionHistory: React.FC<DroidSessionHistoryProps> = ({
  onNotify,
}) => {
  const [sessions, setSessions] = useState<DroidSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true); // 默认展开
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);
  const [customModels, setCustomModels] = useState<FactoryCustomModelWithId[]>([]);
  const [savingModel, setSavingModel] = useState(false);
  const [sessionModels, setSessionModels] = useState<Record<string, string>>({}); // 存储每个会话的当前模型

  // 加载会话历史
  const loadSessions = async () => {
    setLoading(true);
    try {
      const result = await window.api.getDroidSessions();
      setSessions(result);
      // 加载每个会话的模型设置
      const modelMap: Record<string, string> = {};
      for (const session of result.slice(0, 20)) { // 只加载前20个，避免太慢
        try {
          const settings = await window.api.getDroidSessionSettings(session.id);
          if (settings.model) {
            modelMap[session.id] = settings.model;
          }
        } catch {
          // 忽略单个会话的加载失败
        }
      }
      setSessionModels(modelMap);
    } catch (error) {
      onNotify?.(`加载会话历史失败: ${error}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (isOpen) {
      loadSessions();
      loadCustomModels();
    }
  }, [isOpen]);

  // 加载自定义模型（使用带 id 的版本）
  const loadCustomModels = async () => {
    try {
      const models = await window.api.getFactoryCustomModelsWithId();
      setCustomModels(models);
    } catch (error) {
      console.error("加载自定义模型失败:", error);
    }
  };

  // 切换展开会话设置
  const toggleSessionSettings = async (sessionId: string) => {
    if (expandedSettingsId === sessionId) {
      setExpandedSettingsId(null);
    } else {
      // 加载会话当前模型设置
      try {
        const settings = await window.api.getDroidSessionSettings(sessionId);
        if (settings.model) {
          setSessionModels(prev => ({ ...prev, [sessionId]: settings.model }));
        }
      } catch (error) {
        console.error("加载会话设置失败:", error);
      }
      setExpandedSettingsId(sessionId);
    }
  };

  // 直接设置会话模型（点击即保存）
  const setSessionModelDirectly = async (sessionId: string, model: FactoryCustomModelWithId) => {
    setSavingModel(true);
    try {
      // 根据 provider 自动设置 providerLock
      const providerLock = model.provider === "anthropic" ? "anthropic" : "openai";
      await window.api.setDroidSessionModel(
        sessionId,
        model.id,  // 直接使用 settings.json 中的完整 id
        providerLock,
        "high", // 默认高推理
        "auto-high", // 默认高自主
      );
      // 更新本地状态
      setSessionModels(prev => ({ ...prev, [sessionId]: model.id }));
      onNotify?.(`已设置为 ${model.displayName}`, "success");
      setExpandedSettingsId(null);
    } catch (error) {
      onNotify?.(`设置失败: ${error}`, "error");
    } finally {
      setSavingModel(false);
    }
  };

  // 复制命令到剪贴板
  const copyCommand = async (sessionId: string) => {
    try {
      // 获取恢复会话的命令（格式：droid exec -s SESSION_ID "继续上次的工作"）
      const command = await window.api.getDroidSessionCommand(sessionId);

      // 使用后端命令复制（避免前端权限问题）
      await window.api.copyToClipboard(command);

      setCopiedId(sessionId);
      onNotify?.(`命令已复制`, "success");

      // 3秒后重置复制状态
      setTimeout(() => setCopiedId(null), 3000);
    } catch (error) {
      onNotify?.(`复制命令失败: ${error}`, "error");
    }
  };

  // 在终端中打开会话
  const openInTerminal = async (sessionId: string) => {
    try {
      // 直接调用后端命令在 iTerm2/Terminal 中打开
      await window.api.openDroidInTerminal(sessionId);
      onNotify?.("已在终端中打开会话", "success");
    } catch (error) {
      // 如果打开失败，降级到复制命令
      console.warn("打开终端失败，降级到复制命令:", error);
      await copyCommand(sessionId);
      onNotify?.("已复制命令，请在终端中手动运行", "success");
    }
  };

  // 删除会话
  const deleteSession = async (sessionId: string) => {
    try {
      await window.api.deleteDroidSession(sessionId);
      onNotify?.("会话已删除", "success");
      // 重新加载会话列表
      await loadSessions();
      // 清除确认状态
      setDeleteConfirmId(null);
    } catch (error) {
      onNotify?.(`删除会话失败: ${error}`, "error");
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      // 小于1分钟
      if (diff < 60 * 1000) {
        return "刚刚";
      }
      // 小于1小时
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes}分钟前`;
      }
      // 小于1天
      if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours}小时前`;
      }
      // 小于7天
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}天前`;
      }
      // 显示完整日期
      return date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  // 格式化 Token 数量
  const formatTokens = (num?: number): string => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="mb-4">
      {/* 可折叠标题 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
          "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
          "hover:border-blue-300 dark:hover:border-blue-600",
        )}
      >
        <div className="flex items-center gap-2">
          <History size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            会话历史
          </span>
          {sessions.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              {sessions.length} 个
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {/* 可折叠内容 */}
      {isOpen && (
        <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* 刷新按钮 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              共 {sessions.length} 个会话
            </span>
            <button
              onClick={loadSessions}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                loading
                  ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
              )}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              刷新
            </button>
          </div>

          {/* 会话列表（固定高度可滚动） */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
              <History size={48} className="mb-2 opacity-50" />
              <p>暂无会话历史</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {sessions.map((session) => {
                const isExpanded = expandedSettingsId === session.id;
                return (
                <div
                  key={session.id}
                  className={cn(cardStyles.interactive, "p-3")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {session.title}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock size={11} />
                          {formatTime(session.timestamp)}
                        </span>
                        <button
                          onClick={() => setDeleteConfirmId(session.id)}
                          className="ml-2 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
                          title="删除会话"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {session.token_usage && (
                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Zap size={11} className="text-yellow-500" />
                            输入:{" "}
                            {formatTokens(session.token_usage.input_tokens)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap size={11} className="text-green-500" />
                            输出:{" "}
                            {formatTokens(session.token_usage.output_tokens)}
                          </span>
                          {session.token_usage.cache_read_tokens &&
                            session.token_usage.cache_read_tokens > 0 && (
                              <span className="flex items-center gap-1">
                                <Zap size={11} className="text-blue-500" />
                                缓存:{" "}
                                {formatTokens(
                                  session.token_usage.cache_read_tokens,
                                )}
                              </span>
                            )}
                        </div>
                      )}

                      {/* 工作目录 */}
                      {session.working_dir && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <Folder size={11} className="text-gray-400" />
                          <span className="truncate" title={session.working_dir}>
                            {session.working_dir}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 font-mono text-xs text-gray-400 dark:text-gray-500">
                        {session.id}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openInTerminal(session.id)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md transition-all",
                          "bg-blue-500 hover:bg-blue-600 text-white",
                          "flex items-center gap-1 shadow-sm",
                        )}
                        title="在终端中打开"
                      >
                        <Terminal size={12} />
                        <span>打开</span>
                      </button>
                      <button
                        onClick={() => copyCommand(session.id)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md transition-all",
                          "border border-gray-300 dark:border-gray-600",
                          "hover:bg-gray-50 dark:hover:bg-gray-700",
                          "flex items-center gap-1",
                        )}
                        title="复制会话ID"
                      >
                        {copiedId === session.id ? (
                          <Check size={12} className="text-green-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 可展开的模型设置区域 */}
                  <button
                    onClick={() => toggleSessionSettings(session.id)}
                    className={cn(
                      "w-full mt-2 flex items-center justify-between p-2 rounded-lg border transition-all",
                      isExpanded
                        ? "border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Settings size={14} className="text-blue-500" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        模型设置
                      </span>
                      {sessionModels[session.id] && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded truncate max-w-[120px]">
                          {sessionModels[session.id].replace(/^custom:/, '')}
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "text-gray-400 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {/* 展开的设置内容 - 点击模型即保存 */}
                  {isExpanded && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        选择模型（点击即设置）
                      </label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                        {customModels.map((model, index) => {
                          const isCurrentModel = sessionModels[session.id] === model.id;
                          return (
                            <button
                              key={index}
                              onClick={() => setSessionModelDirectly(session.id, model)}
                              disabled={savingModel}
                              className={cn(
                                "w-full flex items-center justify-between p-2 rounded-md border transition-all text-left",
                                isCurrentModel
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                                  : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                                savingModel && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              <span className={cn(
                                "text-xs font-medium truncate",
                                isCurrentModel ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"
                              )}>
                                {model.displayName}
                                {isCurrentModel && " ✓"}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded ml-2">
                                {model.provider}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {savingModel && (
                        <div className="text-xs text-center text-gray-500 mt-2">设置中...</div>
                      )}
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle
                  size={20}
                  className="text-red-600 dark:text-red-400"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  确认删除
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  确定要删除这个会话吗？此操作不可恢复。
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono">
                  {deleteConfirmId}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className={cn(buttonStyles.secondary, "px-4 py-2")}
              >
                取消
                </button>
              <button
                onClick={() => deleteSession(deleteConfirmId)}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all duration-200",
                  "bg-red-500 hover:bg-red-600 text-white",
                  "font-medium shadow-sm",
                )}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DroidSessionHistory;
