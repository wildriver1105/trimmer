'use client';

import { useState } from 'react';

/**
 * 접을 수 있는 세일 섹션. label 좌측에 화살표, 우측에 optional badge.
 * children은 펼친 상태에서만 렌더링.
 */
export function SailSection({ label, badge, defaultOpen = true, children, accent = 'cyan' }) {
  const [open, setOpen] = useState(defaultOpen);

  const accentClass = {
    cyan:   { border: 'border-cyan-500/40', text: 'text-cyan-200', dot: '#67e8f9' },
    yellow: { border: 'border-yellow-500/40', text: 'text-yellow-200', dot: '#fbbf24' },
    pink:   { border: 'border-pink-500/40', text: 'text-pink-200', dot: '#f472b6' },
  }[accent] || { border: 'border-cyan-500/40', text: 'text-cyan-200', dot: '#67e8f9' };

  return (
    <section className={`mb-3 border ${accentClass.border} rounded-md bg-slate-800/30`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-slate-700/30 rounded-t-md"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: accentClass.dot }}
          />
          <span className={`text-[11.5px] font-medium ${accentClass.text}`}>{label}</span>
          {badge && <span className="text-[9.5px] text-slate-400 uppercase tracking-wider">{badge}</span>}
        </div>
        <span className={`text-[10px] text-slate-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}>▼</span>
      </button>
      {open && <div className="px-2.5 pb-2 pt-1">{children}</div>}
    </section>
  );
}
