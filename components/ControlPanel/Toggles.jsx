'use client';

import { useSimStore } from '@/store/useSimStore';
import { SLIDER } from '@/lib/constants';
import { Slider } from './Slider';

const items = [
  { key: 'showPressure', label: 'Pressure colormap' },
  { key: 'showStreamlines', label: 'Streamlines' },
  { key: 'showTelltales', label: 'Telltales' },
  { key: 'showForces', label: 'Force arrows' },
  { key: 'showWind', label: 'Wind arrows' },
  { key: 'showHeel', label: 'Heel (boat tilt)' },
  { key: 'wireframe', label: 'Wireframe' },
];

export function Toggles() {
  const state = useSimStore();
  const toggle = useSimStore((s) => s.toggle);
  const set = useSimStore((s) => s.set);
  const streamDensity = useSimStore((s) => s.streamDensity);
  const sdCfg = SLIDER.streamDensity;

  return (
    <section className="mb-5">
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Visualization
      </h3>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {items.map((it) => {
          const on = state[it.key];
          return (
            <button
              key={it.key}
              onClick={() => toggle(it.key)}
              className={`text-[11px] py-1.5 px-2 rounded border transition-colors text-left ${
                on
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                  : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-700/40'
              }`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                    style={{ background: on ? '#67e8f9' : '#475569' }} />
              {it.label}
            </button>
          );
        })}
      </div>
      {/* 스트림라인이 켜졌을 때만 밀도 슬라이더 노출 */}
      {state.showStreamlines && (
        <Slider
          id="streamDensity"
          value={streamDensity}
          onChange={(v) => set('streamDensity', v)}
          min={sdCfg.min}
          max={sdCfg.max}
          step={sdCfg.step}
          unit={sdCfg.unit}
          label={sdCfg.label}
          desc={sdCfg.desc}
          format={(v) => v.toFixed(1)}
        />
      )}
    </section>
  );
}
