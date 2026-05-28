'use client';

import { WindControls } from './WindControls';
import { TrimControls } from './TrimControls';
import { Toggles } from './Toggles';
import { Readout } from './Readout';
import { useSimStore } from '@/store/useSimStore';

export function ControlPanel() {
  const reset = useSimStore((s) => s.reset);

  return (
    <aside className="w-[360px] shrink-0 h-screen overflow-y-auto bg-slate-900/95 backdrop-blur border-l border-slate-700/70 text-slate-100 px-4 py-4">
      <header className="mb-4 pb-3 border-b border-slate-700">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            Sail Trim Lab
          </h1>
          <button
            onClick={reset}
            className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50 px-2 py-0.5 rounded"
          >
            Reset
          </button>
        </div>
        <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
          메인세일 트리밍 시뮬레이터 — 슬라이더로 컨트롤을 조정하면 세일 모양과 힘이 실시간으로 변합니다.
        </p>
      </header>

      <WindControls />
      <TrimControls />
      <Toggles />
      <Readout />

      <footer className="mt-6 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-snug">
        마우스 드래그로 카메라 회전 · 휠로 줌 · 우클릭 드래그로 이동.
        매개변수 기반 모델 — 정확한 CFD가 아니라 트림 컨트롤의 영향을 직관적으로 보여주는 교육용.
      </footer>
    </aside>
  );
}
