'use client';

import dynamic from 'next/dynamic';
import { ControlPanel } from '@/components/ControlPanel';

// Three.js는 SSR이 의미 없으므로 client-only로 동적 로드
const Scene = dynamic(() => import('@/components/Scene').then((m) => m.Scene), {
  ssr: false,
  loading: () => (
    <div className="flex-1 grid place-items-center text-slate-500 text-sm">
      Loading 3D scene…
    </div>
  ),
});

export default function Home() {
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <div className="flex-1 relative">
        <Scene />
        <Overlay />
      </div>
      <ControlPanel />
    </main>
  );
}

function Overlay() {
  return (
    <div className="absolute top-3 left-3 pointer-events-none select-none">
      <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">
        Sail Trim Lab
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">
        Mainsail · 매개변수 기반 시뮬레이션
      </div>
    </div>
  );
}
