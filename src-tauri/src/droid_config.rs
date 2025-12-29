use dirs;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroidCustomModel {
    pub model_display_name: String,
    pub model: String,
    pub base_url: String,
    pub api_key: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_prompt_caching: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroidConfig {
    pub custom_models: Vec<DroidCustomModel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_cost_tracking: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_prompt_caching: Option<bool>,
}

/// API Key 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyInfo {
    pub id: String,
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<KeyBalance>,
}

/// Key 余额信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBalance {
    pub total_allowance: f64,
    pub total_used: f64,
    pub remaining: f64,
    pub used_ratio: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_checked: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date: Option<i64>,
}

/// 切换策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwitchStrategy {
    Manual,
    RoundRobin,
    UseLowest,
    UseHighest,
}

impl Default for SwitchStrategy {
    fn default() -> Self {
        SwitchStrategy::Manual
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroidProvider {
    pub id: String,
    pub name: String,
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_keys: Option<Vec<ApiKeyInfo>>, // 多个API Key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_key_index: Option<usize>, // 当前使用的key索引
    #[serde(skip_serializing_if = "Option::is_none")]
    pub switch_strategy: Option<SwitchStrategy>, // 切换策略
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_prompt_caching: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<KeyBalance>, // 缓存的余额信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_invalid: Option<bool>, // 标识账号是否已失效（401错误）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_interval: Option<i64>, // 自动刷新间隔（分钟）
}

/// Get the Factory config directory path
pub fn get_factory_config_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home_dir.join(".factory"))
}

/// Get the Factory config.json file path
pub fn get_factory_config_path() -> Result<PathBuf, String> {
    let config_dir = get_factory_config_dir()?;
    Ok(config_dir.join("config.json"))
}

/// Get CC Switch Droid config file path
pub fn get_cc_switch_droid_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let cc_switch_dir = home_dir.join(".cc-switch");
    
    // Ensure directory exists
    if !cc_switch_dir.exists() {
        fs::create_dir_all(&cc_switch_dir)
            .map_err(|e| format!("创建 .cc-switch 目录失败: {}", e))?;
    }
    
    Ok(cc_switch_dir.join("droid_config.json"))
}

/// Load Droid providers from CC Switch config
pub fn load_droid_providers() -> Result<Vec<DroidProvider>, String> {
    let config_path = get_cc_switch_droid_config_path()?;
    
    if !config_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 Droid 配置文件失败: {}", e))?;
    
    let providers: Vec<DroidProvider> = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Droid 配置失败: {}", e))?;
    
    Ok(providers)
}

/// Save Droid providers to CC Switch config
pub fn save_droid_providers(providers: &[DroidProvider]) -> Result<(), String> {
    let config_path = get_cc_switch_droid_config_path()?;
    
    let content = serde_json::to_string_pretty(providers)
        .map_err(|e| format!("序列化 Droid 配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("写入 Droid 配置文件失败: {}", e))?;
    
    Ok(())
}

/// Read Factory config.json
pub fn read_factory_config() -> Result<DroidConfig, String> {
    let config_path = get_factory_config_path()?;
    
    if !config_path.exists() {
        return Ok(DroidConfig {
            custom_models: Vec::new(),
            default_model: None,
            enable_cost_tracking: None,
            enable_prompt_caching: None,
        });
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 Factory 配置文件失败: {}", e))?;
    
    let config: DroidConfig = serde_json::from_str(&content)
        .unwrap_or_else(|_| DroidConfig {
            custom_models: Vec::new(),
            default_model: None,
            enable_cost_tracking: None,
            enable_prompt_caching: None,
        });
    
    Ok(config)
}

/// Write Factory config.json
pub fn write_factory_config(config: &DroidConfig) -> Result<(), String> {
    let config_path = get_factory_config_path()?;
    let config_dir = get_factory_config_dir()?;
    
    // Ensure directory exists
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("创建 .factory 目录失败: {}", e))?;
    }
    
    // Create backup if file exists
    if config_path.exists() {
        let backup_path = config_path.with_extension("json.bak");
        fs::copy(&config_path, &backup_path)
            .map_err(|e| format!("创建备份文件失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化 Factory 配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("写入 Factory 配置文件失败: {}", e))?;
    
    Ok(())
}

/// Get current Droid provider ID from CC Switch state
pub fn get_current_droid_provider() -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let state_file = home_dir.join(".cc-switch").join("droid_state.json");
    
    if !state_file.exists() {
        return Ok(String::new());
    }
    
    let content = fs::read_to_string(&state_file)
        .map_err(|e| format!("读取 Droid 状态文件失败: {}", e))?;
    
    #[derive(Deserialize)]
    struct DroidState {
        current_provider_id: String,
    }
    
    let state: DroidState = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Droid 状态失败: {}", e))?;
    
    Ok(state.current_provider_id)
}

/// Set current Droid provider ID in CC Switch state
#[allow(dead_code)]
pub fn set_current_droid_provider(provider_id: &str) -> Result<(), String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let cc_switch_dir = home_dir.join(".cc-switch");
    let state_file = cc_switch_dir.join("droid_state.json");
    
    // Ensure directory exists
    if !cc_switch_dir.exists() {
        fs::create_dir_all(&cc_switch_dir)
            .map_err(|e| format!("创建 .cc-switch 目录失败: {}", e))?;
    }
    
    #[derive(Serialize)]
    struct DroidState {
        current_provider_id: String,
    }
    
    let state = DroidState {
        current_provider_id: provider_id.to_string(),
    };
    
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("序列化 Droid 状态失败: {}", e))?;
    
    fs::write(&state_file, content)
        .map_err(|e| format!("写入 Droid 状态文件失败: {}", e))?;
    
    Ok(())
}

/// Droid Manager Config for CC Switch
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DroidManagerConfig {
    pub providers: Vec<DroidProvider>,
    pub current: String,
}

/// Apply Droid provider to Factory config
pub fn apply_provider_to_factory(provider: &DroidProvider) -> Result<(), String> {
    // Read existing config
    let mut config = read_factory_config()?;
    
    // Create custom model from provider
    let custom_model = DroidCustomModel {
        model_display_name: provider.model_display_name.clone()
            .unwrap_or_else(|| "Sonnet 4.5 [droid]".to_string()),
        model: provider.model.clone()
            .unwrap_or_else(|| "claude-sonnet-4-5-20250929".to_string()),
        base_url: provider.base_url.clone()
            .unwrap_or_else(|| "https://api.factory.ai".to_string()),
        api_key: provider.api_key.clone(),
        provider: provider.provider.clone()
            .unwrap_or_else(|| "anthropic".to_string()),
        max_tokens: provider.max_tokens,
        supports_prompt_caching: provider.supports_prompt_caching,
    };
    
    // Remove all existing droid models first (to avoid duplicates)
    // 检查是否包含 [droid] 或 [D]
    config.custom_models.retain(|m| !m.model_display_name.contains("[droid]") && !m.model_display_name.contains("[D]"));
    
    // Add the new model
    config.custom_models.push(custom_model);
    
    // Write config
    write_factory_config(&config)?;
    
    Ok(())
}

/// Remove old Factory model by display name
pub fn remove_old_factory_model(old_display_name: &Option<String>) -> Result<(), String> {
    if let Some(display_name) = old_display_name {
        let mut config = read_factory_config()?;
        config.custom_models.retain(|m| m.model_display_name != *display_name);
        write_factory_config(&config)?;
    }
    Ok(())
}

/// Droid 会话信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroidSession {
    pub id: String,
    pub title: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_usage: Option<TokenUsage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
}

/// Token 使用量
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_creation_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<i64>,
}

/// 获取 Factory 会话目录
fn get_factory_sessions_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())
        .map(|home| home.join(".factory").join("sessions"))
}

/// 获取当前 API key 的 owner
fn get_current_owner() -> Option<String> {
    // 直接从 Factory 配置文件中读取，避免调用 droid 命令
    dirs::home_dir()
        .and_then(|home| {
            let settings_path = home.join(".factory").join("settings.json");
            fs::read_to_string(settings_path).ok()
        })
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|settings| {
            // 尝试从 userId 或 user_id 字段读取
            settings["userId"]
                .as_str()
                .or_else(|| settings["user_id"].as_str())
                .map(|s| s.to_string())
        })
}

/// 读取当前 API key 的 Droid 会话历史
pub fn read_droid_sessions() -> Result<Vec<DroidSession>, String> {
    let sessions_dir = get_factory_sessions_dir()?;
    
    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    // 获取当前 API key 的 owner（从 Factory 设置中获取）
    let current_owner = get_current_owner();

    let mut sessions = Vec::new();
    
    // 递归收集所有 .jsonl 文件
    fn collect_jsonl_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
        let entries = fs::read_dir(dir)
            .map_err(|e| format!("读取目录失败: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            let path = entry.path();
            
            if path.is_dir() {
                // 递归遍历子目录
                collect_jsonl_files(&path, files)?;
            } else if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                files.push(path);
            }
        }
        Ok(())
    }
    
    let mut jsonl_files = Vec::new();
    collect_jsonl_files(&sessions_dir, &mut jsonl_files)?;

    for path in jsonl_files {
        if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
            // 读取 .jsonl 文件的第一行获取会话信息
            if let Ok(content) = fs::read_to_string(&path) {
                // 过滤空会话：至少需要有2行内容（session_start + 至少一条消息）
                let line_count = content.lines().count();
                if line_count < 2 {
                    continue; // 跳过没有实际内容的会话
                }
                
                if let Some(first_line) = content.lines().next() {
                    if let Ok(session_start) = serde_json::from_str::<Value>(first_line) {
                        if session_start["type"] == "session_start" {
                            let title = session_start["title"]
                                .as_str()
                                .unwrap_or("无标题")
                                .to_string();
                            
                            let owner = session_start["owner"]
                                .as_str()
                                .map(|s| s.to_string());
                            
                            // 如果无法确定当前 owner，则显示所有会话（兼容模式）
                            // 如果能确定当前 owner，则只显示匹配的会话
                            if let Some(current) = &current_owner {
                                if let Some(session_owner) = &owner {
                                    // 如果 owner 不匹配，跳过这个会话
                                    if session_owner != current {
                                        continue;
                                    }
                                }
                                // 如果会话没有 owner 信息（旧数据），也包含在结果中
                            }
                            // 如果 current_owner 是 None，则包含所有会话

                            // 读取对应的 .settings.json 文件获取 token 使用量
                            let settings_path = path.with_extension("settings.json");
                            let token_usage = if settings_path.exists() {
                                fs::read_to_string(&settings_path)
                                    .ok()
                                    .and_then(|content| serde_json::from_str::<Value>(&content).ok())
                                    .and_then(|settings| {
                                        let token_usage = settings.get("tokenUsage")?;
                                        Some(TokenUsage {
                                            input_tokens: token_usage["inputTokens"].as_i64(),
                                            output_tokens: token_usage["outputTokens"].as_i64(),
                                            cache_creation_tokens: token_usage["cacheCreationTokens"].as_i64(),
                                            cache_read_tokens: token_usage["cacheReadTokens"].as_i64(),
                                        })
                                    })
                            } else {
                                None
                            };

                            // 获取文件修改时间作为时间戳
                            let timestamp = if let Ok(metadata) = fs::metadata(&path) {
                                if let Ok(modified) = metadata.modified() {
                                    if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                                        // 转换为 ISO 8601 格式
                                        let secs = duration.as_secs();
                                        chrono::DateTime::from_timestamp(secs as i64, 0)
                                            .map(|dt| dt.to_rfc3339())
                                            .unwrap_or_else(|| duration.as_secs().to_string())
                                    } else {
                                        "Unknown".to_string()
                                    }
                                } else {
                                    "Unknown".to_string()
                                }
                            } else {
                                "Unknown".to_string()
                            };

                            // 从父目录名提取工作目录
                            // 目录名格式: -Users-user-cc-switch -> /Users/user/cc-switch
                            let working_dir = path.parent()
                                .and_then(|p| p.file_name())
                                .and_then(|name| name.to_str())
                                .map(|name| {
                                    // 将 -Users-user-xxx 转换为 /Users/user/xxx
                                    name.replace('-', "/")
                                });

                            sessions.push(DroidSession {
                                id: session_id.to_string(),
                                title,
                                timestamp,
                                owner,
                                token_usage,
                                file_path: Some(path.to_string_lossy().to_string()),
                                working_dir,
                            });
                        }
                    }
                }
            }
        }
    }

    // 按时间戳排序（最新的在前面）
    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(sessions)
}

// ============================================
// Factory Settings 管理 (settings.json)
// ============================================

/// Session Default Settings 结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionDefaultSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autonomy_mode: Option<String>,
}

/// settings.json 中的 customModels 项（带 id 字段）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryCustomModelWithId {
    pub id: String,
    pub display_name: String,
    pub model: String,
    pub base_url: String,
    #[serde(default)]
    pub provider: String,
}

/// Factory Settings 结构 (~/.factory/settings.json)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FactorySettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_default_settings: Option<SessionDefaultSettings>,
    #[serde(default)]
    pub custom_models: Vec<FactoryCustomModelWithId>,
    // 保留其他字段
    #[serde(flatten)]
    pub other: serde_json::Map<String, Value>,
}

/// 获取 Factory settings.json 文件路径
pub fn get_factory_settings_path() -> Result<PathBuf, String> {
    let config_dir = get_factory_config_dir()?;
    Ok(config_dir.join("settings.json"))
}

/// 读取 Factory settings.json
pub fn read_factory_settings() -> Result<FactorySettings, String> {
    let settings_path = get_factory_settings_path()?;
    
    if !settings_path.exists() {
        return Ok(FactorySettings::default());
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("读取 Factory settings.json 失败: {}", e))?;
    
    let settings: FactorySettings = serde_json::from_str(&content)
        .unwrap_or_else(|_| FactorySettings::default());
    
    Ok(settings)
}

/// 写入 Factory settings.json（保留其他字段）
pub fn write_factory_settings(settings: &FactorySettings) -> Result<(), String> {
    let settings_path = get_factory_settings_path()?;
    let config_dir = get_factory_config_dir()?;
    
    // Ensure directory exists
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("创建 .factory 目录失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("序列化 Factory settings 失败: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入 Factory settings.json 失败: {}", e))?;
    
    Ok(())
}

/// 获取全局默认模型设置
pub fn get_default_model() -> Result<Option<String>, String> {
    let settings = read_factory_settings()?;
    Ok(settings.session_default_settings.and_then(|s| s.model))
}

/// 设置全局默认模型
pub fn set_default_model(model: &str, reasoning_effort: Option<&str>, autonomy_mode: Option<&str>) -> Result<(), String> {
    let settings_path = get_factory_settings_path()?;
    
    // 读取现有 settings.json 以保留其他字段
    let mut json_value: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取 Factory settings.json 失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()))
    } else {
        Value::Object(serde_json::Map::new())
    };
    
    // 确保 sessionDefaultSettings 存在
    if !json_value.get("sessionDefaultSettings").is_some() {
        json_value["sessionDefaultSettings"] = Value::Object(serde_json::Map::new());
    }
    
    // 设置 model
    json_value["sessionDefaultSettings"]["model"] = Value::String(model.to_string());
    
    // 可选设置 reasoningEffort
    if let Some(effort) = reasoning_effort {
        json_value["sessionDefaultSettings"]["reasoningEffort"] = Value::String(effort.to_string());
    }
    
    // 可选设置 autonomyMode
    if let Some(mode) = autonomy_mode {
        json_value["sessionDefaultSettings"]["autonomyMode"] = Value::String(mode.to_string());
    }
    
    // 写回文件
    let config_dir = get_factory_config_dir()?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("创建 .factory 目录失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(&json_value)
        .map_err(|e| format!("序列化 Factory settings 失败: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入 Factory settings.json 失败: {}", e))?;
    
    Ok(())
}

// ============================================
// Session Settings 管理 ({session-id}.settings.json)
// ============================================

/// Session Settings 结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autonomy_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_lock: Option<String>,
    // 保留其他字段
    #[serde(flatten)]
    pub other: serde_json::Map<String, Value>,
}

/// 获取会话 settings 文件路径（需要找到 .jsonl 文件所在的子目录）
fn get_session_settings_path(session_id: &str) -> Result<PathBuf, String> {
    let sessions_dir = get_factory_sessions_dir()?;
    
    // 递归搜索 .jsonl 文件
    fn find_jsonl_file(dir: &Path, session_id: &str) -> Option<PathBuf> {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return None,
        };
        
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(found) = find_jsonl_file(&path, session_id) {
                    return Some(found);
                }
            } else {
                let stem = path.file_stem().and_then(|s| s.to_str());
                let ext = path.extension().and_then(|s| s.to_str());
                if stem == Some(session_id) && ext == Some("jsonl") {
                    return Some(path);
                }
            }
        }
        None
    }
    
    // 找到 .jsonl 文件，返回同目录下的 .settings.json 路径
    if let Some(jsonl_path) = find_jsonl_file(&sessions_dir, session_id) {
        let parent = jsonl_path.parent().ok_or("无法获取父目录")?;
        Ok(parent.join(format!("{}.settings.json", session_id)))
    } else {
        // 如果找不到 .jsonl 文件，返回根目录下的路径（兼容）
        Ok(sessions_dir.join(format!("{}.settings.json", session_id)))
    }
}

/// 读取会话 settings
pub fn read_session_settings(session_id: &str) -> Result<SessionSettings, String> {
    let settings_path = get_session_settings_path(session_id)?;
    
    if !settings_path.exists() {
        return Ok(SessionSettings::default());
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("读取会话 settings 失败: {}", e))?;
    
    let settings: SessionSettings = serde_json::from_str(&content)
        .unwrap_or_else(|_| SessionSettings::default());
    
    Ok(settings)
}

/// 设置会话模型
pub fn set_session_model(
    session_id: &str,
    model: &str,
    provider_lock: Option<&str>,
    reasoning_effort: Option<&str>,
    autonomy_mode: Option<&str>,
) -> Result<(), String> {
    let settings_path = get_session_settings_path(session_id)?;
    
    // 读取现有 settings 以保留其他字段
    let mut json_value: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取会话 settings 失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()))
    } else {
        Value::Object(serde_json::Map::new())
    };
    
    // 设置 model
    json_value["model"] = Value::String(model.to_string());
    
    // 可选设置 providerLock
    if let Some(lock) = provider_lock {
        json_value["providerLock"] = Value::String(lock.to_string());
    }
    
    // 可选设置 reasoningEffort
    if let Some(effort) = reasoning_effort {
        json_value["reasoningEffort"] = Value::String(effort.to_string());
    }
    
    // 可选设置 autonomyMode
    if let Some(mode) = autonomy_mode {
        json_value["autonomyMode"] = Value::String(mode.to_string());
    }
    
    // 写回文件
    let content = serde_json::to_string_pretty(&json_value)
        .map_err(|e| format!("序列化会话 settings 失败: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入会话 settings 失败: {}", e))?;
    
    Ok(())
}

/// 获取会话当前模型
pub fn get_session_model(session_id: &str) -> Result<Option<String>, String> {
    let settings = read_session_settings(session_id)?;
    Ok(settings.model)
}
