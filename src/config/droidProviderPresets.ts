/**
 * Droid 预设供应商配置模板
 */

export interface DroidProviderPreset {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  base_url: string;
  model: string;
  model_display_name: string;
  provider: string;
  max_tokens?: number;
  supports_prompt_caching?: boolean;
  isOfficial?: boolean;
  // 新增：droid2api 请求地址候选列表
  droid2apiCandidates?: string[];
}

export const droidProviderPresets: DroidProviderPreset[] = [
  {
    name: "Droid Official (Sonnet 4.5)",
    websiteUrl: "https://factory.ai",
    apiKeyUrl: "https://factory.ai/settings",
    base_url: "https://droid2api-2st1n.sevalla.app",
    model: "claude-sonnet-4-5-20250929",
    model_display_name: "Sonnet 4.5 [droid]",
    provider: "anthropic",
    max_tokens: 200000,
    supports_prompt_caching: true,
    isOfficial: true,
    droid2apiCandidates: [
      "https://droid-cc.xie-xuhuaimu.workers.dev",
      "http://127.0.0.1:3000",
    ],
  },
  {
    name: "Droid Official (Opus 4.1)",
    websiteUrl: "https://factory.ai",
    apiKeyUrl: "https://factory.ai/settings",
    base_url: "https://droid2api-2st1n.sevalla.app",
    model: "claude-opus-4-1-20250805",
    model_display_name: "Opus 4.1 [droid]",
    provider: "anthropic",
    max_tokens: 200000,
    supports_prompt_caching: true,
    isOfficial: true,
    droid2apiCandidates: [
      "https://droid-cc.xie-xuhuaimu.workers.dev",
      "http://127.0.0.1:3000",
    ],
  },
  {
    name: "Custom API",
    websiteUrl: "",
    base_url: "",
    model: "",
    model_display_name: "",
    provider: "anthropic",
    droid2apiCandidates: [
      "https://droid-cc.xie-xuhuaimu.workers.dev",
      "http://127.0.0.1:3000",
    ],
  },
];
