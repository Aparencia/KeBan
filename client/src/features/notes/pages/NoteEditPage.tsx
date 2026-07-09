import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Quote, Undo2, Redo2, Save, Sparkles, X,
  Copy, RefreshCw, Download, ChevronDown, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNoteStore } from '../store/useNoteStore';
import { useAISummarize, useAIFlashcards } from '@/lib/ai/useAI';
import { useToast } from '@/components/ui';

interface ToolbarButtonProps {
  icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'p-2 rounded-kb-sm transition-all duration-kb-fast',
        isActive
          ? 'bg-brand-50 text-brand-600'
          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
        'active:bg-bg-secondary active:scale-95',
      )}
    >
      <Icon className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border/50 mx-1" />;
}

export default function NoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const noteId = id ?? null;

  const { notes, updateNote, selectNote, loadNotes } = useNoteStore();
  const note = notes.find((n) => n.id === noteId) || null;

  const titleRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Summary state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const { loading: aiLoading, data: aiData, error: aiError, summarize } = useAISummarize();
  const { toast } = useToast();

  // AI 摘要后续操作 hooks
  const { loading: flashcardLoading, generate: generateFlashcards } = useAIFlashcards();
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [convertedKeys, setConvertedKeys] = useState<Set<number>>(new Set());

  // === AI 摘要操作辅助函数 ===

  const buildSummaryText = useCallback((data: NonNullable<typeof aiData>) => {
    let text = data.summary;
    if (data.keyPoints && data.keyPoints.length > 0) {
      text += '\n\n关键要点：\n' + data.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n');
    }
    return text;
  }, []);

  // 解析初始内容
  const initialContent = useMemo(() => {
    if (!note?.content) return undefined;
    try {
      const parsed = JSON.parse(note.content);
      if (parsed && parsed.type === 'doc') return parsed;
      return undefined;
    } catch {
      return undefined;
    }
  // 只在 note.id 变化时重新计算
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // debounce 保存函数
  const debouncedSave = useCallback(
    (content: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (noteId) {
          updateNote(noteId, { content });
        }
      }, 500);
    },
    [noteId, updateNote],
  );

  // 清理 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: '开始记录你的笔记...' }),
    ],
    content: initialContent,
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON();
      const contentStr = JSON.stringify(json);
      debouncedSave(contentStr);
    },
  });

  const handleInsertNote = useCallback((position: 'cursor' | 'start' | 'end') => {
    if (!editor || !aiData) return;
    const text = buildSummaryText(aiData);
    const htmlContent = text.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
    if (position === 'cursor') {
      editor.chain().focus().insertContent(htmlContent).run();
    } else if (position === 'start') {
      const currentHTML = editor.getHTML();
      editor.chain().focus().setContent(htmlContent + currentHTML).run();
    } else {
      const docSize = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(docSize, htmlContent).run();
    }
    setInsertMenuOpen(false);
    setSummaryModalOpen(false);
    toast({ type: 'success', message: '摘要已插入笔记' });
  }, [editor, aiData, buildSummaryText, toast]);

  const handleCopySummary = useCallback(() => {
    if (!aiData) return;
    navigator.clipboard.writeText(buildSummaryText(aiData)).then(
      () => toast({ type: 'success', message: '摘要已复制到剪贴板' }),
      () => toast({ type: 'error', message: '复制失败' }),
    );
  }, [aiData, buildSummaryText, toast]);

  const handleGenerateFlashcard = useCallback(async (keyPoint: string, index: number) => {
    try {
      const result = await generateFlashcards(keyPoint);
      if (!result) throw new Error('generate failed');
      setConvertedKeys(prev => new Set(prev).add(index));
      toast({ type: 'success', message: `已生成 ${result.cards.length} 张闪卡` });
    } catch {
      toast({ type: 'error', message: '闪卡生成失败，请稍后重试' });
    }
  }, [generateFlashcards, toast]);

  const handleGenerateAllFlashcards = useCallback(async () => {
    if (!aiData?.keyPoints?.length) return;
    try {
      const result = await generateFlashcards(aiData.keyPoints.join('\n'));
      if (!result) throw new Error('generate failed');
      setConvertedKeys(new Set(aiData.keyPoints!.map((_, i) => i)));
      toast({ type: 'success', message: `已从全部要点生成 ${result.cards.length} 张闪卡` });
    } catch {
      toast({ type: 'error', message: '闪卡生成失败，请稍后重试' });
    }
  }, [aiData, generateFlashcards, toast]);

  const handleRegenerate = useCallback(() => {
    if (!editor) return;
    const text = editor.getText();
    if (!text.trim()) { toast({ type: 'warning', message: '笔记内容为空' }); return; }
    setConvertedKeys(new Set());
    summarize(text).catch(() => toast({ type: 'error', message: 'AI 摘要生成失败' }));
  }, [editor, summarize, toast]);

  const handleExport = useCallback(() => {
    if (!aiData) return;
    let md = `## 摘要\n\n${aiData.summary}\n`;
    if (aiData.keyPoints?.length) {
      md += '\n## 关键要点\n\n';
      aiData.keyPoints.forEach((kp, i) => { md += `${i + 1}. ${kp}\n`; });
    }
    md += `\n---\n*由课伴 AI 生成于 ${new Date(aiData.generatedAt).toLocaleString()}*\n`;
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `ai-summary-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: '摘要已导出' });
  }, [aiData, toast]);

  // 加载笔记数据
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // 选中当前笔记
  useEffect(() => {
    if (noteId) selectNote(noteId);
  }, [noteId, selectNote]);

  // 标题保存
  const handleTitleBlur = () => {
    if (noteId && titleRef.current) {
      const newTitle = titleRef.current.value.trim();
      if (newTitle && newTitle !== note?.title) {
        updateNote(noteId, { title: newTitle });
      }
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleRef.current?.blur();
    }
  };

  if (!note) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-kb-md text-center">
          <h3 className="text-h2 font-medium text-text-primary">笔记不存在</h3>
          <p className="text-b2 text-text-tertiary">该笔记可能已被删除</p>
          <button
            onClick={() => navigate('/notes')}
            className="mt-2 text-brand-600 hover:text-brand-700 text-b2 font-medium"
          >
            返回笔记列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 顶部栏 */}
      <div className="flex items-center gap-kb-sm px-kb-md py-3 border-b border-border/50 flex-shrink-0">
        <button
          onClick={() => navigate('/notes')}
          className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
          aria-label="返回"
        >
          <ArrowLeft className="w-icon-md h-icon-md" strokeWidth={1.5} />
        </button>

        <input
          ref={titleRef}
          defaultValue={note.title}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="输入笔记标题..."
          className={cn(
            'flex-1 bg-transparent outline-none text-h2 font-semibold text-text-primary',
            'placeholder:text-text-tertiary/60',
          )}
        />

        <button
          onClick={() => {
            if (editor) {
              const content = JSON.stringify(editor.getJSON());
              updateNote(noteId!, { content, title: titleRef.current?.value || note.title });
            }
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium',
            'bg-bg-secondary text-text-secondary border border-border/50',
            'hover:bg-bg-tertiary hover:text-text-primary',
            'active:scale-95 transition-all duration-kb-fast',
          )}
        >
          <Save className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          保存
        </button>

        <button
          onClick={() => {
            if (!editor) return;
            const text = editor.getText();
            if (!text.trim()) {
              toast({ type: 'warning', message: '请先写一些笔记内容再生成摘要' });
              return;
            }
            summarize(text)
              .then(() => setSummaryModalOpen(true))
              .catch(() => toast({ type: 'error', message: 'AI 摘要生成失败，请稍后重试' }));
          }}
          disabled={aiLoading}
          title={aiLoading ? '正在生成摘要…' : 'AI 摘要'}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium',
            'bg-brand-600 text-white',
            'hover:bg-brand-700 active:scale-95 transition-all duration-kb-fast',
            aiLoading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {aiLoading ? (
            <svg className="w-icon-sm h-icon-sm animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Sparkles className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          )}
          AI 摘要
        </button>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-kb-md py-2 border-b border-border/40 flex-shrink-0 overflow-x-auto">
        <ToolbarButton icon={Undo2} label="撤销" onClick={() => editor?.chain().focus().undo().run()} />
        <ToolbarButton icon={Redo2} label="重做" onClick={() => editor?.chain().focus().redo().run()} />
        <ToolbarDivider />
        <ToolbarButton
          icon={Heading1}
          label="标题 1"
          isActive={editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          icon={Heading2}
          label="标题 2"
          isActive={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          icon={Heading3}
          label="标题 3"
          isActive={editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={Bold}
          label="加粗"
          isActive={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="斜体"
          isActive={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={UnderlineIcon}
          label="下划线"
          isActive={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="删除线"
          isActive={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          icon={Highlighter}
          label="高亮"
          isActive={editor?.isActive('highlight')}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={List}
          label="无序列表"
          isActive={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="有序列表"
          isActive={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={Quote}
          label="引用"
          isActive={editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={Code}
          label="代码块"
          isActive={editor?.isActive('codeBlock')}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
      </div>

      {/* 编辑区 */}
      <div className="flex-1 overflow-y-auto px-kb-md py-kb-lg">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* AI 摘要结果弹窗 */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-kb-md">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSummaryModalOpen(false)}
            aria-hidden
          />
          <div className={cn(
            'relative w-full max-w-lg bg-bg-elevated rounded-kb-xl shadow-kb-lg',
            'border border-border/40 p-kb-lg',
          )}>
            <button
              onClick={() => setSummaryModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
            >
              <X className="w-icon-md h-icon-md" />
            </button>
            <h2 className="text-h2 font-semibold text-text-primary flex items-center gap-2 pr-8">
              <Sparkles className="w-icon-md h-icon-md text-brand-500" strokeWidth={1.5} />
              AI 摘要
            </h2>

            {aiLoading && (
              <div className="mt-kb-md flex items-center gap-2 text-b2 text-text-secondary">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                正在生成摘要…
              </div>
            )}

            {aiError && !aiLoading && (
              <div className="mt-kb-md p-3 rounded-kb-md bg-rose-500/10 border border-rose-500/20 text-b2 text-rose-500">
                {aiError}
              </div>
            )}

            {aiData && !aiLoading && (
              <div className="mt-kb-md flex flex-col gap-kb-md">
                {/* 摘要文本 + 复制按钮 */}
                <div className="group relative">
                  <p className="text-b3 font-medium text-text-tertiary uppercase tracking-wide mb-1">摘要</p>
                  <p className="text-b2 text-text-secondary leading-relaxed pr-8">{aiData.summary}</p>
                  <button
                    onClick={handleCopySummary}
                    title="复制摘要"
                    className="absolute top-0 right-0 p-1.5 rounded-kb-sm text-text-tertiary hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100 transition-all duration-kb-fast"
                  >
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* 关键要点 + 逐项闪卡按钮 */}
                {(aiData.keyPoints?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-b3 font-medium text-text-tertiary uppercase tracking-wide mb-1">关键要点</p>
                    <ul className="flex flex-col gap-1.5">
                      {aiData.keyPoints?.map((kp, i) => (
                        <li key={i} className="group flex items-start gap-2 text-b2 text-text-secondary rounded-kb-sm px-2 py-1 -mx-2 hover:bg-bg-tertiary/50 transition-colors">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-kb-full bg-brand-500 flex-shrink-0" />
                          <span className="flex-1">{kp}</span>
                          <button
                            onClick={() => handleGenerateFlashcard(kp, i)}
                            disabled={flashcardLoading}
                            title={convertedKeys.has(i) ? '已生成闪卡' : '生成闪卡'}
                            className={`flex-shrink-0 p-1 rounded-kb-sm transition-all duration-kb-fast ${
                              convertedKeys.has(i)
                                ? 'text-emerald-500 opacity-100'
                                : 'text-text-tertiary hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100'
                            } ${flashcardLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {convertedKeys.has(i) ? (
                              <Check className="w-3.5 h-3.5" strokeWidth={2} />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 智能建议区 */}
                {(aiData.keyPoints?.length ?? 0) > 2 && (
                  <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200/30 rounded-kb-md">
                    <span className="text-b2 text-brand-700">
                      💡 检测到 {aiData.keyPoints!.length} 个核心概念，适合制作复习闪卡
                    </span>
                    <button
                      onClick={handleGenerateAllFlashcards}
                      disabled={flashcardLoading}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b3 font-medium bg-brand-600 text-white hover:bg-brand-700 active:scale-95 transition-all duration-kb-fast ${
                        flashcardLoading ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      {flashcardLoading ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                      )}
                      一键生成
                    </button>
                  </div>
                )}

                {/* 通用操作区 */}
                <div className="border-t border-border/30 pt-3 mt-1 flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setInsertMenuOpen(!insertMenuOpen)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium bg-bg-secondary text-text-secondary border border-border/50 hover:bg-bg-tertiary hover:text-text-primary active:scale-95 transition-all duration-kb-fast"
                    >
                      插入笔记
                      <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                    {insertMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-1 w-36 bg-bg-elevated rounded-kb-md shadow-kb-md border border-border/40 py-1 z-10">
                        <button onClick={() => handleInsertNote('cursor')} className="w-full text-left px-3 py-2 text-b2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">光标位置</button>
                        <button onClick={() => handleInsertNote('start')} className="w-full text-left px-3 py-2 text-b2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">笔记开头</button>
                        <button onClick={() => handleInsertNote('end')} className="w-full text-left px-3 py-2 text-b2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">笔记末尾</button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleRegenerate}
                    disabled={aiLoading}
                    title="重新生成摘要"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium bg-bg-secondary text-text-secondary border border-border/50 hover:bg-bg-tertiary hover:text-text-primary active:scale-95 transition-all duration-kb-fast ${
                      aiLoading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {aiLoading ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                    重新生成
                  </button>

                  <button
                    onClick={handleExport}
                    title="导出摘要"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium bg-bg-secondary text-text-secondary border border-border/50 hover:bg-bg-tertiary hover:text-text-primary active:scale-95 transition-all duration-kb-fast"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                    导出
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
