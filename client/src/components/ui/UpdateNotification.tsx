/**
 * 更新通知组件
 *
 * 监听 autoUpdater 的 update-status 事件，
 * 显示更新状态（发现更新 → 下载进度 → 安装确认）。
 */
import { useState, useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

export default function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.on) return;

    const cleanup = window.electronAPI.on('update-status', (data: unknown) => {
      setUpdateStatus(data as UpdateStatus);
      setDismissed(false);
    });

    return cleanup;
  }, []);

  if (!updateStatus || dismissed) return null;
  if (updateStatus.status === 'not-available' || updateStatus.status === 'checking') return null;

  const handleDownload = () => {
    window.electronAPI?.invoke('update:download');
  };

  const handleInstall = () => {
    window.electronAPI?.invoke('update:install');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-bg-elevated border border-border rounded-kb-lg shadow-kb-lg p-kb-md animate-fade-in-up">
      <div className="flex items-start justify-between gap-kb-sm">
        <div className="flex-1">
          {updateStatus.status === 'available' && (
            <>
              <p className="text-b1 font-medium text-text-primary">
                发现新版本 v{updateStatus.version}
              </p>
              <p className="text-b3 text-text-secondary mt-1">点击下方按钮开始下载</p>
              <button onClick={handleDownload} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white rounded-kb-md text-b3 hover:bg-brand-600 transition-colors">
                <Download className="w-icon-xs h-icon-xs" /> 下载更新
              </button>
            </>
          )}
          {updateStatus.status === 'downloading' && (
            <>
              <p className="text-b1 font-medium text-text-primary">正在下载更新...</p>
              <div className="mt-2 w-full bg-bg-tertiary rounded-kb-full h-2">
                <div className="h-full bg-brand-500 rounded-kb-full transition-all" style={{ width: `${updateStatus.percent || 0}%` }} />
              </div>
              <p className="text-b3 text-text-secondary mt-1">{updateStatus.percent || 0}%</p>
            </>
          )}
          {updateStatus.status === 'downloaded' && (
            <>
              <p className="text-b1 font-medium text-text-primary">更新已就绪 v{updateStatus.version}</p>
              <button onClick={handleInstall} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white rounded-kb-md text-b3 hover:bg-brand-600 transition-colors">
                <RefreshCw className="w-icon-xs h-icon-xs" /> 安装并重启
              </button>
            </>
          )}
          {updateStatus.status === 'error' && (
            <p className="text-b3 text-semantic-error">更新检查失败：{updateStatus.message}</p>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="text-text-tertiary hover:text-text-secondary">
          <X className="w-icon-sm h-icon-sm" />
        </button>
      </div>
    </div>
  );
}
