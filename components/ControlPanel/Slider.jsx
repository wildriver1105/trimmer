'use client';

import { useState } from 'react';

export function Slider({ id, value, onChange, min, max, step, unit, label, desc, format }) {
  const [showTip, setShowTip] = useState(false);
  const fmt = format || ((v) => v.toFixed(step < 1 ? 2 : 0));

  return (
    <div className="mb-3 relative">
      <div className="flex justify-between items-baseline mb-1">
        <label
          htmlFor={id}
          className="text-[11px] uppercase tracking-wider text-slate-300 hover:text-white cursor-help"
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        >
          {label}
          <span className="ml-1 text-slate-500">ⓘ</span>
        </label>
        <span className="text-xs font-mono text-cyan-300">
          {fmt(value)}
          {unit && <span className="text-slate-500 ml-0.5">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-400"
      />
      {showTip && desc && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 text-[10.5px] leading-snug bg-slate-900/95 border border-slate-700 rounded p-2 text-slate-200 shadow-lg">
          {desc}
        </div>
      )}
    </div>
  );
}
