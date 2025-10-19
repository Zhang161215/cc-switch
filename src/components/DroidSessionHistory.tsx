import { useState, useEffect } from "react";
import { DroidSession } from "../types";
import { History, Terminal, Copy, Check, Clock, Zap, Trash2, AlertTriangle } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 加载会话历史
  const loadSessions = async () => {
    setLoading(true);
    try {
      const result = await window.api.getDroidSessions();
      setSessions(result);
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
    }
  }, [isOpen]);

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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          buttonStyles.secondary,
          "flex items-center gap-2"
        )}
      >
        <History size={16} />
        会话历史
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <History size={24} className="text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                会话历史
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                选择会话打开或复制命令
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    cardStyles.interactive,
                    "p-3"
                  )}
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
                            输入: {formatTokens(session.token_usage.input_tokens)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap size={11} className="text-green-500" />
                            输出: {formatTokens(session.token_usage.output_tokens)}
                          </span>
                          {session.token_usage.cache_read_tokens && session.token_usage.cache_read_tokens > 0 && (
                            <span className="flex items-center gap-1">
                              <Zap size={11} className="text-blue-500" />
                              缓存: {formatTokens(session.token_usage.cache_read_tokens)}
                            </span>
                          )}
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
                          "flex items-center gap-1 shadow-sm"
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
                          "flex items-center gap-1"
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            共 {sessions.length} 个会话
          </p>
          <div className="flex gap-3">
            <button
              onClick={loadSessions}
              disabled={loading}
              className={buttonStyles.secondary}
            >
              {loading ? "加载中..." : "刷新"}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className={buttonStyles.primary}
            >
              关闭
            </button>
          </div>
        </div>

        {/* 删除确认对话框 */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
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
                    "font-medium shadow-sm"
                  )}
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DroidSessionHistory;
