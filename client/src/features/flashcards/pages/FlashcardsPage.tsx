import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Button, Tag, Modal, Input, EmptyState, Skeleton } from '@/components/ui';
import { Plus, Layers, Clock, Trash2, Layers3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFlashcardStore } from '../store/useFlashcardStore';
import { flashcardStore } from '@/lib/storage';
import type { Flashcard } from '@/types/models';

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
  // Context menu / long-press delete
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load decks + all cards on mount
  useEffect(() => {
    loadDecks();
    flashcardStore.getAll().then(setAllCards);
  }, [loadDecks]);

  // Compute stats for a given deck
  const getStats = useCallback(
    (deckId: number): DeckLocalStats => {
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
  const handleDelete = async (id: number) => {
    await deleteDeck(id);
    const cards = await flashcardStore.getAll();
    setAllCards(cards);
    setDeleteTarget(null);
  };

  // Long press handlers
  const handlePointerDown = (id: number) => {
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

  // Right-click handler
  const handleContextMenu = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    setDeleteTarget(id);
  };

  const targetDeck = decks.find((d) => d.id === deleteTarget);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-kb-md py-kb-md flex-shrink-0">
        <div>
          <h1 className="text-h1 font-semibold text-text-primary">闪卡</h1>
          <p className="text-b2 text-text-tertiary mt-0.5">间隔重复，高效记忆</p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
          onClick={() => setModalOpen(true)}
        >
          新建牌组
        </Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-kb-md">
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
                  onContextMenu={(e) => handleContextMenu(e, deck.id!)}
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

      {/* 删除确认 Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除牌组"
        description={`确定要删除「${targetDeck?.name ?? ''}」吗？该操作将同时删除牌组中的所有卡片，且无法撤销。`}
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
