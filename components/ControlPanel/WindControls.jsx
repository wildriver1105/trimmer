'use client';

import { useSimStore } from '@/store/useSimStore';
import { SLIDER } from '@/lib/constants';
import { Slider } from './Slider';

export function WindControls() {
  const TWS = useSimStore((s) => s.TWS);
  const TWA = useSimStore((s) => s.TWA);
  const SOG = useSimStore((s) => s.SOG);
  const set = useSimStore((s) => s.set);

  const keys = ['TWS', 'TWA', 'SOG'];
  const values = { TWS, TWA, SOG };

  return (
    <section className="mb-5">
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Wind &amp; Speed
      </h3>
      {keys.map((k) => {
        const cfg = SLIDER[k];
        return (
          <Slider
            key={k}
            id={k}
            value={values[k]}
            onChange={(v) => set(k, v)}
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            unit={cfg.unit}
            label={cfg.label}
            desc={cfg.desc}
          />
        );
      })}
    </section>
  );
}
