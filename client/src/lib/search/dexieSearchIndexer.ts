/**
 * 基于 Dexie (IndexedDB) 的搜索引擎实现
 * v0.9.0: 全文搜索引擎持久化索引
 *
 * 使用 BM25 简化评分算法对搜索结果排序，
 * 索引数据存储在 IndexedDB searchIndex 表中。
 */

import { db } from '../storage/database';
import { analyze } from './tokenizer';
import type {
  ISearchEngine,
  SearchOptions,
  SearchResult,
  SearchResultItem,
} from './types';

// ---------------------------------------------------------------------------
// BM25 参数（简化版，适合小规模笔记搜索）
// ---------------------------------------------------------------------------

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** 每批重建索引的笔记数量 */
const REBUILD_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 从 TipTap JSON 内容中提取纯文本
 * content 可能是 JSON 字符串（TipTap 文档结构），也可能已经是纯文本
 */
function extractPlainText(content: string): string {
  try {
    const doc = JSON.parse(content);
    if (doc?.type === 'doc' && Array.isArray(doc.content)) {
      const extract = (nodes: Array<Record<string, unknown>>): string => {
        const parts: string[] = [];
        for (const node of nodes) {
          if (node.type === 'text' && typeof node.text === 'string') {
            parts.push(node.text);
          }
          if (Array.isArray(node.content)) {
            parts.push(extract(node.content as Array<Record<string, unknown>>));
          }
        }
        return parts.join(' ');
      };
      return extract(doc.content);
    }
  } catch {
    // 非 JSON 或解析失败，当作纯文本处理
  }
  return content;
}

/**
 * 计算 IDF（逆文档频率）
 * IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
 */
function computeIDF(totalDocs: number, docFreq: number): number {
  return Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
}

// ---------------------------------------------------------------------------
// DexieSearchIndexer 类
// ---------------------------------------------------------------------------

export class DexieSearchIndexer implements ISearchEngine {
  private initialized = false;

  /** 初始化（Dexie 模式下无需额外初始化） */
  async init(): Promise<void> {
    this.initialized = true;
  }

  /**
   * 添加或更新一条笔记的搜索索引
   * 使用 Dexie 事务保证数据一致性
   */
  async upsert(noteId: string, title: string, content: string, updatedAt: number): Promise<void> {
    const plainContent = extractPlainText(content);
    const combinedText = `${title} ${plainContent}`;
    const tokens = analyze(combinedText);

    await db.transaction('rw', db.searchIndex, async () => {
      // 删除旧索引
      await db.searchIndex.where('noteId').equals(noteId).delete();
      // 写入新索引
      await db.searchIndex.add({
        noteId,
        tokens,
        title,
        content: plainContent.slice(0, 2000),
        updatedAt,
      });
    });
  }

  /**
   * 删除指定笔记的搜索索引
   */
  async remove(noteId: string): Promise<void> {
    await db.searchIndex.where('noteId').equals(noteId).delete();
  }

  /**
   * 基于 BM25 简化评分执行搜索
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const startTime = performance.now();
    const { query, limit = 20, offset = 0, fuzzy = false } = options;

    const queryTokens = analyze(query);
    if (queryTokens.length === 0) {
      return { items: [], totalCount: 0, elapsedMs: 0, queryTokens: [] };
    }

    // 获取全部索引条目
    const allEntries = await db.searchIndex.toArray();
    const totalDocs = allEntries.length;

    if (totalDocs === 0) {
      return { items: [], totalCount: 0, elapsedMs: 0, queryTokens };
    }

    // 计算每个 token 的文档频率（df）
    const docFreqMap = new Map<string, number>();
    for (const token of queryTokens) {
      let df = 0;
      for (const entry of allEntries) {
        if (entry.tokens.includes(token)) df++;
      }
      docFreqMap.set(token, df);
    }

    // 计算平均文档长度（token 数量）
    const avgDocLen = allEntries.reduce((sum, e) => sum + e.tokens.length, 0) / totalDocs;

    // 为每篇文档计算 BM25 得分
    const scored: Array<{ entry: typeof allEntries[0]; score: number; matchedTokens: string[] }> = [];

    for (const entry of allEntries) {
      // 限定笔记 ID 范围
      if (options.noteIds?.length && !options.noteIds.includes(entry.noteId)) continue;

      let score = 0;
      const matchedTokens: string[] = [];
      const docLen = entry.tokens.length;

      for (const token of queryTokens) {
        // 统计该 token 在当前文档中的出现次数
        const tf = entry.tokens.includes(token) ? 1 : 0;
        if (tf === 0 && !fuzzy) continue;

        // 模糊匹配：检查前缀匹配
        if (tf === 0 && fuzzy) {
          const prefixMatch = entry.tokens.some((t) => t.startsWith(token.slice(0, 2)));
          if (!prefixMatch) continue;
        }

        const df = docFreqMap.get(token) ?? 0;
        const idf = computeIDF(totalDocs, df);

        // BM25 TF 分量
        const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgDocLen)));
        score += idf * tfNorm;
        matchedTokens.push(token);
      }

      if (score > 0 && matchedTokens.length > 0) {
        scored.push({ entry, score, matchedTokens });
      }
    }

    // 按得分降序排序
    scored.sort((a, b) => b.score - a.score);
    const totalCount = scored.length;

    // 归一化得分到 0-1
    const maxScore = scored.length > 0 ? scored[0].score : 1;
    const pageItems = scored.slice(offset, offset + limit);

    const items: SearchResultItem[] = pageItems.map(({ entry, score, matchedTokens }) => {
      const snippet = buildSnippet(entry.content, matchedTokens);
      return {
        noteId: entry.noteId,
        title: entry.title,
        snippet,
        score: maxScore > 0 ? score / maxScore : 0,
        matchedTokens,
        updatedAt: entry.updatedAt,
      };
    });

    const elapsedMs = Math.round(performance.now() - startTime);
    return { items, totalCount, elapsedMs, queryTokens };
  }

  /**
   * 重建全部搜索索引
   * 使用 requestIdleCallback 异步批量处理，每批 REBUILD_BATCH_SIZE 篇笔记
   */
  async rebuildIndex(): Promise<void> {
    await db.searchIndex.clear();

    const allNotes = await db.notes.toArray();
    let cursor = 0;

    const processBatch = async (): Promise<void> => {
      const batch = allNotes.slice(cursor, cursor + REBUILD_BATCH_SIZE);
      if (batch.length === 0) return;

      await db.transaction('rw', db.searchIndex, async () => {
        for (const note of batch) {
          const plainContent = extractPlainText(note.content);
          const combinedText = `${note.title} ${plainContent}`;
          const tokens = analyze(combinedText);
          await db.searchIndex.add({
            noteId: note.id,
            tokens,
            title: note.title,
            content: plainContent.slice(0, 2000),
            updatedAt: note.updatedAt instanceof Date
              ? note.updatedAt.getTime()
              : new Date(note.updatedAt).getTime(),
          });
        }
      });

      cursor += REBUILD_BATCH_SIZE;

      if (cursor < allNotes.length) {
        await new Promise<void>((resolve) => {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve());
          } else {
            setTimeout(resolve, 0);
          }
        });
        await processBatch();
      }
    };

    await processBatch();
  }

  /** 释放资源（Dexie 模式下无需额外清理） */
  dispose(): void {
    this.initialized = false;
  }
}

// ---------------------------------------------------------------------------
// 内部辅助：生成匹配上下文摘要
// ---------------------------------------------------------------------------

function buildSnippet(content: string, matchedTokens: string[]): string {
  if (!content) return '';
  const lowerContent = content.toLowerCase();

  let bestIndex = -1;
  for (const token of matchedTokens) {
    const idx = lowerContent.indexOf(token);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) {
    return content.slice(0, 120) + (content.length > 120 ? '...' : '');
  }

  const start = Math.max(0, bestIndex - 30);
  const end = Math.min(content.length, bestIndex + 90);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end)}${suffix}`;
}

// ---------------------------------------------------------------------------
// 单例导出
// ---------------------------------------------------------------------------

export const dexieSearchIndexer = new DexieSearchIndexer();
