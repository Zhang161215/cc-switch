import { invoke } from "@tauri-apps/api/core";

export interface ServiceStatus {
  running: boolean;
  port: number;
  pid: number | null;
}

export class Droid2ApiService {
  static async start(): Promise<ServiceStatus> {
    return await invoke<ServiceStatus>("start_droid2api_service");
  }

  static async stop(): Promise<ServiceStatus> {
    return await invoke<ServiceStatus>("stop_droid2api_service");
  }

  static async getStatus(): Promise<ServiceStatus> {
    return await invoke<ServiceStatus>("get_droid2api_service_status");
  }

  static async testConnection(): Promise<boolean> {
    return await invoke<boolean>("test_droid2api_connection");
  }
}
