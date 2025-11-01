use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MCP 配置：单客户端维度（claude 或 codex 下的一组服务器）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpConfig {
    /// 以 id 为键的服务器定义（宽松 JSON 对象，包含 enabled/source 等 UI 辅助字段）
    #[serde(default)]
    pub servers: HashMap<String, serde_json::Value>,
}

/// MCP 根：按客户端分开维护（无历史兼容压力，直接以 v2 结构落地）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpRoot {
    #[serde(default)]
    pub claude: McpConfig,
    #[serde(default)]
    pub codex: McpConfig,
}

use crate::config::{copy_file, get_app_config_dir, get_app_config_path};
use crate::provider::ProviderManager;

/// 应用类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppType {
    Claude,
    Codex,
}

impl AppType {
    pub fn as_str(&self) -> &str {
        match self {
            AppType::Claude => "claude",
            AppType::Codex => "codex",
        }
    }
}

impl From<&str> for AppType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "codex" => AppType::Codex,
            _ => AppType::Claude, // 默认为 Claude
        }
    }
}

/// 多应用配置结构（向后兼容）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAppConfig {
    #[serde(default = "default_version")]
    pub version: u32,
    /// 应用管理器（claude/codex）
    #[serde(flatten)]
    pub apps: HashMap<String, ProviderManager>,
    /// MCP 配置（按客户端分治）
    #[serde(default)]
    pub mcp: McpRoot,
    /// Droid 管理器
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub droid_manager: Option<crate::droid_config::DroidManagerConfig>,
}

fn default_version() -> u32 {
    2
}

impl Default for MultiAppConfig {
    fn default() -> Self {
        let mut apps = HashMap::new();
        apps.insert("claude".to_string(), ProviderManager::default());
        apps.insert("codex".to_string(), ProviderManager::default());

        Self {
            version: 2,
            apps,
            mcp: McpRoot::default(),
            droid_manager: None,
        }
    }
}

impl MultiAppConfig {
    /// 从文件加载配置（处理v1到v2的迁移，带自动恢复）
    pub fn load() -> Result<Self, String> {
        let config_path = get_app_config_path();

        if !config_path.exists() {
            log::info!("配置文件不存在，创建新的多应用配置");
            return Ok(Self::default());
        }

        // 创建备份管理器
        let backup_manager = crate::config_backup::ConfigBackupManager::new(config_path.clone());

        // 验证配置文件完整性
        match backup_manager.verify_config() {
            Ok(true) => {
                log::info!("✅ 配置文件验证通过");
            }
            Ok(false) | Err(_) => {
                log::warn!("⚠️ 配置文件损坏或格式错误，尝试从备份恢复");
                
                // 尝试从最新备份恢复
                if let Err(e) = backup_manager.restore_from_latest() {
                    log::error!("❌ 从备份恢复失败: {}，将使用默认配置", e);
                    return Ok(Self::default());
                }
                
                log::info!("✅ 已从备份成功恢复配置");
            }
        }

        // 尝试读取文件
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;

        // 检查是否是旧版本格式（v1）
        if let Ok(v1_config) = serde_json::from_str::<ProviderManager>(&content) {
            log::info!("检测到v1配置，自动迁移到v2");

            // 迁移到新格式
            let mut apps = HashMap::new();
            apps.insert("claude".to_string(), v1_config);
            apps.insert("codex".to_string(), ProviderManager::default());

            let config = Self {
                version: 2,
                apps,
                mcp: McpRoot::default(),
                droid_manager: None,
            };

            // 迁移前备份旧版(v1)配置文件
            let backup_dir = get_app_config_dir();
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let backup_path = backup_dir.join(format!("config.v1.backup.{}.json", ts));

            match copy_file(&config_path, &backup_path) {
                Ok(()) => log::info!(
                    "已备份旧版配置文件: {} -> {}",
                    config_path.display(),
                    backup_path.display()
                ),
                Err(e) => log::warn!("备份旧版配置文件失败: {}", e),
            }

            // 保存迁移后的配置
            config.save()?;
            return Ok(config);
        }

        // 尝试读取v2格式
        serde_json::from_str::<Self>(&content).map_err(|e| format!("解析配置文件失败: {}", e))
    }

    /// 保存配置到文件（使用智能备份机制：每天只备份一次）
    pub fn save(&self) -> Result<(), String> {
        let config_path = get_app_config_path();

        // 使用智能备份：每天只创建一次
        let backup_manager = crate::config_backup::ConfigBackupManager::new(config_path.clone());
        let _ = backup_manager.smart_backup(); // 忽略备份结果，备份失败不影响保存

        // 序列化并保存配置
        let json_content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("序列化配置失败: {}", e))?;

        std::fs::write(&config_path, &json_content)
            .map_err(|e| format!("保存配置失败: {}", e))?;

        log::info!("💾 配置已保存");
        Ok(())
    }
    
    /// 列出所有可用的配置备份
    pub fn list_backups() -> Result<Vec<crate::config_backup::BackupMetadata>, String> {
        let config_path = get_app_config_path();
        let backup_manager = crate::config_backup::ConfigBackupManager::new(config_path);
        backup_manager.list_backups()
    }
    
    /// 从指定备份恢复配置
    pub fn restore_from_backup(backup_path: &str) -> Result<(), String> {
        let config_path = get_app_config_path();
        let backup_manager = crate::config_backup::ConfigBackupManager::new(config_path);
        backup_manager.restore_from_backup(backup_path)
    }

    /// 获取指定应用的管理器
    pub fn get_manager(&self, app: &AppType) -> Option<&ProviderManager> {
        self.apps.get(app.as_str())
    }

    /// 获取指定应用的管理器（可变引用）
    pub fn get_manager_mut(&mut self, app: &AppType) -> Option<&mut ProviderManager> {
        self.apps.get_mut(app.as_str())
    }

    /// 确保应用存在
    pub fn ensure_app(&mut self, app: &AppType) {
        if !self.apps.contains_key(app.as_str()) {
            self.apps
                .insert(app.as_str().to_string(), ProviderManager::default());
        }
    }

    /// 获取指定客户端的 MCP 配置（不可变引用）
    pub fn mcp_for(&self, app: &AppType) -> &McpConfig {
        match app {
            AppType::Claude => &self.mcp.claude,
            AppType::Codex => &self.mcp.codex,
        }
    }

    /// 获取指定客户端的 MCP 配置（可变引用）
    pub fn mcp_for_mut(&mut self, app: &AppType) -> &mut McpConfig {
        match app {
            AppType::Claude => &mut self.mcp.claude,
            AppType::Codex => &mut self.mcp.codex,
        }
    }
}
