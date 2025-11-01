import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Provider } from "../types";
import {
  Play,
  Edit3,
  Trash2,
  CheckCircle2,
  Users,
  Check,
  RefreshCw,
  Zap,
  Copy,
} from "lucide-react";
import { buttonStyles, cardStyles, badgeStyles, cn } from "../lib/styles";
// 不再在列表中显示分类徽章，避免造成困惑

interface ProviderListProps {
  providers: Record<string, Provider>;
  currentProviderId: string;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onNotify?: (
    message: string,
    type: "success" | "error",
    duration?: number,
  ) => void;
}

// 延迟信息接口
interface LatencyInfo {
  latency: number | null;
  status?: number;
  error?: string;
  testing?: boolean;
}

// 右键菜单状态接口
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  provider: Provider | null;
}

const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  currentProviderId,
  onSwitch,
  onDelete,
  onEdit,
  onNotify,
}) => {
  const { t, i18n } = useTranslation();
  // 延迟信息状态
  const [latencies, setLatencies] = useState<Record<string, LatencyInfo>>({});
  // 用于跟踪是否已经执行过初始测速
  const hasInitialTestedRef = useRef(false);
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    provider: null,
  });

  // 提取API地址（兼容不同供应商配置：Claude env / Codex TOML）
  const getApiUrl = (provider: Provider): string => {
    try {
      const cfg = provider.settingsConfig;
      // Claude/Anthropic: 从 env 中读取
      if (cfg?.env?.ANTHROPIC_BASE_URL) {
        return cfg.env.ANTHROPIC_BASE_URL;
      }
      // Codex: 从 TOML 配置中解析 base_url
      if (typeof cfg?.config === "string" && cfg.config.includes("base_url")) {
        // 支持单/双引号
        const match = cfg.config.match(/base_url\s*=\s*(['"])([^'\"]+)\1/);
        if (match && match[2]) return match[2];
      }
      return t("provider.notConfigured");
    } catch {
      return t("provider.configError");
    }
  };

  const handleUrlClick = async (url: string) => {
    try {
      await window.api.openExternal(url);
    } catch (error) {
      console.error(t("console.openLinkFailed"), error);
      onNotify?.(
        `${t("console.openLinkFailed")}: ${String(error)}`,
        "error",
        4000,
      );
    }
  };

  // 复制 provider 配置到剪贴板
  const handleCopyConfig = async (provider: Provider) => {
    try {
      const configText = JSON.stringify(provider, null, 2);
      await navigator.clipboard.writeText(configText);
      onNotify?.(`已复制 ${provider.name} 的配置到剪贴板`, "success", 3000);
    } catch (error) {
      console.error("复制配置失败:", error);
      onNotify?.(`复制配置失败: ${String(error)}`, "error", 4000);
    }
  };

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, provider: Provider) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      provider,
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      provider: null,
    });
  };

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu.visible]);

  // 测试单个 provider 的延迟
  const testProviderLatency = async (
    providerId: string,
    provider: Provider,
  ) => {
    const apiUrl = getApiUrl(provider);

    // 检查是否是有效的 URL
    if (
      apiUrl === t("provider.notConfigured") ||
      apiUrl === t("provider.configError")
    ) {
      return;
    }

    // 设置测试中状态
    setLatencies((prev) => ({
      ...prev,
      [providerId]: { latency: null, testing: true },
    }));

    try {
      const results = await window.api.testApiEndpoints([apiUrl], {
        timeoutSecs: 8,
      });

      if (results && results.length > 0) {
        const result = results[0];
        setLatencies((prev) => ({
          ...prev,
          [providerId]: {
            latency:
              result.latency !== null ? Math.round(result.latency) : null,
            status: result.status,
            error: result.error || undefined,
            testing: false,
          },
        }));
      }
    } catch (error) {
      console.error("测试延迟失败:", error);
      setLatencies((prev) => ({
        ...prev,
        [providerId]: {
          latency: null,
          error: String(error),
          testing: false,
        },
      }));
    }
  };

  // 首次加载时自动测试所有 Provider 的延迟
  useEffect(() => {
    // 避免重复测试
    if (hasInitialTestedRef.current) return;

    const providerList = Object.values(providers);
    if (providerList.length === 0) return;

    // 标记已执行
    hasInitialTestedRef.current = true;

    // 批量测试所有 provider，添加小延迟避免并发过多
    const testAllProviders = async () => {
      for (let i = 0; i < providerList.length; i++) {
        const provider = providerList[i];
        // 每个测试之间间隔 200ms，避免同时发起太多请求
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        testProviderLatency(provider.id, provider);
      }
    };

    testAllProviders();
  }, [providers]); // eslint-disable-line react-hooks/exhaustive-deps

  // 列表页不再提供 Claude 插件按钮，统一在"设置"中控制

  // 对供应商列表进行排序
  const sortedProviders = Object.values(providers).sort((a, b) => {
    // 按添加时间排序
    // 没有时间戳的视为最早添加的（排在最前面）
    // 有时间戳的按时间升序排列
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;

    // 如果都没有时间戳，按名称排序
    if (timeA === 0 && timeB === 0) {
      const locale = i18n.language === "zh" ? "zh-CN" : "en-US";
      return a.name.localeCompare(b.name, locale);
    }

    // 如果只有一个没有时间戳，没有时间戳的排在前面
    if (timeA === 0) return -1;
    if (timeB === 0) return 1;

    // 都有时间戳，按时间升序
    return timeA - timeB;
  });

  return (
    <div className="space-y-4">
      {sortedProviders.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Users size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t("provider.noProviders")}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("provider.noProvidersDescription")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedProviders.map((provider) => {
            const isCurrent = provider.id === currentProviderId;
            const apiUrl = getApiUrl(provider);
            const latencyInfo = latencies[provider.id];

            return (
              <div
                key={provider.id}
                className={cn(
                  isCurrent ? cardStyles.selected : cardStyles.interactive,
                )}
                onContextMenu={(e) => handleContextMenu(e, provider)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {provider.name}
                      </h3>
                      {/* 分类徽章已移除 */}
                      <div
                        className={cn(
                          badgeStyles.success,
                          !isCurrent && "invisible",
                        )}
                      >
                        <CheckCircle2 size={12} />
                        {t("provider.currentlyUsing")}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {provider.websiteUrl ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleUrlClick(provider.websiteUrl!);
                          }}
                          className="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400 hover:opacity-90 transition-colors"
                          title={t("providerForm.visitWebsite", {
                            url: provider.websiteUrl,
                          })}
                        >
                          {provider.websiteUrl}
                        </button>
                      ) : (
                        <span
                          className="text-gray-500 dark:text-gray-400"
                          title={apiUrl}
                        >
                          {apiUrl}
                        </span>
                      )}
                      {/* 延迟显示 - 所有 provider 都可以测试 */}
                      <div className="inline-flex items-center gap-1.5">
                        {latencyInfo?.testing ? (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <RefreshCw size={12} className="animate-spin" />
                            <span>测试中...</span>
                          </div>
                        ) : latencyInfo?.latency !== null &&
                          latencyInfo?.latency !== undefined ? (
                          <div className="flex items-center gap-1">
                            <Zap
                              size={12}
                              className={cn(
                                "flex-shrink-0",
                                latencyInfo.latency < 300
                                  ? "text-green-600 dark:text-green-400"
                                  : latencyInfo.latency < 500
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : latencyInfo.latency < 800
                                      ? "text-orange-600 dark:text-orange-400"
                                      : "text-red-600 dark:text-red-400",
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-medium font-mono",
                                latencyInfo.latency < 300
                                  ? "text-green-600 dark:text-green-400"
                                  : latencyInfo.latency < 500
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : latencyInfo.latency < 800
                                      ? "text-orange-600 dark:text-orange-400"
                                      : "text-red-600 dark:text-red-400",
                              )}
                            >
                              {latencyInfo.latency}ms
                            </span>
                          </div>
                        ) : latencyInfo?.error ? (
                          <div className="text-xs text-red-500 dark:text-red-400">
                            延迟测试失败
                          </div>
                        ) : null}
                        {/* 刷新按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            testProviderLatency(provider.id, provider);
                          }}
                          disabled={latencyInfo?.testing}
                          className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="测试延迟"
                        >
                          <RefreshCw
                            size={14}
                            className={
                              latencyInfo?.testing ? "animate-spin" : ""
                            }
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onSwitch(provider.id)}
                      disabled={isCurrent}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors w-[90px] justify-center whitespace-nowrap",
                        isCurrent
                          ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                          : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
                      )}
                    >
                      {isCurrent ? <Check size={14} /> : <Play size={14} />}
                      {isCurrent ? t("provider.inUse") : t("provider.enable")}
                    </button>

                    <button
                      onClick={() => onEdit(provider.id)}
                      className={buttonStyles.icon}
                      title={t("provider.editProvider")}
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      onClick={() => onDelete(provider.id)}
                      disabled={isCurrent}
                      className={cn(
                        buttonStyles.icon,
                        isCurrent
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-500 hover:text-red-500 hover:bg-red-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10",
                      )}
                      title={t("provider.deleteProvider")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu.visible && contextMenu.provider && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            onClick={() => {
              handleCopyConfig(contextMenu.provider!);
              closeContextMenu();
            }}
          >
            <Copy size={14} />
            <span>复制配置</span>
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            onClick={() => {
              onEdit(contextMenu.provider!.id);
              closeContextMenu();
            }}
          >
            <Edit3 size={14} />
            <span>编辑</span>
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            onClick={() => {
              testProviderLatency(
                contextMenu.provider!.id,
                contextMenu.provider!,
              );
              closeContextMenu();
            }}
          >
            <RefreshCw size={14} />
            <span>测试延迟</span>
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"
            onClick={() => {
              onDelete(contextMenu.provider!.id);
              closeContextMenu();
            }}
            disabled={contextMenu.provider!.id === currentProviderId}
          >
            <Trash2 size={14} />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProviderList;
