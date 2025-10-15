use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use super::config::ProxyConfig;

pub type AppState = Arc<ProxyConfig>;

// 模型列表响应
#[derive(Debug, Serialize)]
pub struct ModelsResponse {
    object: String,
    data: Vec<ModelInfo>,
}

#[derive(Debug, Serialize)]
pub struct ModelInfo {
    id: String,
    object: String,
    created: i64,
    owned_by: String,
}

// OpenAI 聊天补全请求
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<Message>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

// OpenAI 聊天补全响应
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    id: String,
    object: String,
    created: i64,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Choice {
    index: i32,
    message: Message,
    finish_reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

// 错误响应
pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": {
                "message": self.message,
                "type": "api_error"
            }
        });
        (self.status, Json(body)).into_response()
    }
}

// GET /v1/models - 获取模型列表
pub async fn list_models(State(config): State<AppState>) -> Json<ModelsResponse> {
    let models = config
        .models
        .iter()
        .map(|m| ModelInfo {
            id: m.id.clone(),
            object: "model".to_string(),
            created: chrono::Utc::now().timestamp(),
            owned_by: m.model_type.clone(),
        })
        .collect();

    Json(ModelsResponse {
        object: "list".to_string(),
        data: models,
    })
}

// POST /v1/chat/completions - OpenAI 格式聊天补全
pub async fn chat_completions(
    State(config): State<AppState>,
    Json(req): Json<ChatCompletionRequest>,
) -> Result<Json<ChatCompletionResponse>, ApiError> {
    // 查找模型配置
    let model = config
        .get_model(&req.model)
        .ok_or_else(|| ApiError {
            status: StatusCode::NOT_FOUND,
            message: format!("Model '{}' not found", req.model),
        })?;

    // 查找端点配置
    let endpoint = config
        .get_endpoint(&model.endpoint_id)
        .ok_or_else(|| ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "Endpoint not found".to_string(),
        })?;

    log::info!(
        "Processing chat completion for model: {}, endpoint: {}",
        req.model,
        endpoint.base_url
    );

    // 根据端点类型转换请求格式
    match endpoint.endpoint_type.as_str() {
        "anthropic" => handle_anthropic_request(&req, model, endpoint).await,
        "openai" => handle_openai_request(&req, model, endpoint).await,
        _ => Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            message: format!("Unsupported endpoint type: {}", endpoint.endpoint_type),
        }),
    }
}

// 处理 Anthropic 格式请求
async fn handle_anthropic_request(
    req: &ChatCompletionRequest,
    model: &super::config::ModelConfig,
    endpoint: &super::config::EndpointConfig,
) -> Result<Json<ChatCompletionResponse>, ApiError> {
    // 转换为 Anthropic 格式
    let anthropic_req = json!({
        "model": model.id,
        "max_tokens": req.max_tokens.unwrap_or(4096),
        "messages": req.messages.iter().map(|m| json!({
            "role": m.role,
            "content": m.content
        })).collect::<Vec<_>>(),
    });

    // 发送请求到 Factory AI
    let client = reqwest::Client::new();
    let response = client
        .post(&endpoint.base_url)
        .header("x-api-key", &endpoint.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&anthropic_req)
        .send()
        .await
        .map_err(|e| ApiError {
            status: StatusCode::BAD_GATEWAY,
            message: format!("Failed to call upstream API: {}", e),
        })?;

    let status = response.status();
    let body: Value = response.json().await.map_err(|e| ApiError {
        status: StatusCode::BAD_GATEWAY,
        message: format!("Failed to parse response: {}", e),
    })?;

    if !status.is_success() {
        return Err(ApiError {
            status,
            message: format!("Upstream API error: {}", body),
        });
    }

    // 转换为 OpenAI 格式
    let content = body["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .unwrap_or("");

    let usage = Usage {
        prompt_tokens: body["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
        completion_tokens: body["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
        total_tokens: (body["usage"]["input_tokens"].as_u64().unwrap_or(0)
            + body["usage"]["output_tokens"].as_u64().unwrap_or(0)) as u32,
    };

    Ok(Json(ChatCompletionResponse {
        id: format!("chatcmpl-{}", chrono::Utc::now().timestamp()),
        object: "chat.completion".to_string(),
        created: chrono::Utc::now().timestamp(),
        model: req.model.clone(),
        choices: vec![Choice {
            index: 0,
            message: Message {
                role: "assistant".to_string(),
                content: content.to_string(),
            },
            finish_reason: "stop".to_string(),
        }],
        usage,
    }))
}

// 处理 OpenAI 格式请求
async fn handle_openai_request(
    req: &ChatCompletionRequest,
    _model: &super::config::ModelConfig,
    endpoint: &super::config::EndpointConfig,
) -> Result<Json<ChatCompletionResponse>, ApiError> {
    // 直接转发到 OpenAI 兼容端点
    let client = reqwest::Client::new();
    let response = client
        .post(&endpoint.base_url)
        .header("Authorization", format!("Bearer {}", endpoint.api_key))
        .header("content-type", "application/json")
        .json(&req)
        .send()
        .await
        .map_err(|e| ApiError {
            status: StatusCode::BAD_GATEWAY,
            message: format!("Failed to call upstream API: {}", e),
        })?;

    let status = response.status();
    let body: ChatCompletionResponse = response.json().await.map_err(|e| ApiError {
        status: StatusCode::BAD_GATEWAY,
        message: format!("Failed to parse response: {}", e),
    })?;

    if !status.is_success() {
        return Err(ApiError {
            status,
            message: "Upstream API error".to_string(),
        });
    }

    Ok(Json(body))
}

// POST /v1/responses - Factory AI 格式（转发到真实端点）
pub async fn responses_proxy(
    State(config): State<AppState>,
    Json(req): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    log::info!("POST /v1/responses - Factory format");
    
    // 获取模型ID
    let model_id = req["model"]
        .as_str()
        .ok_or_else(|| ApiError {
            status: StatusCode::BAD_REQUEST,
            message: "model field is required".to_string(),
        })?;
    
    // 查找模型配置
    let model = config
        .get_model(model_id)
        .ok_or_else(|| ApiError {
            status: StatusCode::NOT_FOUND,
            message: format!("Model '{}' not found", model_id),
        })?;
    
    // 查找端点配置
    let endpoint = config
        .get_endpoint(&model.endpoint_id)
        .ok_or_else(|| ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "Endpoint not found".to_string(),
        })?;
    
    log::info!(
        "Proxying to endpoint: {} (type: {})",
        endpoint.base_url,
        endpoint.endpoint_type
    );
    
    // 直接转发请求到上游
    let client = reqwest::Client::new();
    let response = client
        .post(&endpoint.base_url)
        .header("x-api-key", &endpoint.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&req)
        .send()
        .await
        .map_err(|e| ApiError {
            status: StatusCode::BAD_GATEWAY,
            message: format!("Failed to call upstream API: {}", e),
        })?;
    
    let status = response.status();
    
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(ApiError {
            status,
            message: format!("Upstream API error: {}", error_body),
        });
    }
    
    let body: Value = response.json().await.map_err(|e| ApiError {
        status: StatusCode::BAD_GATEWAY,
        message: format!("Failed to parse response: {}", e),
    })?;
    
    Ok(Json(body))
}
