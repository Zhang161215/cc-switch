import { useEffect, useState } from "react";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { BackupStatus } from "../lib/tauri-api";

export function BackupStatusBadge() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackupStatus();
  }, []);

  const loadBackupStatus = async () => {
    try {
      const result = await window.api.getBackupStatus();
      setStatus(result);
    } catch (error) {
      console.error("获取备份状态失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return `今天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return `昨天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    }

    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (loading || !status) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
        <Shield size={14} className="text-gray-400 animate-pulse" />
        <span className="text-xs text-gray-500">检查中...</span>
      </div>
    );
  }

  const tooltipContent = status.last_backup
    ? `上次备份: ${formatDate(status.last_backup.timestamp)}\n大小: ${formatFileSize(status.last_backup.file_size)}\n共 ${status.total_backups} 个备份`
    : "暂无备份";

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-help ${
        status.has_today_backup
          ? "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
          : "bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
      }`}
      title={tooltipContent}
    >
      {status.has_today_backup ? (
        <ShieldCheck size={14} className="text-green-600 dark:text-green-400" />
      ) : (
        <ShieldAlert
          size={14}
          className="text-yellow-600 dark:text-yellow-400"
        />
      )}
      <span
        className={`text-xs font-medium ${
          status.has_today_backup
            ? "text-green-700 dark:text-green-300"
            : "text-yellow-700 dark:text-yellow-300"
        }`}
      >
        {status.has_today_backup ? "已备份" : "待备份"}
      </span>
    </div>
  );
}
