use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// 配置备份管理器
pub struct ConfigBackupManager {
    config_path: PathBuf,
    backup_dir: PathBuf,
    max_backups: usize,
}

/// 备份元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub timestamp: u64,
    pub file_size: u64,
    pub checksum: String,
    pub backup_path: String,
}

impl ConfigBackupManager {
    pub fn new(config_path: PathBuf) -> Self {
        let backup_dir = config_path
            .parent()
            .unwrap_or(Path::new("."))
            .join("backups");
        
        Self {
            config_path,
            backup_dir,
            max_backups: 10, // 保留最近10个备份
        }
    }

    /// 确保备份目录存在
    fn ensure_backup_dir(&self) -> Result<(), String> {
        if !self.backup_dir.exists() {
            fs::create_dir_all(&self.backup_dir)
                .map_err(|e| format!("创建备份目录失败: {}", e))?;
        }
        Ok(())
    }

    /// 计算文件的简单校验和（MD5）
    fn calculate_checksum(&self, path: &Path) -> Result<String, String> {
        let content = fs::read(path)
            .map_err(|e| format!("读取文件失败: {}", e))?;
        
        // 使用简单的哈希
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        Ok(format!("{:x}", hasher.finish()))
    }

    /// 创建配置备份
    pub fn create_backup(&self) -> Result<BackupMetadata, String> {
        if !self.config_path.exists() {
            return Err("配置文件不存在".to_string());
        }

        self.ensure_backup_dir()?;

        // 获取时间戳
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // 生成备份文件名
        let backup_filename = format!("config_backup_{}.json", timestamp);
        let backup_path = self.backup_dir.join(&backup_filename);

        // 复制文件
        fs::copy(&self.config_path, &backup_path)
            .map_err(|e| format!("创建备份失败: {}", e))?;

        // 获取文件大小
        let metadata = fs::metadata(&backup_path)
            .map_err(|e| format!("获取文件元数据失败: {}", e))?;
        let file_size = metadata.len();

        // 计算校验和
        let checksum = self.calculate_checksum(&backup_path)?;

        // 创建元数据
        let backup_meta = BackupMetadata {
            timestamp,
            file_size,
            checksum,
            backup_path: backup_path.to_string_lossy().to_string(),
        };

        // 保存元数据
        let meta_path = self.backup_dir.join(format!("config_backup_{}.meta.json", timestamp));
        let meta_json = serde_json::to_string_pretty(&backup_meta)
            .map_err(|e| format!("序列化元数据失败: {}", e))?;
        fs::write(&meta_path, meta_json)
            .map_err(|e| format!("保存元数据失败: {}", e))?;

        log::info!("✅ 配置备份已创建: {}", backup_path.display());

        // 清理旧备份
        self.cleanup_old_backups()?;

        Ok(backup_meta)
    }

    /// 列出所有备份
    pub fn list_backups(&self) -> Result<Vec<BackupMetadata>, String> {
        if !self.backup_dir.exists() {
            return Ok(Vec::new());
        }

        let mut backups = Vec::new();

        let entries = fs::read_dir(&self.backup_dir)
            .map_err(|e| format!("读取备份目录失败: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            let path = entry.path();

            // 只处理元数据文件
            if path.extension().and_then(|s| s.to_str()) == Some("json")
                && path.file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.ends_with(".meta.json"))
                    .unwrap_or(false)
            {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(meta) = serde_json::from_str::<BackupMetadata>(&content) {
                        backups.push(meta);
                    }
                }
            }
        }

        // 按时间戳降序排序（最新的在前）
        backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(backups)
    }

    /// 清理旧备份，只保留最近的 N 个
    fn cleanup_old_backups(&self) -> Result<(), String> {
        let mut backups = self.list_backups()?;

        if backups.len() <= self.max_backups {
            return Ok(());
        }

        // 删除多余的备份
        for backup in backups.drain(self.max_backups..) {
            let backup_path = PathBuf::from(&backup.backup_path);
            let meta_path = backup_path.with_extension("meta.json");

            // 删除备份文件
            if backup_path.exists() {
                fs::remove_file(&backup_path)
                    .map_err(|e| format!("删除旧备份失败: {}", e))?;
            }

            // 删除元数据文件
            if meta_path.exists() {
                fs::remove_file(&meta_path)
                    .map_err(|e| format!("删除元数据失败: {}", e))?;
            }

            log::info!("🗑️  已删除旧备份: {}", backup_path.display());
        }

        Ok(())
    }

    /// 从最新的备份恢复配置
    pub fn restore_from_latest(&self) -> Result<(), String> {
        let backups = self.list_backups()?;

        if backups.is_empty() {
            return Err("没有可用的备份".to_string());
        }

        let latest = &backups[0];
        self.restore_from_backup(&latest.backup_path)
    }

    /// 从指定备份恢复
    pub fn restore_from_backup(&self, backup_path: &str) -> Result<(), String> {
        let backup_path = PathBuf::from(backup_path);

        if !backup_path.exists() {
            return Err(format!("备份文件不存在: {}", backup_path.display()));
        }

        // 在恢复前先备份当前配置（如果存在）
        if self.config_path.exists() {
            let emergency_backup = self.config_path.with_extension("emergency_backup.json");
            fs::copy(&self.config_path, &emergency_backup)
                .map_err(|e| format!("创建紧急备份失败: {}", e))?;
            log::info!("📦 已创建紧急备份: {}", emergency_backup.display());
        }

        // 恢复配置
        fs::copy(&backup_path, &self.config_path)
            .map_err(|e| format!("恢复配置失败: {}", e))?;

        log::info!("✅ 配置已从备份恢复: {}", backup_path.display());

        Ok(())
    }

    /// 验证配置文件完整性
    pub fn verify_config(&self) -> Result<bool, String> {
        if !self.config_path.exists() {
            return Ok(false);
        }

        // 尝试读取并解析 JSON
        let content = fs::read_to_string(&self.config_path)
            .map_err(|e| format!("读取配置失败: {}", e))?;

        serde_json::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("配置文件格式错误: {}", e))?;

        Ok(true)
    }

    /// 获取今天开始的时间戳（UTC时区的今天0点）
    fn get_today_start_timestamp() -> u64 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // 计算今天0点的时间戳（86400秒 = 1天）
        now - (now % 86400)
    }

    /// 检查是否需要创建今天的备份
    pub fn should_create_backup(&self) -> Result<bool, String> {
        let backups = self.list_backups()?;

        if backups.is_empty() {
            return Ok(true); // 没有备份，需要创建
        }

        let today_start = Self::get_today_start_timestamp();

        // 检查是否已有今天的备份
        let has_today_backup = backups.iter()
            .any(|b| b.timestamp >= today_start);

        Ok(!has_today_backup)
    }

    /// 智能备份：每天只创建一次
    pub fn smart_backup(&self) -> Result<Option<BackupMetadata>, String> {
        if !self.config_path.exists() {
            return Ok(None); // 配置文件不存在，跳过备份
        }

        if !self.should_create_backup()? {
            log::info!("⏭️  今天已有备份，跳过");
            return Ok(None);
        }

        let meta = self.create_backup()?;
        log::info!("✅ 已创建今天的备份");
        Ok(Some(meta))
    }

    /// 安全保存配置（带验证和自动备份）
    pub fn safe_save<T: Serialize>(&self, config: &T) -> Result<(), String> {
        // 先创建当前配置的备份
        if self.config_path.exists() {
            self.create_backup()?;
        }

        // 序列化配置
        let json_content = serde_json::to_string_pretty(config)
            .map_err(|e| format!("序列化配置失败: {}", e))?;

        // 先写入临时文件
        let temp_path = self.config_path.with_extension("tmp");
        fs::write(&temp_path, &json_content)
            .map_err(|e| format!("写入临时文件失败: {}", e))?;

        // 验证临时文件
        let temp_content = fs::read_to_string(&temp_path)
            .map_err(|e| format!("读取临时文件失败: {}", e))?;
        serde_json::from_str::<serde_json::Value>(&temp_content)
            .map_err(|e| format!("验证配置格式失败: {}", e))?;

        // 原子性地替换配置文件
        fs::rename(&temp_path, &self.config_path)
            .map_err(|e| format!("替换配置文件失败: {}", e))?;

        log::info!("💾 配置已安全保存: {}", self.config_path.display());

        Ok(())
    }
}
