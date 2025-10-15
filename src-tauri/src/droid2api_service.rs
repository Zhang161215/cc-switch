use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
}

pub struct Droid2ApiService {
    pub process: Arc<Mutex<Option<Child>>>,
    pub status: Arc<Mutex<ServiceStatus>>,
}

impl Droid2ApiService {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(ServiceStatus {
                running: false,
                port: 3000,
                pid: None,
            })),
        }
    }
}

/// 查找 Node.js 可执行文件
fn find_node_executable() -> Option<PathBuf> {
    // 常见的 Node.js 安装路径
    let common_paths = vec![
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/bin/node",
        "/opt/local/bin/node",
        "~/.nvm/versions/node/current/bin/node",
    ];
    
    // 首先尝试通过 which 命令查找
    if let Ok(output) = Command::new("which").arg("node").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let path = PathBuf::from(path_str);
            if path.exists() {
                return Some(path);
            }
        }
    }
    
    // 然后尝试常见路径
    for path_str in common_paths {
        let path = if path_str.starts_with('~') {
            if let Ok(home) = std::env::var("HOME") {
                PathBuf::from(path_str.replace("~", &home))
            } else {
                continue;
            }
        } else {
            PathBuf::from(path_str)
        };
        
        if path.exists() {
            return Some(path);
        }
    }
    
    // 最后尝试从 PATH 环境变量查找
    if let Ok(path_env) = std::env::var("PATH") {
        for dir in path_env.split(':') {
            let node_path = PathBuf::from(dir).join("node");
            if node_path.exists() {
                return Some(node_path);
            }
        }
    }
    
    None
}

#[tauri::command]
pub async fn start_droid2api_service(
    service: State<'_, Droid2ApiService>,
    app_handle: tauri::AppHandle,
) -> Result<ServiceStatus, String> {
    let mut process_guard = service.process.lock().map_err(|e| e.to_string())?;
    let mut status_guard = service.status.lock().map_err(|e| e.to_string())?;

    // 如果服务已经在运行，直接返回状态
    if status_guard.running {
        return Ok(status_guard.clone());
    }

    // 获取 droid2api 目录路径
    // 在开发模式下，从项目根目录读取；在生产模式下，从资源目录读取
    let droid2api_dir = if cfg!(debug_assertions) {
        // 开发模式：使用项目根目录的 droid2api
        let app_dir = app_handle
            .path()
            .app_config_dir()
            .map_err(|e| format!("Failed to get app directory: {}", e))?;
        
        // 向上查找项目根目录（包含 package.json 的目录）
        let mut current = app_dir.as_path();
        let mut project_root = None;
        
        for _ in 0..10 {
            if let Some(parent) = current.parent() {
                if parent.join("package.json").exists() {
                    project_root = Some(parent.to_path_buf());
                    break;
                }
                current = parent;
            } else {
                break;
            }
        }
        
        match project_root {
            Some(root) => root.join("droid2api"),
            None => {
                // 如果找不到项目根目录，尝试使用相对于可执行文件的路径
                std::env::current_dir()
                    .map_err(|e| format!("Failed to get current directory: {}", e))?
                    .join("droid2api")
            }
        }
    } else {
        // 生产模式：使用打包的资源目录
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;
        
        // Tauri将 ../droid2api 打包为 _up_/droid2api
        let bundled_path = resource_dir.join("_up_").join("droid2api");
        
        // Windows: 如果打包路径不存在，尝试从用户文档目录读取
        #[cfg(target_os = "windows")]
        {
            if !bundled_path.exists() {
                log::warn!("Bundled droid2api not found, trying user documents directory");
                let documents_dir = app_handle
                    .path()
                    .document_dir()
                    .map_err(|e| format!("Failed to get documents directory: {}", e))?;
                documents_dir.join("droid2api")
            } else {
                bundled_path
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            bundled_path
        }
    };
    
    // 检查 droid2api 目录是否存在
    if !droid2api_dir.exists() {
        #[cfg(target_os = "windows")]
        {
            return Err(format!(
                "droid2api not found at: {}\n\n\
                Please download droid2api from https://github.com/1e0n/droid2api\n\
                and extract it to: {}",
                droid2api_dir.display(),
                droid2api_dir.display()
            ));
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Err(format!(
                "droid2api directory not found at: {}",
                droid2api_dir.display()
            ));
        }
    }

    // 查找 Node.js 可执行文件
    let node_path = find_node_executable()
        .ok_or_else(|| "Node.js not found. Please install Node.js from https://nodejs.org/".to_string())?;
    
    log::info!("Using Node.js at: {}", node_path.display());
    
    // 启动 Node.js 服务
    let mut command = Command::new(node_path);
    command
        .arg("server.js")
        .current_dir(&droid2api_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("NODE_ENV", "production");

    let child = command.spawn().map_err(|e| {
        format!("Failed to start droid2api service: {}. Make sure Node.js is installed.", e)
    })?;

    let pid = child.id();

    // 更新状态
    status_guard.running = true;
    status_guard.pid = Some(pid);
    *process_guard = Some(child);

    log::info!("droid2api service started with PID: {}", pid);
    
    // 等待服务器启动（最多等待5秒）
    let port = status_guard.port;
    let max_attempts = 10;
    let mut attempts = 0;
    let wait_ms = 500;
    
    log::info!("Waiting for droid2api service to be ready...");
    
    drop(status_guard); // 释放锁以避免死锁
    
    while attempts < max_attempts {
        std::thread::sleep(std::time::Duration::from_millis(wait_ms));
        
        // 尝试连接到服务器
        let client = reqwest::blocking::Client::new();
        if let Ok(response) = client
            .get(format!("http://localhost:{}/v1/models", port))
            .timeout(std::time::Duration::from_secs(2))
            .send()
        {
            if response.status().is_success() {
                log::info!("droid2api service is ready after {} ms", (attempts + 1) * wait_ms);
                let status_guard = service.status.lock().map_err(|e| e.to_string())?;
                return Ok(status_guard.clone());
            }
        }
        
        attempts += 1;
        log::debug!("Waiting for service... attempt {}/{}", attempts, max_attempts);
    }
    
    log::warn!("droid2api service started but may not be fully ready yet");
    let status_guard = service.status.lock().map_err(|e| e.to_string())?;
    Ok(status_guard.clone())
}

#[tauri::command]
pub async fn stop_droid2api_service(
    service: State<'_, Droid2ApiService>,
) -> Result<ServiceStatus, String> {
    let mut process_guard = service.process.lock().map_err(|e| e.to_string())?;
    let mut status_guard = service.status.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = process_guard.take() {
        match child.kill() {
            Ok(_) => {
                log::info!("droid2api service stopped");
            }
            Err(e) => {
                log::warn!("Failed to kill droid2api service: {}", e);
            }
        }
        let _ = child.wait(); // 等待进程完全退出
    }

    // 更新状态
    status_guard.running = false;
    status_guard.pid = None;

    Ok(status_guard.clone())
}

#[tauri::command]
pub async fn get_droid2api_service_status(
    service: State<'_, Droid2ApiService>,
) -> Result<ServiceStatus, String> {
    let mut process_guard = service.process.lock().map_err(|e| e.to_string())?;
    let mut status_guard = service.status.lock().map_err(|e| e.to_string())?;

    // 检查进程是否还在运行
    if let Some(child) = process_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                // 进程已退出
                status_guard.running = false;
                status_guard.pid = None;
                *process_guard = None;
                log::info!("droid2api service process has exited");
            }
            Ok(None) => {
                // 进程仍在运行
                status_guard.running = true;
            }
            Err(e) => {
                log::warn!("Failed to check process status: {}", e);
                status_guard.running = false;
                status_guard.pid = None;
                *process_guard = None;
            }
        }
    } else {
        status_guard.running = false;
        status_guard.pid = None;
    }

    Ok(status_guard.clone())
}

#[tauri::command]
pub async fn test_droid2api_connection() -> Result<bool, String> {
    let client = reqwest::Client::new();
    
    match client
        .get("http://localhost:3000/v1/models")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}