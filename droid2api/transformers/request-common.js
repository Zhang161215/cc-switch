import { logDebug } from '../logger.js';
import { getSystemPrompt, getUserAgent } from '../config.js';

export function transformToCommon(openaiRequest) {
  logDebug('Transforming OpenAI request to Common format');
  
  // 基本保持 OpenAI 格式，只在 messages 前面插入 system 消息
  const commonRequest = {
    ...openaiRequest
  };

  const systemPrompt = getSystemPrompt();
  
  if (systemPrompt) {
    // 检查是否已有 system 消息
    const hasSystemMessage = commonRequest.messages?.some(m => m.role === 'system');
    
    if (hasSystemMessage) {
      // 如果已有 system 消息，在第一个 system 消息前插入我们的 system prompt
      commonRequest.messages = commonRequest.messages.map((msg, index) => {
        if (msg.role === 'system' && index === commonRequest.messages.findIndex(m => m.role === 'system')) {
          // 找到第一个 system 消息，前置我们的 prompt
          return {
            role: 'system',
            content: systemPrompt + (typeof msg.content === 'string' ? msg.content : '')
          };
        }
        return msg;
      });
    } else {
      // 如果没有 system 消息，在 messages 数组最前面插入
      commonRequest.messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...(commonRequest.messages || [])
      ];
    }
  }

  logDebug('Transformed Common request', commonRequest);
  return commonRequest;
}

export function getCommonHeaders(authHeader, clientHeaders = {}) {
  // Generate unique IDs if not provided
  const sessionId = clientHeaders['x-session-id'] || generateUUID();
  const messageId = clientHeaders['x-assistant-message-id'] || generateUUID();
  
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'authorization': authHeader || '',
    'x-api-provider': 'baseten',
    'x-factory-client': 'cli',
    'x-session-id': sessionId,
    'x-assistant-message-id': messageId,
    'user-agent': getUserAgent(),
    'connection': 'keep-alive'
  };

  // Pass through Stainless SDK headers with defaults
  const stainlessDefaults = {
    'x-stainless-arch': 'x64',
    'x-stainless-lang': 'js',
    'x-stainless-os': 'MacOS',
    'x-stainless-runtime': 'node',
    'x-stainless-retry-count': '0',
    'x-stainless-package-version': '5.23.2',
    'x-stainless-runtime-version': 'v24.3.0'
  };

  // Copy Stainless headers from client or use defaults
  Object.keys(stainlessDefaults).forEach(header => {
    headers[header] = clientHeaders[header] || stainlessDefaults[header];
  });

  return headers;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
