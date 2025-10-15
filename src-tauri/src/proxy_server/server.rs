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
) -> Result<String, String> {
    let mut server_guard = state.lock().await;

    if server_guard.is_some() {
        return Ok("Proxy server is already running".to_string());
    }

    let mut server = ProxyServer::new(3000);
    let config = ProxyConfig::default(); // TODO: 从配置文件加载
    
    server.start(config).await?;
    *server_guard = Some(server);

    Ok("Proxy server started on http://localhost:3000".to_string())
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
