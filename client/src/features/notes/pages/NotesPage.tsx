import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button, Card, Input, Tag, EmptyState, Modal } from '@/components/ui';
import { useToast } from '@/components/ui';
import { ContextMenu } from '@/components/ui/ContextMenu';
import type { ContextMenuGroup } from '@/components/ui/ContextMenu';
import {
  Search, Plus, FolderPlus, ChevronRight, FileText, PanelLeftClose, PanelLeft, Pin,
  MoreVertical, Trash2, Copy, Download, BookOpen, Sparkles,
} from 'lucide-react';
import { TemplateSelector } from '../components/TemplateSelector';
import type { NoteTemplate } from '../components/TemplateSelector';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useNoteStore } from '../store/useNoteStore';
import { useContextMenu } from '@/lib/contextMenu';
import type { Note } from '@/types/models';

const templateLabels: Record<NoteTemplate | 'qa', string> = {
  outline: '大纲式', cornell: '康奈尔', mindmap: '思维导图', free: '自由笔记', blank: '空白', qa: '问答',
};

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function stripHtml(html: string): string {
  try {
    const json = JSON.parse(html);
    if (json?.content) {
      const extract = (nodes: unknown[]): string => {
        let text = '';
        for (const node of nodes) {
          const n = node as { text?: string; content?: unknown[] };
          if (n.text) text += n.text;
          if (n.content) text += extract(n.content);
        }
        return text;
      };
      return extract(json.content).slice(0, 120);
    }
    return '';
  } catch {
    return html.slice(0, 120);
  }
}

export default function NotesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const navigate = useNavigate();

  const {
    folders, selectedFolderId, selectedNoteId, searchQuery, selectedTags,
    loadNotes, loadFolders, createNote, createFolder, selectNote, selectFolder,
    setSearchQuery, getFilteredNotes, createFromTemplate, toggleTag, getAllTags,
    deleteNote, togglePin,
  } = useNoteStore();

  const { toast } = useToast();

  // 右键菜单 hook
  const {
    isOpen: ctxMenuOpen,
    position: ctxMenuPos,
    context: ctxMenuNote,
    handleContextMenu: handleNoteContextMenu,
    close: closeCtxMenu,
  } = useContextMenu<Note>();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 初始化加载
  useEffect(() => {
    loadNotes();
    loadFolders();
  }, [loadNotes, loadFolders]);

  const filteredNotes = getFilteredNotes();
  const allTags = getAllTags();
  const selectedNote = filteredNotes.find((n) => n.id === selectedNoteId) || null;

  const handleTemplateSelect = async (tpl: NoteTemplate) => {
    const id = await createFromTemplate(tpl, selectedFolderId ?? undefined);
    selectNote(id);
    navigate(`/notes/${id}`);
  };

  const handleCreateNote = async () => {
    const id = await createNote({
      title: '新笔记',
      template: 'blank',
      folderId: selectedFolderId ?? undefined,
    });
    selectNote(id);
    navigate(`/notes/${id}`);
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleSelectNote = (noteId: string) => {
    selectNote(noteId);
    navigate(`/notes/${noteId}`);
  };

  // === 卡片操作函数 ===

  const handleTogglePin = useCallback((noteId: string) => {
    togglePin(noteId);
    toast({ type: 'success', message: '已更新置顶状态' });
  }, [togglePin, toast]);

  const handleDeleteNote = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteTargetId) {
      await deleteNote(deleteTargetId);
      toast({ type: 'success', message: '笔记已删除' });
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, deleteNote, toast]);

  const handleDuplicateNote = useCallback(async (note: Note) => {
    await createNote({
      title: note.title + ' (副本)',
      content: note.content,
      folderId: note.folderId,
      tags: note.tags,
      template: note.template,
    });
    toast({ type: 'success', message: '笔记已复制' });
  }, [createNote, toast]);

  const handleExportNote = useCallback((note: Note) => {
    let text = note.title + '\n\n';
    try {
      const json = JSON.parse(note.content);
      if (json?.content) {
        const extract = (nodes: unknown[]): string => {
          let t = '';
          for (const node of nodes) {
            const n = node as { text?: string; content?: unknown[]; type?: string };
            if (n.text) t += n.text;
            if (n.content) t += extract(n.content);
            if (n.type === 'paragraph' || n.type === 'heading') t += '\n';
          }
          return t;
        };
        text += extract(json.content);
      }
    } catch {
      text += note.content;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'note'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: '笔记已导出' });
  }, [toast]);

  // 右键菜单分组定义
  const ctxMenuGroups = useMemo<ContextMenuGroup[]>(() => [
    {
      label: '笔记操作',
      items: [
        { key: 'open', label: '打开编辑', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'pin', label: '置顶/取消置顶', icon: <Pin className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'duplicate', label: '复制', icon: <Copy className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'export', label: '导出', icon: <Download className="w-4 h-4" strokeWidth={1.5} /> },
      ],
    },
    {
      label: 'AI 操作',
      items: [
        { key: 'ai-summary', label: '生成摘要', icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} /> },
        { key: 'ai-flashcard', label: '生成闪卡', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
      ],
    },
    {
      items: [
        { key: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" strokeWidth={1.5} />, danger: true },
      ],
    },
  ], []);

  // 右键菜单选中回调
  const handleCtxMenuSelect = useCallback((itemKey: string, noteCtx: Note) => {
    switch (itemKey) {
      case 'open':
        handleSelectNote(noteCtx.id!);
        break;
      case 'pin':
        handleTogglePin(noteCtx.id!);
        break;
      case 'duplicate':
        handleDuplicateNote(noteCtx);
        break;
      case 'export':
        handleExportNote(noteCtx);
        break;
      case 'delete':
        handleDeleteNote(noteCtx.id!);
        break;
      case 'ai-summary':
        // TODO: 集成 AI 摘要（需在编辑页内触发）
        console.warn('[ContextMenu] AI 摘要功能待集成', noteCtx.id);
        toast({ type: 'info', message: 'AI 摘要功能即将上线' });
        break;
      case 'ai-flashcard':
        // TODO: 集成 AI 闪卡生成
        console.warn('[ContextMenu] AI 闪卡功能待集成', noteCtx.id);
        toast({ type: 'info', message: 'AI 闪卡生成功能即将上线' });
        break;
    }
  }, [handleSelectNote, handleTogglePin, handleDuplicateNote, handleExportNote, handleDeleteNote, toast]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── 左栏：文件夹 ── */}
      {sidebarOpen && (
        <aside className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-border/50 bg-bg-secondary p-kb-md gap-kb-md overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-b2 font-semibold text-text-primary">文件夹</span>
            <button
              onClick={() => setShowNewFolder((v) => !v)}
              className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
            >
              <FolderPlus className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
            </button>
          </div>

          {showNewFolder && (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                placeholder="文件夹名称"
                className="flex-1 min-w-0 px-2 py-1 text-b2 bg-bg-tertiary border border-border/50 rounded-kb-sm outline-none focus:border-brand-400 text-text-primary"
              />
              <button
                onClick={handleCreateFolder}
                className="px-2 py-1 text-c1 text-brand-600 font-medium hover:bg-brand-50 rounded-kb-sm transition-all duration-kb-fast"
              >
                确定
              </button>
            </div>
          )}

          <nav className="flex flex-col gap-1">
            {/* 全部笔记 */}
            <button
              onClick={() => selectFolder(null)}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-kb-md text-b2',
                'transition-all duration-kb-fast',
                selectedFolderId === null
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-text-secondary hover:bg-bg-tertiary',
              )}
            >
              <span>全部笔记</span>
              <span className="text-c1 text-text-tertiary">{useNoteStore.getState().notes.length}</span>
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => selectFolder(f.id!)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-kb-md text-b2',
                  'transition-all duration-kb-fast',
                  selectedFolderId === f.id
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-text-secondary hover:bg-bg-tertiary',
                )}
              >
                <span className="flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" strokeWidth={1.5} />
                  {f.name}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-kb-md border-t border-border/40">
            <span className="text-c1 text-text-tertiary">标签筛选</span>
            {allTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allTags.map((tag) => {
                  const isActive = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'px-2 py-0.5 text-c1 rounded-kb-md border transition-all duration-kb-fast',
                        isActive
                          ? 'bg-brand-50 text-brand-700 border-brand-300 font-medium'
                          : 'bg-bg-tertiary text-text-secondary border-border/50 hover:bg-bg-secondary',
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-c1 text-text-tertiary mt-2">暂无标签</p>
            )}
          </div>
        </aside>
      )}

      {/* ── 中栏：笔记列表 ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 工具栏 */}
        <div className="flex items-center gap-kb-sm px-kb-md py-3 border-b border-border/50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden md:flex p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
          >
            {sidebarOpen
              ? <PanelLeftClose className="w-icon-md h-icon-md" strokeWidth={1.5} />
              : <PanelLeft className="w-icon-md h-icon-md" strokeWidth={1.5} />}
          </button>
          <Input
            placeholder="搜索笔记..."
            prefix={<Search className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
            size="sm"
            className="flex-1 min-w-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            size="sm"
            icon={<Plus className="w-icon-sm h-icon-sm" strokeWidth={2} />}
            onClick={() => setTemplateOpen(true)}
          >
            新建笔记
          </Button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto px-kb-md py-3 space-y-3">
          {filteredNotes.length === 0 ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <EmptyState
                icon={<FileText className="w-12 h-12" strokeWidth={1.2} />}
                title="暂无笔记"
                description="点击「新建笔记」开始记录你的第一篇笔记"
              />
            </div>
          ) : (
            filteredNotes.map((note) => (
              <Card
                key={note.id}
                hoverable
                padding="md"
                onClick={() => handleSelectNote(note.id!)}
                onContextMenu={(e) => handleNoteContextMenu(e, note)}
                className={cn(
                  'group relative',
                  selectedNoteId === note.id && 'border-brand-400 bg-brand-50/30',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.pinned && <Pin className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" strokeWidth={1.5} />}
                      <h3 className="text-b1 font-medium text-text-primary truncate">{note.title}</h3>
                    </div>
                    <p className="text-b2 text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                      {stripHtml(note.content)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Tag color="note">{templateLabels[note.template as NoteTemplate]}</Tag>
                      {note.tags.map((tag) => (
                        <Tag key={tag} color="default">{tag}</Tag>
                      ))}
                      <span className="text-c1 text-text-tertiary ml-auto">{formatDate(note.updatedAt)}</span>
                    </div>
                  </div>
                  {/* MoreVertical 按钮（触发同一右键菜单） */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 模拟右键菜单，位置在按钮右下方
                      const rect = e.currentTarget.getBoundingClientRect();
                      handleNoteContextMenu(
                        { ...e, clientX: rect.right, clientY: rect.bottom, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent,
                        note,
                      );
                    }}
                    className="p-1 rounded hover:bg-bg-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <MoreVertical className="w-4 h-4 text-text-secondary" strokeWidth={1.5} />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* 右键菜单 */}
        {ctxMenuOpen && ctxMenuNote && (
          <ContextMenu<Note>
            groups={ctxMenuGroups}
            position={ctxMenuPos}
            context={ctxMenuNote}
            onSelect={handleCtxMenuSelect}
            onClose={closeCtxMenu}
          />
        )}
      </main>

      {/* ── 右栏：预览（桌面） ── */}
      <aside className="hidden lg:flex flex-col w-80 flex-shrink-0 border-l border-border/50 bg-bg-secondary overflow-y-auto">
        {selectedNote ? (
          <div className="p-kb-md flex flex-col gap-kb-md">
            <div>
              <h2 className="text-h2 font-semibold text-text-primary">{selectedNote.title}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Tag color="note">{templateLabels[selectedNote.template as NoteTemplate]}</Tag>
                {selectedNote.tags.map((tag) => (
                  <Tag key={tag} color="default">{tag}</Tag>
                ))}
              </div>
              <span className="text-c1 text-text-tertiary block mt-2">{formatDate(selectedNote.updatedAt)}</span>
            </div>
            <div className="border-t border-border/40 pt-kb-md">
              <p className="text-b2 text-text-secondary leading-relaxed line-clamp-[12]">
                {stripHtml(selectedNote.content)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/notes/${selectedNote.id}`)}
            >
              打开编辑
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<FileText className="w-12 h-12" strokeWidth={1.2} />}
              title="选择一篇笔记查看详情"
              description="点击左侧列表中的任意笔记，在此处预览其内容"
            />
          </div>
        )}
      </aside>

      {/* ── 移动端浮动新建按钮 ── */}
      <button
        onClick={handleCreateNote}
        className={cn(
          'md:hidden fixed bottom-20 right-5 z-40',
          'w-14 h-14 rounded-kb-full',
          'bg-brand-600 text-white shadow-kb-lg',
          'flex items-center justify-center',
          'hover:bg-brand-700 active:scale-95',
          'transition-all duration-kb-fast',
        )}
        aria-label="新建笔记"
      >
        <Plus className="w-6 h-6" strokeWidth={2} />
      </button>

      {/* ── 模板选择器 ── */}
      <TemplateSelector
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSelect={handleTemplateSelect}
      />

      {/* ── 删除确认 Modal ── */}
      <Modal
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="确认删除"
        description="确定要删除这条笔记吗？此操作不可撤销。"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTargetId(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              onClick={handleConfirmDelete}
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
