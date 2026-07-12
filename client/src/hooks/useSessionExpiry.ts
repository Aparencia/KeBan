import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui';

const SESSION_EXPIRED_EVENT = 'kb:session-expired';

/**
 * 监听 session 过期事件，弹出 Toast 提示并提供重新登录入口
 * 需在 AppLayout 或其他全局组件中调用
 */
export function useSessionExpiry() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    function handleSessionExpired() {
      toast({
        type: 'warning',
        message: '登录已过期，请重新登录',
        duration: 8000,
      });
      // 延迟跳转，让用户能看到提示
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [navigate, toast]);
}
