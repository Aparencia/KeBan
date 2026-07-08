import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': '学习看板',
  '/pomodoro': '番茄钟',
  '/pomodoro/stats': '专注统计',
  '/pomodoro/settings': '番茄钟设置',
  '/notes': '智能笔记',
  '/flashcards': '闪卡',
  '/feynman': '费曼学习',
  '/settings': '设置',
  '/onboarding': '欢迎',
};

export function usePageTitle(): string {
  const { pathname } = useLocation();

  // Exact match first
  if (routeTitles[pathname]) return routeTitles[pathname];

  // Prefix match for dynamic routes
  if (pathname.startsWith('/notes/')) return '编辑笔记';
  if (pathname.match(/^\/flashcards\/[^/]+\/study$/)) return '学习会话';
  if (pathname.startsWith('/flashcards/')) return '卡组详情';
  if (pathname.startsWith('/feynman/')) return '费曼会话';

  return '课伴';
}
