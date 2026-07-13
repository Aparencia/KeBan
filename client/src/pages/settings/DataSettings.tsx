import { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { HardDrive, Download, Upload, FolderOpen, AlertTriangle, Lock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isElectron } from '@/lib/utils/platform';
import {
  exportAllData,
  downloadExport,
  importData,
  readFileAsText,
  getStorageInfo,
} from '@/lib/storage';
import type { StorageInfo } from '@/lib/storage';
import { encryptBackup, decryptBackup, type EncryptedBackup } from '@/lib/crypto/backupCrypto';

export default function DataSettings() {
  const { toast } = useToast();

  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isChanging, setIsChanging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // v0.9.0: Encrypted backup state
  const [backupPassword, setBackupPassword] = useState('');
  const [creatingEncryptedBackup, setCreatingEncryptedBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStorageInfo().then((info) => {
      if (info) setStorageInfo(info);
    });
    const savedPath = localStorage.getItem('keban-data-path');
    setCurrentPath(savedPath || '默认位置');
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const json = await exportAllData();
      downloadExport(json);
      toast({ type: 'success', message: '数据导出成功' });
    } catch {
      toast({ type: 'error', message: '导出失败，请重试' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置 input 以便同一文件可以再次选择
    e.target.value = '';

    try {
      setImporting(true);
      const text = await readFileAsText(file);
      const result = await importData(text);
      if (result.success) {
        toast({ type: 'success', message: result.message });
        // 刷新页面以加载新数据
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast({ type: 'error', message: result.message });
      }
    } catch {
      toast({ type: 'error', message: '导入失败，请检查文件格式' });
    } finally {
      setImporting(false);
    }
  };

  // v0.9.0: Create encrypted backup
  const handleEncryptedBackup = async () => {
    try {
      setCreatingEncryptedBackup(true);
      const json = await exportAllData();
      const plaintext = JSON.stringify(json);

      if (backupPassword.trim()) {
        const encrypted = await encryptBackup(plaintext, backupPassword);
        const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keban-backup-encrypted-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ type: 'success', message: '加密备份已下载' });
      } else {
        downloadExport(json);
        toast({ type: 'success', message: '数据导出成功（未加密）' });
      }
    } catch {
      toast({ type: 'error', message: '备份失败，请重试' });
    } finally {
      setCreatingEncryptedBackup(false);
    }
  };

  // v0.9.0: Restore from backup file (auto-detect encrypted/plain)
  const handleBackupFileClick = () => {
    backupFileInputRef.current?.click();
  };

  const handleBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      setRestoringBackup(true);
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);

      // Auto-detect: if parsed has salt+iv+ciphertext, it's encrypted
      if (parsed.salt && parsed.iv && parsed.ciphertext) {
        if (!restorePassword.trim()) {
          toast({ type: 'error', message: '这是加密备份，请输入解密密码' });
          setRestoringBackup(false);
          return;
        }
        const plaintext = await decryptBackup(parsed as EncryptedBackup, restorePassword);
        const result = await importData(plaintext);
        if (result.success) {
          toast({ type: 'success', message: result.message });
          setTimeout(() => window.location.reload(), 800);
        } else {
          toast({ type: 'error', message: result.message });
        }
      } else {
        // Plain JSON backup
        const result = await importData(text);
        if (result.success) {
          toast({ type: 'success', message: result.message });
          setTimeout(() => window.location.reload(), 800);
        } else {
          toast({ type: 'error', message: result.message });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('decrypt')) {
        toast({ type: 'error', message: '解密失败，请检查密码是否正确' });
      } else {
        toast({ type: 'error', message: '恢复失败，请检查文件格式' });
      }
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleSelectDirectory = async () => {
    if (!isElectron()) {
      toast({ type: 'error', message: '请在桌面端使用此功能' });
      return;
    }

    try {
      setIsChanging(true);
      if (!window.electronAPI) {
        toast({ type: 'error', message: '请在桌面端使用此功能' });
        return;
      }
      const result = await window.electronAPI.invoke('dialog:selectDirectory', {
        title: '选择数据存储目录',
      }) as { canceled: boolean; path?: string };

      if (!result.canceled && result.path) {
        const confirmed = window.confirm(
          `确定要将数据存储路径更改为：\n${result.path}\n\n` +
          `注意：当前数据不会自动迁移。\n` +
          `建议先导出所有数据，更改路径后再导入。`,
        );

        if (confirmed) {
          localStorage.setItem('keban-data-path', result.path);
          setCurrentPath(result.path);
          toast({ type: 'success', message: '存储路径已更新' });
        }
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast({ type: 'error', message: '选择目录失败，请重试' });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <h2 className="text-b1 font-semibold text-text-primary">数据与存储</h2>

      {/* 存储使用情况 */}
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-kb-md',
        'bg-bg-secondary border border-border/40',
      )}>
        <div className={cn(
          'w-9 h-9 rounded-kb-md flex items-center justify-center flex-shrink-0',
          'bg-brand-50 text-brand-500',
        )}>
          <HardDrive className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-b2 font-medium text-text-primary">存储使用情况</p>
          <p className="text-c1 text-text-tertiary">
            已使用{' '}
            <span className="text-brand-600 font-medium">
              {storageInfo ? storageInfo.formatted.used : '—'}
            </span>
            {storageInfo && storageInfo.quota > 0
              ? ` / ${storageInfo.formatted.quota}`
              : ' / 不限'}
          </p>
        </div>
      </div>

      {/* 存储路径选择 */}
      <div className={cn(
        'flex items-start gap-3 p-3 rounded-kb-md',
        'bg-bg-secondary border border-border/40',
      )}>
        <div className={cn(
          'w-9 h-9 rounded-kb-md flex items-center justify-center flex-shrink-0',
          'bg-brand-50 text-brand-500',
        )}>
          <FolderOpen className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-b2 font-medium text-text-primary">数据存储路径</p>
          <p className="text-c1 text-text-tertiary font-mono truncate mt-0.5">
            {currentPath}
          </p>
        </div>
      </div>

      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-kb-md',
        'bg-semantic-warning/10 border border-semantic-warning/20',
      )}>
        <AlertTriangle className="w-4 h-4 text-semantic-warning flex-shrink-0" strokeWidth={1.5} />
        <p className="text-c1 text-text-secondary leading-relaxed">
          更改路径后，现有数据不会自动迁移。请先导出所有数据，更改路径后再导入。
        </p>
      </div>

      <Button
        variant="secondary"
        size="md"
        icon={<FolderOpen className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
        className="w-full"
        onClick={handleSelectDirectory}
        disabled={isChanging}
      >
        {isChanging ? '选择中…' : '更改存储路径'}
      </Button>

      {/* 导出/导入 */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="md"
          icon={<Download className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="w-full"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? '导出中…' : '导出数据'}
        </Button>
        <Button
          variant="secondary"
          size="md"
          icon={<Upload className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="w-full"
          onClick={handleImportClick}
          disabled={importing}
        >
          {importing ? '导入中…' : '导入数据'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* v0.9.0: 本地加密备份 */}
      <div className="border-t border-border/30 pt-kb-md flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
          <h3 className="text-b2 font-medium text-text-primary">本地加密备份</h3>
        </div>
        <p className="text-c1 text-text-tertiary">
          使用 AES-256-GCM 加密你的备份数据，设置密码保护隐私。
        </p>
        <Input
          size="sm"
          type="password"
          placeholder="设置备份密码（可选，留空则不加密）"
          value={backupPassword}
          onChange={(e) => setBackupPassword(e.target.value)}
        />
        <Button
          variant="primary"
          size="md"
          icon={<Shield className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="w-full"
          onClick={handleEncryptedBackup}
          disabled={creatingEncryptedBackup}
        >
          {creatingEncryptedBackup
            ? '创建中…'
            : backupPassword.trim()
              ? '创建加密备份'
              : '创建备份（未加密）'}
        </Button>
      </div>

      {/* v0.9.0: 恢复数据 */}
      <div className="border-t border-border/30 pt-kb-md flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
          <h3 className="text-b2 font-medium text-text-primary">恢复数据</h3>
        </div>
        <p className="text-c1 text-text-tertiary">
          支持普通备份和加密备份文件，自动检测文件格式。
        </p>
        <Input
          size="sm"
          type="password"
          placeholder="解密密码（仅加密备份需要）"
          value={restorePassword}
          onChange={(e) => setRestorePassword(e.target.value)}
        />
        <Button
          variant="secondary"
          size="md"
          icon={<Upload className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="w-full"
          onClick={handleBackupFileClick}
          disabled={restoringBackup}
        >
          {restoringBackup ? '恢复中…' : '选择备份文件'}
        </Button>
        <input
          ref={backupFileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleBackupFileChange}
        />
      </div>
    </Card>
  );
}
