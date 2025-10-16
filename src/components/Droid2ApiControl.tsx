import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Droid2ApiService, type ServiceStatus } from '../lib/droid2api';

interface Droid2ApiControlProps {
  className?: string;
}

export function Droid2ApiControl({ className = '' }: Droid2ApiControlProps) {
  const [status, setStatus] = useState<ServiceStatus>({
    running: false,
    port: 3000,
    pid: null,
  });
  const [loading, setLoading] = useState(false);
  const [connectionOk, setConnectionOk] = useState(false);

  // 获取服务状态
  const refreshStatus = async () => {
    try {
      const newStatus = await Droid2ApiService.getStatus();
      setStatus(newStatus);
      
      // 如果服务运行中，测试连接
      if (newStatus.running) {
        const connected = await Droid2ApiService.testConnection();
        setConnectionOk(connected);
      } else {
        setConnectionOk(false);
      }
    } catch (error) {
      console.error('获取服务状态失败:', error);
    }
  };

  // 启动/停止服务
  const toggleService = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      if (status.running) {
        await Droid2ApiService.stop();
      } else {
        await Droid2ApiService.start();
      }
      await refreshStatus();
    } catch (error) {
      console.error('切换服务状态失败:', error);
      alert(`操作失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取初始状态
  useEffect(() => {
    refreshStatus();
    
    // 定期刷新状态 - 已禁用自动刷新
    // const interval = setInterval(refreshStatus, 10000); // 每10秒刷新一次
    // return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status.running && connectionOk) return 'text-green-600';
    if (status.running && !connectionOk) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getStatusText = () => {
    if (status.running && connectionOk) return '运行中 ✓';
    if (status.running && !connectionOk) return '启动中...';
    return '已停止';
  };

  return (
    <div className={`p-4 bg-gray-50 rounded-lg border ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">droid2api 代理服务</h3>
            <p className="text-sm text-gray-600">
              OpenAI兼容的API代理，支持智能推理级别控制
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          <div className="text-xs text-gray-500">
            端口: {status.port}
            {status.pid && ` | PID: ${status.pid}`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleService}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              status.running
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? '处理中...' : status.running ? '停止服务' : '启动服务'}
          </button>

          {status.running && connectionOk && (
            <div className="text-sm text-gray-600">
              🔗 <a 
                href="http://localhost:3000" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline"
              >
                http://localhost:3000
              </a>
            </div>
          )}
        </div>

        <button
          onClick={refreshStatus}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          刷新状态
        </button>
      </div>

      {status.running && (
        <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">API 端点</h4>
          <div className="text-xs text-blue-700 space-y-1">
            <div><code>GET  /v1/models</code> - 获取模型列表</div>
            <div><code>POST /v1/chat/completions</code> - OpenAI格式聊天</div>
            <div><code>POST /v1/messages</code> - Anthropic格式消息</div>
            <div><code>POST /v1/responses</code> - Factory格式响应</div>
          </div>
        </div>
      )}
    </div>
  );
}