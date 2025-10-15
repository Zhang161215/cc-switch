use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub port: u16,
    pub models: Vec<ModelConfig>,
    pub endpoints: Vec<EndpointConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    #[serde(rename = "type")]
    pub model_type: String,
    pub name: String,
    pub endpoint_id: String,
    #[serde(default)]
    pub reasoning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointConfig {
    pub id: String,
    #[serde(rename = "type")]
    pub endpoint_type: String,
    pub base_url: String,
    pub api_key: String,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            models: vec![
                ModelConfig {
                    id: "claude-opus-4-1-20250805".to_string(),
                    model_type: "anthropic".to_string(),
                    name: "Claude Opus 4.1".to_string(),
                    endpoint_id: "factory-anthropic".to_string(),
                    reasoning: Some("extended".to_string()),
                },
                ModelConfig {
                    id: "claude-sonnet-4-20250514".to_string(),
                    model_type: "anthropic".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                    endpoint_id: "factory-anthropic".to_string(),
                    reasoning: Some("extended".to_string()),
                },
                ModelConfig {
                    id: "claude-sonnet-4-5-20250929".to_string(),
                    model_type: "anthropic".to_string(),
                    name: "Claude Sonnet 4.5".to_string(),
                    endpoint_id: "factory-anthropic".to_string(),
                    reasoning: Some("extended".to_string()),
                },
            ],
            endpoints: vec![
                EndpointConfig {
                    id: "factory-anthropic".to_string(),
                    endpoint_type: "anthropic".to_string(),
                    base_url: "https://app.factory.ai/api/llm/a/v1/messages".to_string(),
                    api_key: String::new(), // 从环境变量或配置读取
                },
            ],
        }
    }
}

impl ProxyConfig {
    pub fn get_model(&self, model_id: &str) -> Option<&ModelConfig> {
        self.models.iter().find(|m| m.id == model_id)
    }

    pub fn get_endpoint(&self, endpoint_id: &str) -> Option<&EndpointConfig> {
        self.endpoints.iter().find(|e| e.id == endpoint_id)
    }
}
