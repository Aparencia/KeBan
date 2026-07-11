/**
 * 用户协议页面
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function TermsOfService() {
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
            <FileText className="w-icon-xl h-icon-xl text-brand-500" />
            用户协议
          </h1>
          <p className="text-b3 text-text-tertiary mt-2">最后更新：2025-07-11</p>

          <div className="mt-kb-lg space-y-kb-md text-b1 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">1. 使用范围</h2>
              <p className="mt-2">课伴仅供个人学习使用，不得用于商业目的或违法行为。您在使用本软件时应遵守所在国家/地区的相关法律法规。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">2. AI 生成内容</h2>
              <p className="mt-2">课伴集成的 AI 功能所生成的内容（包括但不限于摘要、闪卡、评估反馈等）仅供参考，不构成任何形式的专业建议。您应对 AI 生成内容的准确性自行判断和验证。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">3. 数据备份责任</h2>
              <p className="mt-2">您对自己的学习数据负有备份责任。虽然我们提供了数据导出功能，但建议您定期备份重要数据。因设备故障、误操作等原因造成的数据丢失，我们不承担相关责任。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">4. 免责声明</h2>
              <p className="mt-2">本软件按"现状"提供，不提供任何形式的明示或暗示保证，包括但不限于对适销性、特定用途适用性和不侵权的保证。在任何情况下，作者均不对因使用本软件而产生的任何损害承担责任。</p>
            </section>
            <section>
              <h2 className="text-h2 font-semibold text-text-primary">5. 协议更新</h2>
              <p className="mt-2">我们保留在必要时更新本协议的权利。协议更新后，继续使用本软件即视为您同意更新后的协议内容。重大变更将通过应用内通知的方式告知用户。</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
