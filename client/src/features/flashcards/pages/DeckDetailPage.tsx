import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Modal, Input, Tag, EmptyState, Skeleton } from '@/components/ui';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Clock,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlashcardStore } from '../store/useFlashcardStore';

export default function DeckDetailPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const numericDeckId = Number(deckId);

  const {
    decks,
    cards,
    isLoading,
    loadCards,
    selectDeck,
    loadDecks,
    createCard,
    updateCard,
    deleteCard,
    getDeckStats,
  } = useFlashcardStore();

  const deck = decks.find((d) => d.id === numericDeckId);

  // Add / Edit modal state
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteCardId, setDeleteCardId] = useState<number | null>(null);

  useEffect(() => {
    if (!isNaN(numericDeckId)) {
      loadDecks();
      selectDeck(numericDeckId);
      loadCards(numericDeckId);
    }
  }, [numericDeckId, loadDecks, selectDeck, loadCards]);

  const stats = !isNaN(numericDeckId) ? getDeckStats(numericDeckId) : { total: 0, due: 0, newCards: 0 };

  const statItems = [
    { label: '总卡片', value: stats.total, icon: BookOpen, color: 'text-flashcard' },
    { label: '到期', value: stats.due, icon: Clock, color: 'text-[#F59E0B]' },
    { label: '新卡', value: stats.newCards, icon: Sparkles, color: 'text-brand-500' },
    {
      label: '已掌握',
      value: stats.total - stats.due - stats.newCards,
      icon: CheckCircle2,
      color: 'text-semantic-success',
    },
  ];

  const canStudy = stats.due > 0 || stats.newCards > 0;

  const openAddModal = () => {
    setEditingCardId(null);
    setCardFront('');
    setCardBack('');
    setCardModalOpen(true);
  };

  const openEditModal = (card: (typeof cards)[0]) => {
    setEditingCardId(card.id ?? null);
    setCardFront(card.front);
    setCardBack(card.back);
    setCardModalOpen(true);
  };

  const handleSaveCard = async () => {
    if (!cardFront.trim() || !cardBack.trim()) return;
    setSaving(true);
    try {
      if (editingCardId !== null) {
        await updateCard(editingCardId, { front: cardFront.trim(), back: cardBack.trim() });
      } else {
        await createCard({
          deckId: numericDeckId,
          front: cardFront.trim(),
          back: cardBack.trim(),
          type: 'basic',
        });
      }
      setCardModalOpen(false);
      setCardFront('');
      setCardBack('');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async () => {
    if (deleteCardId === null) return;
    await deleteCard(deleteCardId);
    setDeleteCardId(null);
  };

  const deleteTargetCard = cards.find((c) => c.id === deleteCardId);

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="flex items-center gap-kb-sm px-kb-md py-3 border-b border-border/50 flex-shrink-0">
        <button
          onClick={() => navigate('/flashcards')}
          className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
        >
          <ArrowLeft className="w-icon-md h-icon-md" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {deck?.color && (
            <span
              className="w-2.5 h-2.5 rounded-kb-full flex-shrink-0"
              style={{ backgroundColor: deck.color }}
            />
          )}
          <h1 className="text-h2 font-semibold text-text-primary truncate">
            {deck?.name ?? '加载中…'}
          </h1>
        </div>
        <Button size="sm" icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />} onClick={openAddModal}>
          添加卡片
        </Button>
      </div>

      {/* 统计行 */}
      <div className="grid grid-cols-4 gap-kb-sm px-kb-md py-kb-md flex-shrink-0">
        {statItems.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} padding="sm" className="flex flex-col items-center gap-1 text-center">
            <Icon className={cn('w-icon-sm h-icon-sm', color)} strokeWidth={1.5} />
            <span className={cn('text-h2 font-bold', color)}>{value}</span>
            <span className="text-c1 text-text-tertiary">{label}</span>
          </Card>
        ))}
      </div>

      {/* 卡片列表 */}
      <div className="flex-1 overflow-y-auto px-kb-md pb-kb-md">
        {isLoading ? (
          <div className="flex flex-col gap-kb-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={64} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" strokeWidth={1.2} />}
            title="牌组还没有卡片"
            description="点击「添加卡片」开始为这个牌组创建学习卡片"
            action={
              <Button
                size="sm"
                icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
                onClick={openAddModal}
              >
                添加卡片
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-kb-sm">
            {cards.map((card) => (
              <Card
                key={card.id}
                padding="sm"
                className="flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-b2 font-medium text-text-primary truncate">{card.front}</p>
                  <div className="flex items-center gap-3 mt-1 text-c1 text-text-tertiary">
                    <span>EF: {card.easeFactor.toFixed(2)}</span>
                    <span>间隔: {card.interval}d</span>
                    <span>连续: {card.repetitions}</span>
                    {card.repetitions === 0 && (
                      <Tag color="brand" className="text-[10px] px-1.5 py-0">新卡</Tag>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEditModal(card)}
                    className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
                    aria-label="编辑卡片"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => setDeleteCardId(card.id ?? null)}
                    className="p-1.5 rounded-kb-full text-text-tertiary hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 transition-all duration-kb-fast"
                    aria-label="删除卡片"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 底部固定按钮 */}
      <div className="flex-shrink-0 px-kb-md py-3 border-t border-border/50">
        <Button
          size="lg"
          className="w-full"
          disabled={!canStudy}
          onClick={() => navigate(`/flashcards/${deckId}/study`)}
        >
          {canStudy ? `开始学习（${stats.due + stats.newCards} 张）` : '暂无可学习卡片'}
        </Button>
      </div>

      {/* 添加/编辑卡片 Modal */}
      <Modal
        open={cardModalOpen}
        onClose={() => { setCardModalOpen(false); setEditingCardId(null); }}
        title={editingCardId !== null ? '编辑卡片' : '添加卡片'}
        description={editingCardId !== null ? '修改卡片正面和背面内容' : '创建一张新的基础卡片'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCardModalOpen(false); setEditingCardId(null); }}>
              取消
            </Button>
            <Button
              onClick={handleSaveCard}
              loading={saving}
              disabled={!cardFront.trim() || !cardBack.trim()}
            >
              {editingCardId !== null ? '保存' : '添加'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-kb-md">
          <Input
            label="正面（问题）"
            placeholder="输入卡片正面的问题或概念"
            value={cardFront}
            onChange={(e) => setCardFront(e.target.value)}
            autoFocus
          />
          <Input
            label="背面（答案）"
            placeholder="输入卡片背面的答案或解释"
            value={cardBack}
            onChange={(e) => setCardBack(e.target.value)}
          />
        </div>
      </Modal>

      {/* 删除卡片确认 Modal */}
      <Modal
        open={deleteCardId !== null}
        onClose={() => setDeleteCardId(null)}
        title="删除卡片"
        description={`确定要删除卡片「${deleteTargetCard?.front?.slice(0, 30) ?? ''}」吗？该操作不可撤销。`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteCardId(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              onClick={handleDeleteCard}
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
