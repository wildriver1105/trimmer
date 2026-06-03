'use client';

import { useMemo } from 'react';
import { useSimStore, getActiveSails } from '@/store/useSimStore';
import { buildShape, buildGeometry } from '@/lib/sails';
import { computeWind, computeForces } from '@/lib/aero';

const KTS = 0.5144;

// 활성 세일 전체에 대해 공력 계산을 다시 한다 (가벼움). Scene과 별도 instance.
// 추후 selector로 결과 공유 가능.
export function Readout() {
  const TWS = useSimStore((s) => s.TWS);
  const TWA = useSimStore((s) => s.TWA);
  const SOG = useSimStore((s) => s.SOG);
  const trim = useSimStore((s) => s.trim);
  const activeMain = useSimStore((s) => s.activeMain);
  const activeHeadsail = useSimStore((s) => s.activeHeadsail);
  const activeDownwind = useSimStore((s) => s.activeDownwind);

  const data = useMemo(() => {
    const wind = computeWind(TWS, TWA, SOG);
    const activeKeys = getActiveSails({ activeMain, activeHeadsail, activeDownwind });

    const perSail = [];
    let totDrive = 0, totHeel = 0, totLift = 0, totDrag = 0;
    let totalStations = 0, stalledStations = 0;
    let alphaSum = 0;

    for (const key of activeKeys) {
      const shape = buildShape(key, trim[key]);
      if (!shape) continue;
      const geomData = buildGeometry(key, shape);
      if (!geomData) continue;
      const forces = computeForces(shape, geomData, wind);
      const sf = forces.stationForces;
      totDrive += forces.total.drive;
      totHeel  += forces.total.heel;
      totLift  += forces.total.lift;
      totDrag  += forces.total.drag;
      totalStations += sf.length;
      stalledStations += sf.filter((s) => s.isStalled).length;
      alphaSum += sf.reduce((a, b) => a + b.alphaDeg, 0);
      perSail.push({ key, drive: forces.total.drive, lift: forces.total.lift });
    }

    const avgAlpha = totalStations ? alphaSum / totalStations : 0;
    return {
      wind,
      avgAlpha,
      stalled: stalledStations,
      total: totalStations,
      totDrive, totHeel, totLift, totDrag,
      perSail,
      anyActive: activeKeys.length > 0,
    };
  }, [TWS, TWA, SOG, trim, activeMain, activeHeadsail, activeDownwind]);

  const { wind, avgAlpha, stalled, total, totDrive, totHeel, totLift, totDrag, perSail, anyActive } = data;
  const aws = wind.AWS / KTS;
  const awa = Math.abs(wind.AWA) * 180 / Math.PI;
  const ratio = Math.abs(totHeel) > 1e-3 ? totDrive / Math.abs(totHeel) : 0;

  return (
    <section>
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 border-b border-slate-700 pb-1">
        Readout
      </h3>
      <Row label="Apparent Wind" value={`${aws.toFixed(1)} kt @ ${awa.toFixed(0)}°`} />
      {anyActive ? (
        <>
          <Row label="Avg AoA" value={`${avgAlpha.toFixed(1)}°`} />
          <Row
            label="Stalled stations"
            value={`${stalled} / ${total}`}
            color={stalled > 0 ? '#f87171' : '#a3e635'}
          />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Box label="Drive" value={totDrive.toFixed(0)} unit="N" color="#ffd84d" />
            <Box label="Heel" value={totHeel.toFixed(0)} unit="N" color="#ff5d6c" />
            <Box label="Lift" value={totLift.toFixed(0)} unit="N" color="#3ddc84" />
            <Box label="Drag" value={totDrag.toFixed(0)} unit="N" color="#ff8c42" />
          </div>
          <div className="mt-2 text-[11px] flex justify-between">
            <span className="text-slate-400">Drive/Heel ratio</span>
            <span className="font-mono text-cyan-200">{ratio.toFixed(2)}</span>
          </div>
          {perSail.length > 1 && (
            <div className="mt-2 pt-2 border-t border-slate-800">
              <div className="text-[9.5px] uppercase tracking-wider text-slate-500 mb-1">세일별 Drive</div>
              {perSail.map((p) => (
                <div key={p.key} className="flex justify-between text-[10.5px]">
                  <span className="text-slate-400 capitalize">{p.key}</span>
                  <span className="font-mono text-cyan-200">{p.drive.toFixed(0)} N</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-[11px] text-slate-500 py-1">활성 세일 없음 — 위 패널에서 세일을 선택하세요.</div>
      )}
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
