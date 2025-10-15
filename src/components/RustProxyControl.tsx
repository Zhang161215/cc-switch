import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { RustProxyServer } from '../lib/rust-proxy';

interface RustProxyControlProps {
  className?: string;
}

export function RustProxyControl({ className = '' }: RustProxyControlProps) {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionOk, setConnectionOk] = useState(false);

  // 获取服务状态
  const refreshStatus = async () => {
    try {
      const status = await RustProxyServer.getStatus();
      setRunning(status);
      
      if (status) {
        const connected = await RustProxyServer.testConnection();
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
      if (running) {
        const result = await RustProxyServer.stop();
        console.log('停止服务:', result);
      } else {
        const result = await RustProxyServer.start();
        console.log('启动服务:', result);
      }
      
      // 等待一下让服务启动
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshStatus();
    } catch (error: any) {
      console.error('切换服务状态失败:', error);
      alert(`操作失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取初始状态
  useEffect(() => {
    refreshStatus();
    
    // 定期刷新状态
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (running && connectionOk) return 'text-green-600';
    if (running && !connectionOk) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getStatusText = () => {
    if (running && connectionOk) return '运行中 ✓';
    if (running && !connectionOk) return '启动中...';
    return '已停止';
  };

  return (
    <div className={`p-4 bg-gray-50 rounded-lg border ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Cpu className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Rust API 代理服务</h3>
            <p className="text-sm text-gray-600">
              原生高性能API代理，零依赖 🚀
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          <div className="text-xs text-gray-500">
            端口: 3000
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleService}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              running
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? '处理中...' : running ? '停止服务' : '启动服务'}
          </button>

          {running && connectionOk && (
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

      {running && (
        <div className="mt-3 p-3 bg-purple-50 rounded border border-purple-200">
          <h4 className="text-sm font-medium text-purple-900 mb-2">API 端点</h4>
          <div className="text-xs text-purple-700 space-y-1">
            <div><code>GET  /v1/models</code> - 获取模型列表</div>
            <div><code>POST /v1/chat/completions</code> - OpenAI格式聊天</div>
          </div>
          <div className="mt-2 text-xs text-purple-600">
            ⚡️ 原生Rust实现，性能极佳，无需Node.js
          </div>
        </div>
      )}
    </div>
  );
}
