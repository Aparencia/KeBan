/**
 * WebGL上下文丢失恢复 — 监听context lost事件并自动重建
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

export function ContextRecovery({ onContextLost }: { onContextLost?: () => void }) {
  const { gl } = useThree();
  const [, setContextLost] = useState(false);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      console.error('[WebGL] Context lost - will attempt recovery');
      onContextLost?.();
    };

    const handleRestored = () => {
      setContextLost(false);
      console.log('[WebGL] Context restored');
      // 强制重新编译所有着色器
      gl.info.programs?.forEach((program: any) => {
        if (program?.destroy) program.destroy();
      });
    };

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, onContextLost]);

  return null;
}
