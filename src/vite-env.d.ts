/// <reference types="vite/client" />

import {
  Provider,
  Settings,
  CustomEndpoint,
  McpStatus,
  McpConfigResponse,
  McpServer,
  McpServerSpec,
  DroidProvider,
} from "./types";
import { AppType } from "./lib/tauri-api";
import type { UnlistenFn } from "@tauri-apps/api/event";

interface ImportResult {
  success: boolean;
  message?: string;
}

interface ConfigStatus {
  exists: boolean;
  path: string;
  error?: string;
}

declare global {
  interface Window {
    api: {
      getProviders: (app?: AppType) => Promise<Record<string, Provider>>;
      getCurrentProvider: (app?: AppType) => Promise<string>;
      addProvider: (provider: Provider, app?: AppType) => Promise<boolean>;
      deleteProvider: (id: string, app?: AppType) => Promise<boolean>;
      updateProvider: (provider: Provider, app?: AppType) => Promise<boolean>;
      switchProvider: (providerId: string, app?: AppType) => Promise<boolean>;
      importCurrentConfigAsDefault: (app?: AppType) => Promise<ImportResult>;
      getClaudeCodeConfigPath: () => Promise<string>;
      getClaudeConfigStatus: () => Promise<ConfigStatus>;
      getConfigStatus: (app?: AppType) => Promise<ConfigStatus>;
      getConfigDir: (app?: AppType) => Promise<string>;
      saveFileDialog: (defaultName: string) => Promise<string | null>;
      openFileDialog: () => Promise<string | null>;
      exportConfigToFile: (filePath: string) => Promise<{
        success: boolean;
        message: string;
        filePath: string;
      }>;
      importConfigFromFile: (filePath: string) => Promise<{
        success: boolean;
        message: string;
        backupId?: string;
      }>;
      selectConfigDirectory: (defaultPath?: string) => Promise<string | null>;
      openConfigFolder: (app?: AppType) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      updateTrayMenu: () => Promise<boolean>;
      onProviderSwitched: (
        callback: (data: { appType: string; providerId: string }) => void,
      ) => Promise<UnlistenFn>;
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<boolean>;
      checkForUpdates: () => Promise<void>;
      isPortable: () => Promise<boolean>;
      getAppConfigPath: () => Promise<string>;
      openAppConfigFolder: () => Promise<void>;
      // Claude 插件配置能力
      getClaudePluginStatus: () => Promise<ConfigStatus>;
      readClaudePluginConfig: () => Promise<string | null>;
      applyClaudePluginConfig: (options: {
        official: boolean;
      }) => Promise<boolean>;
      isClaudePluginApplied: () => Promise<boolean>;
      // Claude MCP
      getClaudeMcpStatus: () => Promise<McpStatus>;
      readClaudeMcpConfig: () => Promise<string | null>;
      upsertClaudeMcpServer: (
        id: string,
        spec: McpServerSpec | Record<string, any>,
      ) => Promise<boolean>;
      deleteClaudeMcpServer: (id: string) => Promise<boolean>;
      validateMcpCommand: (cmd: string) => Promise<boolean>;
      // 新：config.json 为 SSOT 的 MCP API
      getMcpConfig: (app?: AppType) => Promise<McpConfigResponse>;
      upsertMcpServerInConfig: (
        app: AppType | undefined,
        id: string,
        spec: McpServer,
        options?: { syncOtherSide?: boolean },
      ) => Promise<boolean>;
      deleteMcpServerInConfig: (
        app: AppType | undefined,
        id: string,
      ) => Promise<boolean>;
      setMcpEnabled: (
        app: AppType | undefined,
        id: string,
        enabled: boolean,
      ) => Promise<boolean>;
      syncEnabledMcpToClaude: () => Promise<boolean>;
      syncEnabledMcpToCodex: () => Promise<boolean>;
      importMcpFromClaude: () => Promise<number>;
      importMcpFromCodex: () => Promise<number>;
      importMcpFromDroid: () => Promise<number>;
      // 读取当前生效（live）的 provider settings（根据 appType）
      // Codex: { auth: object, config: string }
      // Claude: settings.json 内容
      getLiveProviderSettings: (app?: AppType) => Promise<any>;
      testApiEndpoints: (
        urls: string[],
        options?: { timeoutSecs?: number },
      ) => Promise<
        Array<{
          url: string;
          latency: number | null;
          status?: number;
          error?: string;
        }>
      >;
      // 自定义端点管理
      getCustomEndpoints: (
        appType: AppType,
        providerId: string,
      ) => Promise<CustomEndpoint[]>;
      addCustomEndpoint: (
        appType: AppType,
        providerId: string,
        url: string,
      ) => Promise<void>;
      removeCustomEndpoint: (
        appType: AppType,
        providerId: string,
        url: string,
      ) => Promise<void>;
      updateEndpointLastUsed: (
        appType: AppType,
        providerId: string,
        url: string,
      ) => Promise<void>;
      // Droid 配置管理
      getDroidProviders: () => Promise<DroidProvider[]>;
      getCurrentDroidProvider: () => Promise<string>;
      addDroidProvider: (provider: DroidProvider) => Promise<boolean>;
      updateDroidProvider: (provider: DroidProvider) => Promise<boolean>;
      deleteDroidProvider: (id: string) => Promise<boolean>;
      switchDroidProvider: (id: string) => Promise<boolean>;
      setFactoryApiKeyEnv: (apiKey: string) => Promise<boolean>;
      getFactoryApiKeyEnv: () => Promise<string | null>;
      removeFactoryApiKeyEnv: () => Promise<boolean>;
      fetchDroidBalance: (apiKey: string) => Promise<any>;
    fetchMultipleDroidBalances: (apiKeys: string[]) => Promise<any[]>;
    autoSwitchDroidKey: (providerId: string) => Promise<number>;
    getFactoryConfig: () => Promise<import("./types").DroidConfig>;
    saveFactoryConfig: (config: import("./types").DroidConfig) => Promise<void>;
    getFactoryCustomModels: () => Promise<any[]>;
    deleteFactoryCustomModel: (modelDisplayName: string) => Promise<void>;
    updateFactoryCustomModel: (oldDisplayName: string, model: any) => Promise<void>;
    // Droid 会话历史管理
    getDroidSessions: () => Promise<import("./types").DroidSession[]>;
    getDroidSessionCommand: (sessionId: string, workingDir?: string) => Promise<string>;
    copyToClipboard: (text: string) => Promise<void>;
    openDroidInTerminal: (sessionId: string, workingDir?: string) => Promise<void>;
    deleteDroidSession: (sessionId: string) => Promise<void>;
    };
    platform: {
      isMac: boolean;
    };
    __TAURI__?: any;
  }
}

export {};
