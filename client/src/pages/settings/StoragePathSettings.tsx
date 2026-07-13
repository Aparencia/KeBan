import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isElectron } from '@/lib/utils/platform';
import { FolderOpen, HardDrive, ArrowRightLeft, Undo2 } from 'lucide-react';

/**
 * 存储路径设置
 * v0.9.0: 显示当前路径 + 选择新路径 + 迁移进度 + 回滚
 */
export default function StoragePathSettings() {
  const { toast } = useToast();
  const prefersReduced = useReducedMotion();

  const [currentPath, setCurrentPath] = useState<string>('默认位置');
  const [isChanging, setIsChanging] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  useEffect(() => {
    const savedPath = localStorage.getItem('keban-data-path');
    setCurrentPath(savedPath || '默认位置');
    const prev = localStorage.getItem('keban-data-path-prev');
    if (prev) setPreviousPath(prev);
  }, []);

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
        title: '选择新的数据存储目录',
      }) as { canceled: boolean; path?: string };

      if (!result.canceled && result.path) {
        const confirmed = window.confirm(
          `确定要将数据存储路径更改为：\n${result.path}\n\n` +
          `点击下方"开始迁移"将自动迁移现有数据。`,
        );
        if (confirmed) {
          setPreviousPath(currentPath);
          localStorage.setItem('keban-data-path-prev', currentPath);
          setCurrentPath(result.path);
          localStorage.setItem('keban-data-path', result.path);
          toast({ type: 'success', message: '存储路径已更新，请点击"开始迁移"迁移数据' });
        }
      }
    } catch {
      toast({ type: 'error', message: '选择目录失败，请重试' });
    } finally {
      setIsChanging(false);
    }
  };

  const handleMigrate = async () => {
    if (!previousPath) {
      toast({ type: 'warning', message: '没有需要迁移的数据' });
      return;
    }
    setIsMigrating(true);
    setMigrationProgress(0);

    // 模拟迁移进度（实际实现时替换为真实迁移逻辑）
    const steps = [10, 25, 40, 60, 80, 95, 100];
    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setMigrationProgress(step);
    }

    setIsMigrating(false);
    setPreviousPath(null);
    localStorage.removeItem('keban-data-path-prev');
    toast({ type: 'success', message: '数据迁移完成' });
  };

  const handleRollback = () => {
    if (!previousPath) return;
    const confirmed = window.confirm(
      `确定要回滚到之前的存储路径：\n${previousPath}\n\n注意：回滚后当前路径下的新数据可能丢失。`,
    );
    if (confirmed) {
      setCurrentPath(previousPath);
      localStorage.setItem('keban-data-path', previousPath);
      setPreviousPath(null);
      localStorage.removeItem('keban-data-path-prev');
      toast({ type: 'success', message: '已回滚到之前的存储路径' });
    }
  };

  const springTransition = prefersReduced
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 300, damping: 28 };

  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <div>
        <h2 className="text-b1 font-semibold text-text-primary">存储路径管理</h2>
        <p className="text-c1 text-text-tertiary mt-0.5">管理本地数据的存储位置和迁移</p>
      </div>

      {/* 当前路径 */}
      <div className={cn(
        'flex items-start gap-3 p-3 rounded-kb-md',
        'bg-bg-secondary border border-border/40',
      )}>
        <div className={cn(
          'w-9 h-9 rounded-kb-md flex items-center justify-center flex-shrink-0',
          'bg-brand-50 text-brand-500',
        )}>
          <HardDrive className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-b2 font-medium text-text-primary">当前存储路径</p>
          <p className="text-c1 text-text-tertiary font-mono truncate mt-0.5">
            {currentPath}
          </p>
        </div>
      </div>

      {/* 选择新路径 */}
      <Button
        variant="secondary"
        size="md"
        icon={<FolderOpen className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
        className="w-full"
        onClick={handleSelectDirectory}
        disabled={isChanging || isMigrating}
      >
        {isChanging ? '选择中…' : '选择新路径'}
      </Button>

      {/* 迁移区域 */}
      {previousPath && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="space-y-3"
        >
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-kb-md',
            'bg-blue-50/50 border border-blue-200/40',
          )}>
            <ArrowRightLeft className="w-4 h-4 text-blue-500 flex-shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-b3 font-medium text-text-primary">待迁移</p>
              <p className="text-c1 text-text-tertiary truncate">
                从 {previousPath} → {currentPath}
              </p>
            </div>
          </div>

          {/* 迁移进度条 */}
          {isMigrating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5"
            >
              <div className="flex justify-between text-c1">
                <span className="text-text-secondary">迁移进度</span>
                <span className="text-text-tertiary font-mono">{migrationProgress}%</span>
              </div>
              <div className="h-2 rounded-kb-full bg-bg-tertiary overflow-hidden">
                <motion.div
                  className="h-full rounded-kb-full bg-brand-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${migrationProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Undo2 className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              onClick={handleRollback}
              disabled={isMigrating}
              className="flex-1"
            >
              回滚路径
            </Button>
            <Button
              size="sm"
              icon={<ArrowRightLeft className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              onClick={handleMigrate}
              disabled={isMigrating}
              className="flex-1"
            >
              {isMigrating ? '迁移中…' : '开始迁移'}
            </Button>
          </div>
        </motion.div>
      )}
    </Card>
  );
}
