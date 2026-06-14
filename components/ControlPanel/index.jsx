'use client';

import { useSimStore } from '@/store/useSimStore';
import { SAIL_TYPES } from '@/lib/sails';
import { WindControls } from './WindControls';
import { TrimControls } from './TrimControls';
import { Toggles } from './Toggles';
import { Readout } from './Readout';
import { SailInventory } from './SailInventory';
import { SailSection } from './SailSection';
import { EnvironmentControls } from './EnvironmentControls';

const SECTION_ACCENT = {
  main: 'cyan',
  jib: 'yellow',
  genoa: 'yellow',
  spinnaker: 'pink',
  gennaker: 'pink',
};

export function ControlPanel() {
  const reset = useSimStore((s) => s.reset);
  const activeMain = useSimStore((s) => s.activeMain);
  const activeHeadsail = useSimStore((s) => s.activeHeadsail);
  const activeDownwind = useSimStore((s) => s.activeDownwind);

  // 활성 세일을 정의된 순서대로 나열 (main → headsail → downwind)
  const activeKeys = [
    activeMain ? 'main' : null,
    activeHeadsail,
    activeDownwind,
  ].filter(Boolean);

  return (
    <aside className="w-[360px] shrink-0 h-screen overflow-y-auto bg-slate-900/95 backdrop-blur border-l border-slate-700/70 text-slate-100 px-4 py-4">
      <header className="mb-4 pb-3 border-b border-slate-700">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Sail Trim Lab</h1>
          <button
            onClick={reset}
            className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50 px-2 py-0.5 rounded"
          >
            Reset
          </button>
        </div>
        <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
          여러 종류의 세일을 활성화하고 각각의 트림을 조정해 모양·힘 변화를 실시간 비교.
        </p>
      </header>

      <SailInventory />

      <WindControls />

      {/* 활성 세일별로 트림 섹션 */}
      {activeKeys.map((key) => {
        const meta = SAIL_TYPES[key]?.meta;
        if (!meta) return null;
        const badge = meta.implemented === false ? 'WIP' : null;
        return (
          <SailSection
            key={key}
            label={meta.label}
            badge={badge}
            accent={SECTION_ACCENT[key] || 'cyan'}
            defaultOpen
          >
            <TrimControls sailKey={key} />
          </SailSection>
        );
      })}

      <Toggles />
      <EnvironmentControls />
      <Readout />

      <footer className="mt-6 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-snug">
        마우스 드래그로 카메라 회전 · 휠로 줌 · 우클릭 드래그로 이동.
      </footer>
    </aside>
  );
}
