import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { CheckCircle2 } from 'lucide-react';

interface TodoStatsProps {
  editor: Editor | null;
}

/** 遍历文档统计 taskItem 的已完成/总数 */
function countTaskItems(editor: Editor): { checked: number; total: number } {
  let checked = 0;
  let total = 0;

  editor.state.doc.descendants((node) => {
    if (node.type.name === 'taskItem') {
      total++;
      if (node.attrs.checked) {
        checked++;
      }
    }
  });

  return { checked, total };
}

export function TodoStats({ editor }: TodoStatsProps) {
  const [stats, setStats] = useState({ checked: 0, total: 0 });

  useEffect(() => {
    if (!editor) return;

    // 初始统计
    setStats(countTaskItems(editor));

    // 监听内容变化实时更新统计
    const handler = () => setStats(countTaskItems(editor));
    editor.on('update', handler);
    editor.on('transaction', handler);

    return () => {
      editor.off('update', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  // 没有待办项时不渲染
  if (stats.total === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-kb-md py-2 text-b2 text-semantic-success/80 select-none">
      <CheckCircle2 className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
      <span>已完成 {stats.checked}/{stats.total}</span>
    </div>
  );
}
