export type ProviderCategory =
  | "official" // 官方
  | "cn_official" // 国产官方
  | "aggregator" // 聚合网站
  | "third_party" // 第三方供应商
  | "custom"; // 自定义

export interface Provider {
  id: string;
  name: string;
  settingsConfig: Record<string, any>; // 应用配置对象：Claude 为 settings.json；Codex 为 { auth, config }
  websiteUrl?: string;
  // 新增：供应商分类（用于差异化提示/能力开关）
  category?: ProviderCategory;
  createdAt?: number; // 添加时间戳（毫秒）
  // 可选：供应商元数据（仅存于 ~/.cc-switch/config.json，不写入 live 配置）
  meta?: ProviderMeta;
}

export interface AppConfig {
  providers: Record<string, Provider>;
  current: string;
}

// 自定义端点配置
export interface CustomEndpoint {
  url: string;
  addedAt: number;
  lastUsed?: number;
}

// 供应商元数据（字段名与后端一致，保持 snake_case）
export interface ProviderMeta {
  // 自定义端点：以 URL 为键，值为端点信息
  custom_endpoints?: Record<string, CustomEndpoint>;
}

// 应用设置类型（用于 SettingsModal 与 Tauri API）
export interface Settings {
  // 是否在系统托盘（macOS 菜单栏）显示图标
  showInTray: boolean;
  // 点击关闭按钮时是否最小化到托盘而不是关闭应用
  minimizeToTrayOnClose: boolean;
  // 启用 Claude 插件联动（写入 ~/.claude/config.json 的 primaryApiKey）
  enableClaudePluginIntegration?: boolean;
  // 覆盖 Claude Code 配置目录（可选）
  claudeConfigDir?: string;
  // 覆盖 Codex 配置目录（可选）
  codexConfigDir?: string;
  // 首选语言（可选，默认中文）
  language?: "en" | "zh";
  // Claude 自定义端点列表
  customEndpointsClaude?: Record<string, CustomEndpoint>;
  // Codex 自定义端点列表
  customEndpointsCodex?: Record<string, CustomEndpoint>;
  // 默认终端软件（iTerm2 或 Terminal）
  defaultTerminal?: string;
}

// MCP 服务器连接参数（宽松：允许扩展字段）
export interface McpServerSpec {
  // 可选：社区常见 .mcp.json 中 stdio 配置可不写 type
  type?: "stdio" | "http";
  // stdio 字段
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // http 字段
  url?: string;
  headers?: Record<string, string>;
  // 通用字段
  [key: string]: any;
}

// MCP 服务器条目（含元信息）
export interface McpServer {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  homepage?: string;
  docs?: string;
  enabled?: boolean;
  server: McpServerSpec;
  source?: string;
  [key: string]: any;
}

// MCP 配置状态
export interface McpStatus {
  userConfigPath: string;
  userConfigExists: boolean;
  serverCount: number;
}

// 新：来自 config.json 的 MCP 列表响应
export interface McpConfigResponse {
  configPath: string;
  servers: Record<string, McpServer>;
}

// Droid 自定义模型配置
export interface DroidCustomModel {
  model_display_name: string;
  model: string;
  base_url: string;
  api_key: string;
  provider: string;
  max_tokens?: number;
  supports_prompt_caching?: boolean;
}

// Droid 配置（对应 .factory/config.json）
export interface DroidConfig {
  custom_models: DroidCustomModel[];
  default_model?: string;
  enable_cost_tracking?: boolean;
  enable_prompt_caching?: boolean;
}

// Droid Provider（用于管理多个 API Key）
// API Key 信息
export interface ApiKeyInfo {
  id: string;
  key: string;
  name?: string; // 可选的标识名称
  is_active: boolean; // 当前是否在使用
  last_used?: number; // 最后使用时间
  balance?: {
    total_allowance: number;
    total_used: number;
    remaining: number;
    used_ratio: number;
    last_checked?: number;
  };
}

// 切换策略类型
export type SwitchStrategy =
  | "round_robin"
  | "use_lowest"
  | "use_highest"
  | "manual";

export interface DroidProvider {
  id: string;
  name: string;
  api_key: string; // 保留用于兼容，实际使用api_keys
  api_keys?: ApiKeyInfo[]; // 多个API Key
  current_key_index?: number; // 当前使用的key索引
  switch_strategy?: SwitchStrategy; // 切换策略
  base_url?: string;
  model?: string;
  model_display_name?: string;
  provider?: string;
  max_tokens?: number;
  supports_prompt_caching?: boolean;
  createdAt?: number;
  balance?: {
    total_allowance: number;
    total_used: number;
    remaining: number;
    used_ratio: number;
    last_checked?: number;
  }; // 缓存的余额信息
  is_invalid?: boolean; // 标识账号是否已失效（401错误）
  refresh_interval?: number; // 余额刷新间隔（分钟），默认60分钟
}

// Droid 会话历史
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

export interface DroidSession {
  id: string;
  title: string;
  timestamp: string;
  owner?: string;
  token_usage?: TokenUsage;
  file_path?: string;
}
