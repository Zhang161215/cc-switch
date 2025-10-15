import { invoke } from '@tauri-apps/api/core';

export class RustProxyServer {
  static async start(): Promise<string> {
    return await invoke<string>('start_proxy_server');
  }

  static async stop(): Promise<string> {
    return await invoke<string>('stop_proxy_server');
  }

  static async getStatus(): Promise<boolean> {
    return await invoke<boolean>('get_proxy_server_status');
  }

  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3000/v1/models');
      return response.ok;
    } catch {
      return false;
    }
  }
}
