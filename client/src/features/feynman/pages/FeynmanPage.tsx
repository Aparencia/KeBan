import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Button, Tag, Modal, Input, EmptyState, Skeleton, ContextMenu } from '@/components/ui';
import type { ContextMenuGroup } from '@/components/ui';
import { Plus, BookOpen, AlertTriangle, Trash2, CheckCircle, ArrowRight, MessageCircle, Lightbulb, SearchCheck, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useFeynmanStore } from '../store/useFeynmanStore';
import { useContextMenu } from '@/lib/contextMenu';
import { useToast } from '@/components/ui';
import type { FeynmanNote } from '@/types/models';

const stepLabels: Record<number, string> = { 1: '选择概念', 2: '讲解中', 3: '标注薄弱', 4: '简化重述' };

const statusConfig: Record<string, { label: string; color: 'default' | 'feynman' | 'brand' }> = {
  not_started: { label: '未开始', color: 'default' },
  in_progress: { label: '进行中', color: 'feynman' },
  completed:   { label: '已完成', color: 'brand' },
};

function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function FeynmanPage() {
  const navigate = useNavigate();
  const { notes, weakPoints, isLoading, loadNotes, loadWeakPointsForNotes, createNote, deleteNote, getStats, toggleWeakPointMastered } = useFeynmanStore();
  const { toast } = useToast();

  // 右键菜单 hook
  const {
    isOpen: ctxMenuOpen,
    position: ctxMenuPos,
    context: ctxMenuNote,
    handleContextMenu: handleNoteCtx,
    close: closeCtxMenu,
  } = useContextMenu<FeynmanNote>();

  const [modalOpen, setModalOpen] = useState(false);
  const [weakModalOpen, setWeakModalOpen] = useState(false);
  const [newConcept, setNewConcept] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 汇总所有未掌握的薄弱点，附带来源概念名
  const unmasteredWeakPoints = useMemo(() => {
    const result: { wp: (typeof weakPoints)[number][number]; concept: string; noteId: string }[] = [];
    for (const [noteId, wps] of Object.entries(weakPoints)) {
      const note = notes.find((n) => n.id === noteId);
      const concept = note?.concept ?? '未知概念';
      for (const wp of wps) {
        if (!wp.mastered) {
          result.push({ wp, concept, noteId });
        }
      }
    }
    return result;
  }, [weakPoints, notes]);

  useEffect(() => {
    loadNotes().then(() => {
      const ids = notes.map((n) => n.id!).filter(Boolean);
      if (ids.length > 0) loadWeakPointsForNotes(ids);
    });
  }, [loadNotes, loadWeakPointsForNotes]);

  // Load weakPoints once notes are available
  useEffect(() => {
    const ids = notes.map((n) => n.id!).filter(Boolean);
    if (ids.length > 0) {
      loadWeakPointsForNotes(ids);
    }
  }, [notes.length, loadWeakPointsForNotes]);

  const handleCreate = useCallback(async () => {
    const trimmed = newConcept.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const id = await createNote(trimmed);
      setModalOpen(false);
      setNewConcept('');
      navigate(`/feynman/${id}`);
    } finally {
      setCreating(false);
    }
  }, [newConcept, createNote, navigate]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNote(id);
    setDeleteId(null);
  }, [deleteNote]);

  const handleConfirmDelete = useCallback(async (note: FeynmanNote) => {
    if (note.id) {
      await deleteNote(note.id);
      toast({ type: 'success', message: '学习会话已删除' });
    }
    setDeleteId(null);
  }, [deleteNote, toast]);

  // 右键菜单分组定义
  const ctxMenuGroups = useMemo<ContextMenuGroup[]>(() => [
    {
      label: '会话操作',
      items: [
        { key: 'open', label: '打开学习', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
      ],
    },
    {
      label: 'AI 操作',
      items: [
        { key: 'ai-follow-up', label: 'AI 追问', icon: <MessageCircle className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'ai-simplify', label: '通俗化解释', icon: <Lightbulb className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'ai-gap-check', label: '查漏补缺', icon: <SearchCheck className="w-4 h-4" strokeWidth={1.5} /> },
      ],
    },
    {
      items: [
        { key: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" strokeWidth={1.5} />, danger: true },
      ],
    },
  ], []);

  // 右键菜单选中回调
  const handleCtxMenuSelect = useCallback((itemKey: string, noteCtx: FeynmanNote) => {
    switch (itemKey) {
      case 'open':
        navigate(`/feynman/${noteCtx.id}`);
        break;
      case 'delete':
        handleConfirmDelete(noteCtx);
        break;
      case 'ai-follow-up':
        // 跳转到会话页，让用户使用 AI 追问功能
        navigate(`/feynman/${noteCtx.id}`);
        break;
      case 'ai-simplify':
      case 'ai-gap-check':
        // 其他 AI 操作待后续实现
        toast({ type: 'info', message: 'AI 功能即将上线' });
        break;
    }
  }, [navigate, handleConfirmDelete, toast]);

  const stats = getStats();

  return (
    <div className="flex flex-col h-full">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-kb-md py-kb-md flex-shrink-0">
        <div>
          <h1 className="text-h1 font-semibold text-text-primary">费曼学习</h1>
          <p className="text-b2 text-text-tertiary mt-0.5">用讲解检验理解，以简化证明掌握</p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
          onClick={() => setModalOpen(true)}
        >
          新学习
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-kb-md pb-kb-lg space-y-3">
        {isLoading && notes.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="flex-1">
                <Skeleton variant="text" lines={2} />
              </div>
            </div>
          ))
        ) : notes.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" strokeWidth={1.2} />}
            title="还没有学习会话"
            description="点击「新学习」开始你的第一次费曼学习"
            action={
              <Button
                size="sm"
                icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
                onClick={() => setModalOpen(true)}
              >
                开始学习
              </Button>
            }
          />
        ) : (
          notes.map((n) => {
            const { label, color } = statusConfig[n.status] ?? statusConfig.not_started;
            const noteWps = weakPoints[n.id!] ?? [];
            const weakCount = noteWps.filter((wp) => !wp.mastered).length;
            return (
              <Card
                key={n.id}
                hoverable
                padding="md"
                onClick={() => navigate(`/feynman/${n.id}`)}
                onContextMenu={(e) => handleNoteCtx(e, n)}
                className="flex items-center gap-4 relative group"
              >
                <div className={cn(
                  'w-10 h-10 rounded-kb-lg flex items-center justify-center flex-shrink-0',
                  n.status === 'completed' ? 'bg-brand-50 text-brand-600'
                    : n.status === 'in_progress' ? 'bg-feynman/10 text-feynman'
                    : 'bg-bg-tertiary text-text-tertiary',
                )}>
                  <BookOpen className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-b1 font-medium text-text-primary truncate">{n.concept}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Tag color={color}>{label}</Tag>
                    <Tag color="feynman">步骤 {n.currentStep}: {stepLabels[n.currentStep]}</Tag>
                    {weakCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-c1 text-[#F59E0B]">
                        <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                        {weakCount}
                      </span>
                    )}
                    <span className="text-c1 text-text-tertiary ml-auto">
                      {formatRelativeDate(n.updatedAt)}
                    </span>
                  </div>
                </div>
                {/* MoreVertical 按钮（触发右键菜单） */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleNoteCtx(
                      { ...e, clientX: rect.right, clientY: rect.bottom, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent,
                      n,
                    );
                  }}
                  className={cn(
                    'p-1.5 rounded-kb-full text-text-tertiary/0 group-hover:text-text-tertiary',
                    'hover:!text-text-primary hover:bg-bg-tertiary',
                    'transition-all duration-kb-fast',
                  )}
                  title="更多操作"
                >
                  <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
                </button>
                {/* 删除按钮 */}
                {deleteId === n.id ? (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleDelete(n.id!, e)}
                      className="px-2.5 py-1 rounded-kb-md bg-semantic-error/10 text-semantic-error text-c1 font-medium hover:bg-semantic-error/20 transition-all duration-kb-fast"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(null); }}
                      className="px-2.5 py-1 rounded-kb-md text-c1 text-text-tertiary hover:bg-bg-tertiary transition-all duration-kb-fast"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(n.id!); }}
                    className={cn(
                      'p-1.5 rounded-kb-full text-text-tertiary/0 group-hover:text-text-tertiary',
                      'hover:!text-semantic-error hover:bg-semantic-error/10',
                      'transition-all duration-kb-fast',
                    )}
                    title="删除会话"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* 底部薄弱点汇总 */}
      {stats.weakPointsCount > 0 && (
        <div className="flex-shrink-0 px-kb-md py-3 border-t border-border/50">
          <button
            onClick={() => setWeakModalOpen(true)}
            className={cn(
              'w-full flex items-center gap-3 px-kb-md py-3 rounded-kb-lg',
              'bg-bg-secondary border border-border/40',
              'hover:bg-bg-tertiary transition-all duration-kb-fast',
              'text-left',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-kb-md flex items-center justify-center flex-shrink-0',
              'bg-[#F59E0B]/10 text-[#F59E0B]',
            )}>
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-b2 font-medium text-text-primary">查看待补强知识点</p>
              <p className="text-c1 text-text-tertiary">共 {stats.weakPointsCount} 个薄弱点等待复习巩固</p>
            </div>
          </button>
        </div>
      )}

      {/* 新建会话 Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setNewConcept(''); }}
        title="新建费曼学习"
        description="输入你想要深入理解的概念名称"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setModalOpen(false); setNewConcept(''); }}>
              取消
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newConcept.trim() || creating}>
              {creating ? '创建中...' : '开始学习'}
            </Button>
          </>
        }
      >
        <Input
          label="概念名称"
          placeholder="例如：红黑树的自平衡机制"
          value={newConcept}
          onChange={(e) => setNewConcept(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
        />
      </Modal>

      {/* 右键菜单 */}
      {ctxMenuOpen && ctxMenuNote && (
        <ContextMenu<FeynmanNote>
          groups={ctxMenuGroups}
          position={ctxMenuPos}
          context={ctxMenuNote}
          onSelect={handleCtxMenuSelect}
          onClose={closeCtxMenu}
        />
      )}

      {/* 待补强知识点 Modal */}
      <Modal
        open={weakModalOpen}
        onClose={() => setWeakModalOpen(false)}
        title="待补强知识点"
        description={`共 ${unmasteredWeakPoints.length} 个薄弱点等待复习巩固`}
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {unmasteredWeakPoints.length === 0 ? (
            <p className="text-b2 text-text-tertiary py-4 text-center">暂无待补强知识点</p>
          ) : (
            unmasteredWeakPoints.map(({ wp, concept, noteId }) => (
              <div
                key={wp.id}
                className="flex items-start gap-3 p-3 rounded-kb-lg bg-bg-secondary border border-border/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-b2 text-text-primary leading-relaxed">{wp.text}</p>
                  <span className="text-c1 text-text-tertiary mt-1 inline-block">来源：{concept}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggleWeakPointMastered(noteId, wp.id!)}
                    className="p-1.5 rounded-kb-md text-text-tertiary hover:text-semantic-success hover:bg-semantic-success/10 transition-all duration-kb-fast"
                    title="标记已掌握"
                  >
                    <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => { setWeakModalOpen(false); navigate(`/feynman/${noteId}`); }}
                    className="p-1.5 rounded-kb-md text-text-tertiary hover:text-brand-600 hover:bg-brand-50 transition-all duration-kb-fast"
                    title="跳转到对应会话"
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
