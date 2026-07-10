import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Button, Tag, Modal, Input, EmptyState, Skeleton, useToast } from '@/components/ui';
import { ContextMenu, type ContextMenuGroup } from '@/components/ui/ContextMenu';
import { Plus, Layers, Clock, Trash2, Layers3, Upload, BookOpen, Pencil, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFlashcardStore } from '../store/useFlashcardStore';
import { flashcardStore } from '@/lib/storage';
import { importDeck, exportDeck, downloadDeckFile } from '@/lib/storage/exportImport';
import { useContextMenu } from '@/lib/contextMenu/useContextMenu';
import type { Flashcard, FlashcardDeck } from '@/types/models';

interface DeckLocalStats {
  total: number;
  due: number;
  newCards: number;
}

export default function FlashcardsPage() {
  const navigate = useNavigate();
  const { decks, isLoading, loadDecks, createDeck, deleteDeck } = useFlashcardStore();

  // All cards for computing per-deck stats
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  // New deck modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  // Delete confirm target
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  // Context menu
  const {
    isOpen: ctxOpen,
    position: ctxPos,
    context: ctxDeck,
    handleContextMenu: ctxHandleMenu,
    close: ctxClose,
  } = useContextMenu<FlashcardDeck>();

  const deckMenuGroups: ContextMenuGroup[] = [
    {
      label: '牌组操作',
      items: [
        { key: 'study', label: '开始学习', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'edit', label: '编辑牌组', icon: <Pencil className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'share', label: '导出分享', icon: <Share2 className="w-4 h-4" strokeWidth={1.5} /> },
      ],
    },
    {
      label: '管理',
      items: [
        { key: 'delete', label: '删除牌组', icon: <Trash2 className="w-4 h-4" strokeWidth={1.5} />, danger: true },
      ],
    },
  ];

  const handleDeckSelect = useCallback(async (itemKey: string, deck: FlashcardDeck) => {
    switch (itemKey) {
      case 'study':
        navigate(`/flashcards/${deck.id}`);
        break;
      case 'edit':
        navigate(`/flashcards/${deck.id}`);
        break;
      case 'share': {
        try {
          const data = await exportDeck(deck.id);
          downloadDeckFile(data);
          toast({ type: 'success', message: `牌组「${deck.name}」已导出` });
        } catch {
          toast({ type: 'error', message: '导出失败，请稍后重试' });
        }
        break;
      }
      case 'delete':
        setDeleteTarget(deck.id);
        break;
    }
  }, [navigate, toast]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importDeck(file);
      toast({ type: 'success', message: `导入成功：${result.cardCount} 张卡片` });
      // 刷新牌组列表
      loadDecks();
      const cards = await flashcardStore.getAll();
      setAllCards(cards);
    } catch {
      toast({ type: 'error', message: '导入失败，请确认文件格式正确' });
    } finally {
      setImporting(false);
      // 重置 input 以便再次选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load decks + all cards on mount
  useEffect(() => {
    loadDecks();
    flashcardStore.getAll().then(setAllCards);
  }, [loadDecks]);

  // Compute stats for a given deck
  const getStats = useCallback(
    (deckId: string): DeckLocalStats => {
      const deckCards = allCards.filter((c) => c.deckId === deckId);
      const now = new Date();
      return {
        total: deckCards.length,
        due: deckCards.filter((c) => new Date(c.dueDate) <= now).length,
        newCards: deckCards.filter((c) => c.repetitions === 0).length,
      };
    },
    [allCards],
  );

  // Create deck
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createDeck(newName.trim(), newDesc.trim() || undefined);
      // Refresh all cards
      const cards = await flashcardStore.getAll();
      setAllCards(cards);
      setModalOpen(false);
      setNewName('');
      setNewDesc('');
    } finally {
      setCreating(false);
    }
  };

  // Delete deck
  const handleDelete = async (id: string) => {
    await deleteDeck(id);
    const cards = await flashcardStore.getAll();
    setAllCards(cards);
    setDeleteTarget(null);
  };

  // Long press handlers
  const handlePointerDown = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setDeleteTarget(id);
    }, 600);
  };
  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-kb-md py-kb-md flex-shrink-0">
        <div>
          <h1 className="text-h1 font-semibold text-text-primary">闪卡</h1>
          <p className="text-b2 text-text-tertiary mt-0.5">间隔重复，高效记忆</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={importing
              ? <span className="w-icon-sm h-icon-sm border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
              : <Upload className="w-icon-sm h-icon-sm" strokeWidth={2} />}
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            导入牌组
          </Button>
          <Button
            size="sm"
            icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
            onClick={() => setModalOpen(true)}
          >
            新建牌组
          </Button>
        </div>
        {/* 隐藏的文件选择 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".kban-deck"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* 牌组网格 */}
      <div className="flex-1 overflow-y-auto px-kb-md pb-kb-lg">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-kb-md">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={160} />
            ))}
          </div>
        ) : decks.length === 0 ? (
          <EmptyState
            icon={<Layers3 className="w-12 h-12" strokeWidth={1.2} />}
            title="还没有牌组"
            description="创建你的第一个牌组，开始间隔重复学习之旅"
            action={
              <Button
                size="sm"
                icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
                onClick={() => setModalOpen(true)}
              >
                新建牌组
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-kb-md" data-allow-context-menu>
            {decks.map((deck) => {
              const stats = getStats(deck.id!);
              const progress =
                stats.total > 0
                  ? (stats.total - stats.due - stats.newCards) / stats.total
                  : 0;

              return (
                <Card
                  key={deck.id}
                  hoverable
                  padding="md"
                  onClick={() => navigate(`/flashcards/${deck.id}`)}
                  onContextMenu={(e) => ctxHandleMenu(e, deck)}
                  onPointerDown={() => handlePointerDown(deck.id!)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {deck.color && (
                          <span
                            className="w-2.5 h-2.5 rounded-kb-full flex-shrink-0"
                            style={{ backgroundColor: deck.color }}
                          />
                        )}
                        <h3 className="text-b1 font-semibold text-text-primary truncate">
                          {deck.name}
                        </h3>
                      </div>
                      {deck.description && (
                        <p className="text-b3 text-text-tertiary mt-0.5 line-clamp-2">
                          {deck.description}
                        </p>
                      )}
                    </div>
                    <Tag color="flashcard">{stats.total} 卡</Tag>
                  </div>

                  {/* 进度条 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-c1 text-text-tertiary">已掌握</span>
                      <span className="text-c1 font-medium text-flashcard">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-kb-full bg-bg-tertiary overflow-hidden">
                      <div
                        className="h-full rounded-kb-full bg-flashcard transition-all duration-500"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* 底栏 */}
                  <div className="flex items-center justify-between text-c1 text-text-tertiary pt-1 border-t border-border/30">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
                      共 {stats.total} 张
                    </span>
                    {stats.due > 0 ? (
                      <span className="flex items-center gap-1 text-flashcard font-medium">
                        <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {stats.due} 张到期
                      </span>
                    ) : stats.total > 0 ? (
                      <span className="text-semantic-success font-medium">全部已学完</span>
                    ) : (
                      <span className="text-text-tertiary">暂无卡片</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 新建牌组 Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setNewName(''); setNewDesc(''); }}
        title="新建牌组"
        description="创建一个新的闪卡牌组来组织你的学习内容"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setNewName(''); setNewDesc(''); }}>
              取消
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
              创建
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-kb-md">
          <Input
            label="牌组名称"
            placeholder="例如：数据结构基础"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <Input
            label="描述（可选）"
            placeholder="简要描述牌组内容"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
      </Modal>

      {/* 右键菜单 */}
      {ctxOpen && ctxDeck && (
        <ContextMenu
          groups={deckMenuGroups}
          position={ctxPos}
          context={ctxDeck}
          onSelect={handleDeckSelect}
          onClose={ctxClose}
        />
      )}

      {/* 删除确认 Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除牌组"
        description={`确定要删除「${decks.find((d) => d.id === deleteTarget)?.name ?? ''}」吗？该操作将同时删除牌组中的所有卡片，且无法撤销。`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              onClick={() => deleteTarget !== null && handleDelete(deleteTarget)}
            >
              删除
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}
