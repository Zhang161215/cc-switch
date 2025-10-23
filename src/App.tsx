import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Provider, DroidProvider } from "./types";
import { AppType } from "./lib/tauri-api";
import ProviderList from "./components/ProviderList";
import AddProviderModal from "./components/AddProviderModal";
import EditProviderModal from "./components/EditProviderModal";
import DroidProviderList, {
  DroidProviderListRef,
} from "./components/DroidProviderList";
import DroidKeyModal from "./components/DroidKeyModal";
import {
  FactoryEnvDisplay,
  FactoryEnvDisplayRef,
} from "./components/FactoryEnvDisplay";
import DroidSessionHistory from "./components/DroidSessionHistory";
import FactoryConfigEditor from "./components/FactoryConfigEditor";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AppSwitcher } from "./components/AppSwitcher";
import SettingsModal from "./components/SettingsModal";
import { UpdateBadge } from "./components/UpdateBadge";
import { Plus, Settings, Moon, Sun, Key } from "lucide-react";
import McpPanel from "./components/mcp/McpPanel";
import { buttonStyles } from "./lib/styles";
import { useDarkMode } from "./hooks/useDarkMode";
import { extractErrorMessage } from "./utils/errorUtils";

function App() {
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [activeApp, setActiveApp] = useState<AppType>("claude");
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [currentProviderId, setCurrentProviderId] = useState<string>("");
  const [droidProviders, setDroidProviders] = useState<DroidProvider[]>([]);
  const [currentDroidProviderId, setCurrentDroidProviderId] =
    useState<string>("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );
  const [editingDroidProvider, setEditingDroidProvider] =
    useState<DroidProvider | null>(null);
  const [isDroidKeyModalOpen, setIsDroidKeyModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const factoryEnvRef = useRef<FactoryEnvDisplayRef>(null);
  const droidProviderListRef = useRef<DroidProviderListRef>(null);

  // 设置通知的辅助函数
  const showNotification = (
    message: string,
    type: "success" | "error",
    duration = 3000,
  ) => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 立即显示通知
    setNotification({ message, type });
    setIsNotificationVisible(true);

    // 设置淡出定时器
    timeoutRef.current = setTimeout(() => {
      setIsNotificationVisible(false);
      // 等待淡出动画完成后清除通知
      setTimeout(() => {
        setNotification(null);
        timeoutRef.current = null;
      }, 300); // 与CSS动画时间匹配
    }, duration);
  };

  // 加载供应商列表
  useEffect(() => {
    loadProviders();
  }, [activeApp]); // 当切换应用时重新加载

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 监听托盘切换事件（包括菜单切换）
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await window.api.onProviderSwitched(async (data) => {
          if (import.meta.env.DEV) {
            console.log(t("console.providerSwitchReceived"), data);
          }

          // 如果当前应用类型匹配，则重新加载数据
          if (data.appType === activeApp) {
            await loadProviders();
          }

          // 若为 Claude，则同步插件配置
          if (data.appType === "claude") {
            await syncClaudePlugin(data.providerId, true);
          }
        });
      } catch (error) {
        console.error(t("console.setupListenerFailed"), error);
      }
    };

    setupListener();

    // 清理监听器
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [activeApp]);

  const loadProviders = async () => {
    if (activeApp === "droid") {
      // Droid 模式：加载 Droid 配置
      await loadDroidProviders();
    } else {
      const loadedProviders = await window.api.getProviders(activeApp);
      const currentId = await window.api.getCurrentProvider(activeApp);
      setProviders(loadedProviders);
      setCurrentProviderId(currentId);

      // 如果供应商列表为空，尝试自动从 live 导入一条默认供应商
      if (Object.keys(loadedProviders).length === 0) {
        await handleAutoImportDefault();
      }
    }
  };

  const loadDroidProviders = async () => {
    try {
      const providers = await window.api.getDroidProviders();

      // 优先从环境变量获取当前使用的 Key
      const envApiKey = await window.api.getFactoryApiKeyEnv();
      let currentId = "";

      if (envApiKey) {
        // 根据环境变量中的 API Key 找到对应的 provider
        const matchedProvider = providers.find((p) => p.api_key === envApiKey);
        if (matchedProvider) {
          currentId = matchedProvider.id;
          console.log(
            `从环境变量匹配到 provider: ${matchedProvider.name} (${currentId})`,
          );
        } else {
          console.warn("环境变量中的 API Key 在列表中未找到");
        }
      }

      // 如果环境变量没有匹配到，使用存储的 currentId
      if (!currentId) {
        currentId = await window.api.getCurrentDroidProvider();
        console.log(`使用存储的 currentId: ${currentId}`);
      }

      setDroidProviders(providers);
      setCurrentDroidProviderId(currentId);
    } catch (error) {
      console.error("加载 Droid 配置失败:", error);
    }
  };

  // 生成唯一ID
  const generateId = () => {
    return crypto.randomUUID();
  };

  const handleAddProvider = async (provider: Omit<Provider, "id">) => {
    const newProvider: Provider = {
      ...provider,
      id: generateId(),
      createdAt: Date.now(), // 添加创建时间戳
    };
    await window.api.addProvider(newProvider, activeApp);
    await loadProviders();
    setIsAddModalOpen(false);
    // 更新托盘菜单
    await window.api.updateTrayMenu();
  };

  const handleEditProvider = async (provider: Provider) => {
    try {
      await window.api.updateProvider(provider, activeApp);
      await loadProviders();
      setEditingProviderId(null);
      // 显示编辑成功提示
      showNotification(t("notifications.providerSaved"), "success", 2000);
      // 更新托盘菜单
      await window.api.updateTrayMenu();
    } catch (error) {
      console.error(t("console.updateProviderFailed"), error);
      setEditingProviderId(null);
      const errorMessage = extractErrorMessage(error);
      const message = errorMessage
        ? t("notifications.saveFailed", { error: errorMessage })
        : t("notifications.saveFailedGeneric");
      showNotification(message, "error", errorMessage ? 6000 : 3000);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    const provider = providers[id];
    setConfirmDialog({
      isOpen: true,
      title: t("confirm.deleteProvider"),
      message: t("confirm.deleteProviderMessage", { name: provider?.name }),
      onConfirm: async () => {
        await window.api.deleteProvider(id, activeApp);
        await loadProviders();
        setConfirmDialog(null);
        showNotification(t("notifications.providerDeleted"), "success");
        // 更新托盘菜单
        await window.api.updateTrayMenu();
      },
    });
  };

  // 同步 Claude 插件配置（按设置决定是否联动；开启时：非官方写入，官方移除）
  const syncClaudePlugin = async (providerId: string, silent = false) => {
    try {
      const settings = await window.api.getSettings();
      if (!(settings as any)?.enableClaudePluginIntegration) {
        // 未开启联动：不执行写入/移除
        return;
      }
      const provider = providers[providerId];
      if (!provider) return;
      const isOfficial = provider.category === "official";
      await window.api.applyClaudePluginConfig({ official: isOfficial });
      if (!silent) {
        showNotification(
          isOfficial
            ? t("notifications.removedFromClaudePlugin")
            : t("notifications.appliedToClaudePlugin"),
          "success",
          2000,
        );
      }
    } catch (error: any) {
      console.error("同步 Claude 插件失败:", error);
      if (!silent) {
        const message =
          error?.message || t("notifications.syncClaudePluginFailed");
        showNotification(message, "error", 5000);
      }
    }
  };

  const handleSwitchProvider = async (id: string) => {
    try {
      const success = await window.api.switchProvider(id, activeApp);
      if (success) {
        setCurrentProviderId(id);
        // 显示重启提示
        const appName = t(`apps.${activeApp}`);
        showNotification(
          t("notifications.switchSuccess", { appName }),
          "success",
          2000,
        );
        // 更新托盘菜单
        await window.api.updateTrayMenu();

        if (activeApp === "claude") {
          await syncClaudePlugin(id, true);
        }
      } else {
        showNotification(t("notifications.switchFailed"), "error");
      }
    } catch (error) {
      const detail = extractErrorMessage(error);
      const msg = detail
        ? `${t("notifications.switchFailed")}: ${detail}`
        : t("notifications.switchFailed");
      // 详细错误展示稍长时间，便于用户阅读
      showNotification(msg, "error", detail ? 6000 : 3000);
    }
  };

  const handleImportSuccess = async () => {
    await loadProviders();
    try {
      await window.api.updateTrayMenu();
    } catch (error) {
      console.error("[App] Failed to refresh tray menu after import", error);
    }
  };

  // 自动从 live 导入一条默认供应商（仅首次初始化时）
  const handleAutoImportDefault = async () => {
    try {
      const result = await window.api.importCurrentConfigAsDefault(activeApp);

      if (result.success) {
        await loadProviders();
        showNotification(t("notifications.autoImported"), "success", 3000);
        // 更新托盘菜单
        await window.api.updateTrayMenu();
      }
      // 如果导入失败（比如没有现有配置），静默处理，不显示错误
    } catch (error) {
      console.error(t("console.autoImportFailed"), error);
      // 静默处理，不影响用户体验
    }
  };

  // Droid 相关处理函数
  const handleAddDroidProvider = async (provider: DroidProvider) => {
    try {
      const newProvider = {
        ...provider,
        id: generateId(),
        createdAt: Date.now(),
      };
      await window.api.addDroidProvider(newProvider);
      await loadDroidProviders();
      setIsDroidKeyModalOpen(false);
      showNotification("Droid Key 添加成功", "success", 2000);

      // 添加成功后自动查询余额
      setTimeout(() => {
        if (droidProviderListRef.current) {
          droidProviderListRef.current.fetchBalance(newProvider.id);
        }
      }, 500);
    } catch (error) {
      console.error("添加 Droid Key 失败:", error);
      showNotification("添加失败", "error");
    }
  };

  // 批量添加 Droid Provider
  const handleBatchAddDroidProviders = async (providers: DroidProvider[]) => {
    try {
      const addedProviderIds: string[] = [];
      for (const provider of providers) {
        const newProvider = {
          ...provider,
          id: generateId(),
          createdAt: Date.now(),
        };
        await window.api.addDroidProvider(newProvider);
        addedProviderIds.push(newProvider.id);
      }
      await loadDroidProviders();
      showNotification(
        `成功添加 ${addedProviderIds.length} 个 Droid Key`,
        "success",
        2000,
      );

      // 批量添加成功后自动查询所有新增 Key 的余额
      setTimeout(() => {
        if (droidProviderListRef.current) {
          addedProviderIds.forEach((id) => {
            droidProviderListRef.current?.fetchBalance(id);
          });
        }
      }, 500);
    } catch (error) {
      console.error("批量添加 Droid Key 失败:", error);
      showNotification("批量添加失败", "error");
    }
  };

  const handleEditDroidProvider = (provider: DroidProvider) => {
    setEditingDroidProvider(provider);
    setIsDroidKeyModalOpen(true);
  };

  const handleUpdateDroidProvider = async (
    provider: DroidProvider,
    silent = false,
  ) => {
    try {
      console.log("[Frontend] Updating provider:", provider);
      await window.api.updateDroidProvider(provider);
      await loadDroidProviders();
      // 只在有编辑模态框时才关闭
      if (editingDroidProvider) {
        setEditingDroidProvider(null);
        setIsDroidKeyModalOpen(false);
        showNotification("Droid Key 更新成功", "success", 2000);
      } else if (!silent) {
        // 如果不是静默模式且不是编辑框触发的，才显示通知（比如手动切换模型）
        showNotification("配置已更新", "success", 1000);
      }
      // 如果是静默模式（比如自动刷新余额），不显示任何通知
    } catch (error) {
      console.error("更新 Droid Key 失败 - 详细错误:", error);
      console.error("错误类型:", typeof error);
      console.error("错误消息:", (error as any)?.message || error);
      if (!silent) {
        const errorMsg = (error as any)?.message || String(error) || "更新失败";
        showNotification(errorMsg, "error");
      }
    }
  };

  const handleDeleteDroidProvider = async (id: string) => {
    const provider = droidProviders.find((p) => p.id === id);
    setConfirmDialog({
      isOpen: true,
      title: "删除 Droid Key",
      message: `确定要删除 "${provider?.name}" 吗？`,
      onConfirm: async () => {
        try {
          await window.api.deleteDroidProvider(id);
          await loadDroidProviders();
          setConfirmDialog(null);
          showNotification("Droid Key 已删除", "success");
        } catch (error) {
          console.error("删除 Droid Key 失败:", error);
          showNotification("删除失败", "error");
        }
      },
    });
  };

  const handleSwitchDroidProvider = async (id: string) => {
    try {
      await window.api.switchDroidProvider(id);
      await loadDroidProviders();
      // 刷新环境变量显示
      factoryEnvRef.current?.refresh();
      // 自动查询余额
      if (droidProviderListRef.current) {
        await droidProviderListRef.current.fetchBalance(id);
      }
      showNotification("已切换 Droid Key", "success", 2000);
    } catch (error) {
      console.error("切换 Droid Key 失败:", error);
      const detail = extractErrorMessage(error);
      showNotification(detail || "切换失败", "error");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* 顶部导航区域 - 固定高度 */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Zhang161215/cc-switch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-semibold text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              title={t("header.viewOnGithub")}
            >
              CCD-Switch
            </a>
            <button
              onClick={toggleDarkMode}
              className={buttonStyles.icon}
              title={
                isDarkMode
                  ? t("header.toggleLightMode")
                  : t("header.toggleDarkMode")
              }
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className={buttonStyles.icon}
                title={t("common.settings")}
              >
                <Settings size={18} />
              </button>
              <UpdateBadge onClick={() => setIsSettingsOpen(true)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AppSwitcher activeApp={activeApp} onSwitch={setActiveApp} />

            <button
              onClick={() => setIsMcpOpen(true)}
              className="inline-flex items-center gap-2 px-7 py-2 text-sm font-medium rounded-lg transition-colors bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              MCP
            </button>

            <button
              onClick={() =>
                activeApp === "droid"
                  ? setIsDroidKeyModalOpen(true)
                  : setIsAddModalOpen(true)
              }
              className={`inline-flex items-center gap-2 ${buttonStyles.primary}`}
            >
              {activeApp === "droid" ? <Key size={16} /> : <Plus size={16} />}
              {activeApp === "droid" ? "添加 Key" : t("header.addProvider")}
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 独立滚动 */}
      <main className="flex-1 overflow-y-scroll">
        <div className="pt-3 px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            {/* 通知组件 - 相对于视窗定位 */}
            {notification && (
              <div
                className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[80] px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
                  notification.type === "error"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                } ${isNotificationVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
              >
                {notification.message}
              </div>
            )}

            {activeApp === "droid" ? (
              <>
                {/* 会话历史按钮 */}
                <div className="mb-4 flex justify-end">
                  <DroidSessionHistory onNotify={showNotification} />
                </div>

                <DroidProviderList
                  ref={droidProviderListRef}
                  providers={droidProviders}
                  currentProviderId={currentDroidProviderId}
                  onSwitch={handleSwitchDroidProvider}
                  onEdit={handleEditDroidProvider}
                  onDelete={handleDeleteDroidProvider}
                  onUpdate={handleUpdateDroidProvider}
                  onNotify={showNotification}
                />
                <FactoryEnvDisplay
                  ref={factoryEnvRef}
                  currentProviderId={currentDroidProviderId}
                />
                <FactoryConfigEditor onNotify={showNotification} />
              </>
            ) : (
              <ProviderList
                providers={providers}
                currentProviderId={currentProviderId}
                onSwitch={handleSwitchProvider}
                onDelete={handleDeleteProvider}
                onEdit={setEditingProviderId}
                onNotify={showNotification}
              />
            )}
          </div>
        </div>
      </main>

      {isAddModalOpen && (
        <AddProviderModal
          appType={activeApp}
          onAdd={handleAddProvider}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {editingProviderId && providers[editingProviderId] && (
        <EditProviderModal
          appType={activeApp}
          provider={providers[editingProviderId]}
          onSave={handleEditProvider}
          onClose={() => setEditingProviderId(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onImportSuccess={handleImportSuccess}
          onNotify={showNotification}
        />
      )}

      {isMcpOpen && (
        <McpPanel
          appType={activeApp}
          onClose={() => setIsMcpOpen(false)}
          onNotify={showNotification}
        />
      )}

      {isDroidKeyModalOpen && (
        <DroidKeyModal
          provider={editingDroidProvider || undefined}
          onSubmit={
            editingDroidProvider
              ? (provider) => handleUpdateDroidProvider(provider, false)
              : handleAddDroidProvider
          }
          onBatchSubmit={
            editingDroidProvider ? undefined : handleBatchAddDroidProviders
          }
          onClose={() => {
            setIsDroidKeyModalOpen(false);
            setEditingDroidProvider(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
