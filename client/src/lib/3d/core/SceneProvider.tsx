/**
 * 3D场景全局提供器 — React Three Fiber Canvas容器
 * 作为全屏背景层，z-index: -1
 */
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Preload } from '@react-three/drei';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QualityController } from './QualityController';
import { MemoryManager } from './MemoryManager';
import { ContextRecovery } from './ContextRecovery';
import * as THREE from 'three';

interface SceneProviderProps {
  children: React.ReactNode;
}

export function SceneProvider({ children }: SceneProviderProps) {
  return (
    <div className="fixed inset-0 -z-10" style={{ pointerEvents: 'none' }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ fov: 60, near: 0.1, far: 1000, position: [0, 0, 10] }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.fog = new THREE.FogExp2('#0a0a2e', 0.03);
        }}
      >
        <PerformanceMonitor />
        <QualityController />
        <MemoryManager />
        <ContextRecovery />
        <Suspense fallback={null}>
          {children}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
