'use client';

import { useSimStore } from '@/store/useSimStore';
import { SLIDER } from '@/lib/constants';
import { Slider } from './Slider';

const KEYS = ['outhaul', 'cunningham', 'halyard', 'backstay', 'vang', 'sheet', 'traveler'];

export function TrimControls() {
  const state = useSimStore();
  const set = useSimStore((s) => s.set);

  return (
    <section className="mb-5">
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Sail Trim
      </h3>
      {KEYS.map((k) => {
        const cfg = SLIDER[k];
        return (
          <Slider
            key={k}
            id={k}
            value={state[k]}
            onChange={(v) => set(k, v)}
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            unit={cfg.unit}
            label={cfg.label}
            desc={cfg.desc}
            format={(v) => v.toFixed(2)}
          />
        );
      })}
    </section>
  );
}
