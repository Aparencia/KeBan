import { useState, useEffect, useRef } from 'react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { HardDrive, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  exportAllData,
  downloadExport,
  importData,
  readFileAsText,
  getStorageInfo,
} from '@/lib/storage';
import type { StorageInfo } from '@/lib/storage';

export default function DataSettings() {
  const { toast } = useToast();

  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStorageInfo().then((info) => {
      if (info) setStorageInfo(info);
    });
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

  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <h2 className="text-b1 font-semibold text-text-primary">数据管理</h2>

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
          <p className="text-b2 font-medium text-text-primary">本地存储</p>
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
    </Card>
  );
}
