'use client';

import { useSimStore } from '@/store/useSimStore';
import { SLIDER } from '@/lib/constants';
import { Slider } from './Slider';

function formatHour(v) {
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function EnvironmentControls() {
  const timeOfDay = useSimStore((s) => s.timeOfDay);
  const set = useSimStore((s) => s.set);
  const cfg = SLIDER.timeOfDay;

  return (
    <section className="mb-5">
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Environment
      </h3>
      <Slider
        id="timeOfDay"
        value={timeOfDay}
        onChange={(v) => set('timeOfDay', v)}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        unit=""
        label={cfg.label}
        desc={cfg.desc}
        format={formatHour}
      />
    </section>
  );
}
