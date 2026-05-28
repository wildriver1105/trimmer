'use client';

import { useMemo } from 'react';
import { useSimStore } from '@/store/useSimStore';
import { buildSailShape } from '@/lib/sailModel';
import { buildSailGeometry } from '@/lib/sailGeometry';
import { computeWind, computeForces } from '@/lib/aero';

const KTS = 0.5144;

// Readout는 동일 계산을 다시 한다. 가벼우므로 OK — 추후 Zustand selector로 캐시 가능.
export function Readout() {
  const TWS = useSimStore((s) => s.TWS);
  const TWA = useSimStore((s) => s.TWA);
  const SOG = useSimStore((s) => s.SOG);
  const outhaul = useSimStore((s) => s.outhaul);
  const cunningham = useSimStore((s) => s.cunningham);
  const halyard = useSimStore((s) => s.halyard);
  const backstay = useSimStore((s) => s.backstay);
  const vang = useSimStore((s) => s.vang);
  const sheet = useSimStore((s) => s.sheet);
  const traveler = useSimStore((s) => s.traveler);

  const data = useMemo(() => {
    const trim = { outhaul, cunningham, halyard, backstay, vang, sheet, traveler };
    const shape = buildSailShape(trim);
    const geomData = buildSailGeometry(shape);
    const wind = computeWind(TWS, TWA, SOG);
    const forces = computeForces(shape, geomData, wind);
    const sf = forces.stationForces;
    const avgAlpha = sf.length
      ? sf.reduce((a, b) => a + b.alphaDeg, 0) / sf.length
      : 0;
    const stalled = sf.filter((s) => s.isStalled).length;
    return { wind, forces, avgAlpha, stalled, total: sf.length };
  }, [TWS, TWA, SOG, outhaul, cunningham, halyard, backstay, vang, sheet, traveler]);

  const { wind, forces, avgAlpha, stalled, total } = data;
  const aws = wind.AWS / KTS;
  const awa = Math.abs(wind.AWA) * 180 / Math.PI;

  const drive = forces.total.drive;
  const heel = forces.total.heel;
  const ratio = Math.abs(heel) > 1e-3 ? drive / Math.abs(heel) : 0;

  return (
    <section>
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Readout
      </h3>
      <Row label="Apparent Wind" value={`${aws.toFixed(1)} kt @ ${awa.toFixed(0)}°`} />
      <Row label="Avg AoA" value={`${avgAlpha.toFixed(1)}°`} />
      <Row
        label="Stalled stations"
        value={`${stalled} / ${total}`}
        color={stalled > 0 ? '#f87171' : '#a3e635'}
      />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Box label="Drive" value={drive.toFixed(0)} unit="N" color="#ffd84d" />
        <Box label="Heel" value={heel.toFixed(0)} unit="N" color="#ff5d6c" />
        <Box label="Lift" value={forces.total.lift.toFixed(0)} unit="N" color="#3ddc84" />
        <Box label="Drag" value={forces.total.drag.toFixed(0)} unit="N" color="#ff8c42" />
      </div>
      <div className="mt-2 text-[11px] flex justify-between">
        <span className="text-slate-400">Drive/Heel ratio</span>
        <span className="font-mono text-cyan-200">{ratio.toFixed(2)}</span>
      </div>
    </section>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex justify-between text-[11px] py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono" style={{ color: color || '#67e8f9' }}>{value}</span>
    </div>
  );
}

function Box({ label, value, unit, color }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="font-mono text-sm" style={{ color }}>
        {value}<span className="text-slate-500 text-[10px] ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
