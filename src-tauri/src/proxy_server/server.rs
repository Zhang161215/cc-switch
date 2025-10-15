use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::oneshot;
use tower_http::cors::{Any, CorsLayer};

use super::config::ProxyConfig;
use super::routes::{chat_completions, list_models};

pub struct ProxyServer {
    shutdown_tx: Option<oneshot::Sender<()>>,
    port: u16,
}

impl ProxyServer {
    pub fn new(port: u16) -> Self {
        Self {
            shutdown_tx: None,
            port,
        }
    }

    pub async fn start(&mut self, config: ProxyConfig) -> Result<(), String> {
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        self.shutdown_tx = Some(shutdown_tx);

        let app_state = Arc::new(config);
        let port = self.port;

        // 配置 CORS
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        // 创建路由
        let app = Router::new()
            .route("/", get(|| async { "droid2api - Rust Edition" }))
            .route("/v1/models", get(list_models))
            .route("/v1/chat/completions", post(chat_completions))
            .layer(cors)
            .with_state(app_state);

        // 启动服务器
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        
        tokio::spawn(async move {
            log::info!("Proxy server starting on {}", addr);
            
            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    log::error!("Failed to bind to {}: {}", addr, e);
                    return;
                }
            };

            log::info!("Proxy server listening on http://{}", addr);

            if let Err(e) = axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                    log::info!("Proxy server shutting down...");
                })
                .await
            {
                log::error!("Server error: {}", e);
            }
        });

        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

// Tauri 命令
use tauri::State;
use tokio::sync::Mutex;

pub type ProxyServerState = Arc<Mutex<Option<ProxyServer>>>;

#[tauri::command]
pub async fn start_proxy_server(
    state: State<'_, ProxyServerState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut server_guard = state.lock().await;

    if server_guard.is_some() {
        return Ok("Proxy server is already running".to_string());
    }

    let mut server = ProxyServer::new(3000);
    
    // 从 Droid 配置读取 API Key
    let mut config = ProxyConfig::default();
    
    // 尝试读取当前 Droid provider 的 API key
    if let Ok(Some(api_key)) = get_current_droid_api_key(&app_handle).await {
        log::info!("Loaded API key from Droid configuration");
        for endpoint in &mut config.endpoints {
            endpoint.api_key = api_key.clone();
        }
    } else {
        log::warn!("No API key found in Droid configuration, using empty key");
    }
    
    server.start(config).await?;
    *server_guard = Some(server);

    Ok("Proxy server started on http://localhost:3000".to_string())
}

// 从 Droid 配置获取当前 API Key
async fn get_current_droid_api_key(app_handle: &tauri::AppHandle) -> Result<Option<String>, String> {
    use crate::store::AppState;
    use tauri::Manager;
    
    // 从应用状态获取配置
    let app_state = app_handle.state::<AppState>();
    let config = app_state.config.lock().map_err(|e| e.to_string())?;
    
    // 从 droid_manager 获取当前 provider 的 API Key
    if let Some(droid_manager) = &config.droid_manager {
        if let Some(current_provider) = droid_manager.providers
            .iter()
            .find(|p| p.id == droid_manager.current)
        {
            log::info!("Loaded API key from Droid provider: {}", current_provider.name);
            return Ok(Some(current_provider.api_key.clone()));
        }
    }
    
    // 回退到环境变量
    if let Ok(api_key) = std::env::var("FACTORY_API_KEY") {
        log::info!("Loaded API key from environment variable");
        return Ok(Some(api_key));
    }
    
    log::warn!("No API key found in configuration or environment");
    Ok(None)
}

#[tauri::command]
pub async fn stop_proxy_server(
    state: State<'_, ProxyServerState>,
) -> Result<String, String> {
    let mut server_guard = state.lock().await;

    if let Some(mut server) = server_guard.take() {
        server.stop();
        Ok("Proxy server stopped".to_string())
    } else {
        Err("Proxy server is not running".to_string())
    }
}

#[tauri::command]
pub async fn get_proxy_server_status(
    state: State<'_, ProxyServerState>,
) -> Result<bool, String> {
    let server_guard = state.lock().await;
    Ok(server_guard.is_some())
}
