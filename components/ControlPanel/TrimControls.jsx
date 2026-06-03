'use client';

import { useSimStore } from '@/store/useSimStore';
import { TRIM_SLIDER } from '@/lib/constants';
import { SAIL_TYPES } from '@/lib/sails';
import { Slider } from './Slider';

/**
 * 한 세일의 트림 슬라이더 모음. ControlPanel이 활성 세일마다 인스턴스 마운트.
 *
 * @param {string} sailKey - 'main' | 'jib' | 'genoa' | 'spinnaker' | 'gennaker'
 */
export function TrimControls({ sailKey }) {
  const trimValues = useSimStore((s) => s.trim[sailKey]);
  const setTrim = useSimStore((s) => s.setTrim);

  const sliderConfigs = TRIM_SLIDER[sailKey];
  const meta = SAIL_TYPES[sailKey]?.meta;
  if (!sliderConfigs || !meta || !trimValues) return null;

  return (
    <div>
      {meta.trimKeys.map((k) => {
        const cfg = sliderConfigs[k];
        if (!cfg) return null;
        const value = trimValues[k] ?? cfg.def;
        return (
          <Slider
            key={k}
            id={`${sailKey}.${k}`}
            value={value}
            onChange={(v) => setTrim(sailKey, k, v)}
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
    </div>
  );
}
