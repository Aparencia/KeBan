import { Card } from '@/components/ui';
import { Shield, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// 版本号：后续应从 import.meta.env.PACKAGE_VERSION 读取
const APP_VERSION = 'v0.5.0-alpha.2 · MVP-2';

export default function AboutSettings() {
  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <h2 className="text-b1 font-semibold text-text-primary">关于</h2>

      <div className="flex items-center gap-3">
        <div className={cn(
          'w-11 h-11 rounded-kb-lg flex items-center justify-center flex-shrink-0',
          'bg-brand-600 text-white',
          'shadow-kb-sm',
        )}>
          <span className="text-b1 font-bold">课</span>
        </div>
        <div>
          <p className="text-b1 font-semibold text-text-primary">课伴</p>
          <p className="text-c1 text-text-tertiary">{APP_VERSION}</p>
        </div>
      </div>

      <div className={cn(
        'p-3 rounded-kb-md',
        'bg-bg-secondary border border-border/40',
      )}>
        <p className="text-b3 text-text-secondary leading-relaxed">
          <span className="font-medium text-brand-600">技术栈：</span>
          React 18 + TypeScript + Vite + TailwindCSS + IndexedDB
        </p>
      </div>

      <div className={cn(
        'flex items-start gap-2.5 p-3 rounded-kb-md',
        'bg-semantic-success/5 border border-semantic-success/20',
      )}>
        <Shield className="w-icon-sm h-icon-sm text-semantic-success flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-b3 text-text-secondary leading-relaxed">
          <span className="font-medium text-semantic-success">隐私优先：</span>
          本地优先架构，数据完全保存在您的设备上，不会上传至任何服务器。
        </p>
      </div>

      <div className={cn(
        'flex items-start gap-2.5 p-3 rounded-kb-md',
        'bg-bg-secondary border border-border/40',
      )}>
        <Info className="w-icon-sm h-icon-sm text-text-tertiary flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-c1 text-text-tertiary leading-relaxed">
          课伴是一款面向学生的本地优先学习工具，集成番茄钟、智能笔记、间隔重复闪卡和费曼学习法四大核心模块，
          帮助你建立科学高效的学习习惯。
        </p>
      </div>
    </Card>
  );
}
