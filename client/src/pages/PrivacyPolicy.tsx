/**
 * 隐私政策页面
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-bg-primary">
      <div className="max-w-2xl mx-auto p-kb-xl">
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowLeft className="w-icon-sm h-icon-sm" />}
          onClick={() => navigate(-1)}
        >
          返回
        </Button>
        <div className="mt-kb-lg">
          <h1 className="text-d1 font-bold text-text-primary flex items-center gap-2">
            <Shield className="w-icon-xl h-icon-xl text-brand-500" />
            隐私政策
          </h1>
          <p className="text-b3 text-text-tertiary mt-2">最后更新：2025-07-11</p>

          <div className="mt-kb-lg space-y-kb-md text-b1 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">1. 数据存储</h2>
              <p className="mt-2">课伴采用本地优先的数据存储策略。您的所有学习数据（包括但不限于笔记、闪卡、番茄钟记录、费曼学习笔记等）默认存储在您的本地设备上。只有在您主动开启云端同步功能时，数据才会通过加密通道传输到我们的服务器。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">2. AI 功能</h2>
              <p className="mt-2">课伴集成了 AI 辅助功能（如内容摘要、闪卡生成、费曼评估等）。当您使用这些功能时，您主动提交的内容会被发送至 AI 服务提供商进行处理。我们不会将您的数据用于 AI 模型训练。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">3. 数据控制</h2>
              <p className="mt-2">您对自己的数据拥有完全控制权。您可以随时导出所有数据为 JSON 格式，也可以清除所有本地数据。云端同步的数据也可通过设置页面进行管理。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">4. 联系我们</h2>
              <p className="mt-2">如果您对本隐私政策有任何疑问，请通过项目 GitHub 仓库提交 Issue 与我们联系。</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
