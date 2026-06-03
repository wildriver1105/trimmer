'use client';

import { useSimStore } from '@/store/useSimStore';
import { SAIL_TYPES } from '@/lib/sails';

/**
 * 세일 인벤토리 — 메인 toggle + 헤드세일 라디오 + 다운윈드 라디오.
 * 같은 slot의 세일들은 상호 배타.
 */
export function SailInventory() {
  const activeMain = useSimStore((s) => s.activeMain);
  const activeHeadsail = useSimStore((s) => s.activeHeadsail);
  const activeDownwind = useSimStore((s) => s.activeDownwind);
  const toggleMain = useSimStore((s) => s.toggleMain);
  const setHeadsail = useSimStore((s) => s.setHeadsail);
  const setDownwind = useSimStore((s) => s.setDownwind);

  return (
    <section className="mb-4">
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Sail Inventory
      </h3>

      {/* Main toggle */}
      <SlotRow
        title="Mainsail"
        options={[
          { key: 'main', label: 'Main', impl: SAIL_TYPES.main.meta.implemented !== false },
        ]}
        selected={activeMain ? 'main' : null}
        onSelect={(k) => {
          if (k === 'main' && !activeMain) toggleMain();
          else if (k === null && activeMain) toggleMain();
        }}
        allowNone
      />

      {/* Headsail radio */}
      <SlotRow
        title="Headsail"
        options={[
          { key: 'jib',   label: 'Jib',   impl: SAIL_TYPES.jib.meta.implemented !== false },
          { key: 'genoa', label: 'Genoa', impl: SAIL_TYPES.genoa.meta.implemented !== false },
        ]}
        selected={activeHeadsail}
        onSelect={setHeadsail}
        allowNone
      />

      {/* Downwind radio */}
      <SlotRow
        title="Downwind"
        options={[
          { key: 'spinnaker', label: 'Spi',  impl: SAIL_TYPES.spinnaker.meta.implemented !== false },
          { key: 'gennaker',  label: 'Gen.', impl: SAIL_TYPES.gennaker.meta.implemented !== false },
        ]}
        selected={activeDownwind}
        onSelect={setDownwind}
        allowNone
      />
    </section>
  );
}

function SlotRow({ title, options, selected, onSelect, allowNone }) {
  return (
    <div className="mb-2">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      <div className="flex gap-1">
        {allowNone && (
          <Pill
            label="None"
            active={selected === null}
            onClick={() => onSelect(null)}
          />
        )}
        {options.map((o) => (
          <Pill
            key={o.key}
            label={o.label}
            active={selected === o.key}
            disabled={!o.impl}
            onClick={() => o.impl && onSelect(selected === o.key ? null : o.key)}
            title={!o.impl ? '아직 구현되지 않음' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({ label, active, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'flex-1 text-[11px] py-1 px-2 rounded border transition-colors',
        active
          ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100'
          : disabled
            ? 'bg-slate-800/40 border-slate-700/50 text-slate-600 cursor-not-allowed'
            : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-700/40',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
