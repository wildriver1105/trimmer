// Spinnaker (스피네이커) — 다운윈드 대칭 풍선. pole 사용.

import { RIG } from '../constants';
import { lerp, clamp } from './utils';
import { buildBalloonGeometry } from './downwind';

const N_STATIONS = 8;
const M_CHORD = 18;
const POLE_LEN = 3.6;

const HEAD = [0, RIG.mastHeight * 0.97, 0];
const POLE_BASE = [0, RIG.boomHeight + 0.4, 0];

export const meta = {
  key: 'spinnaker',
  label: 'Spinnaker',
  slot: 'downwind',
  trimKeys: ['halyard', 'sheet', 'guy', 'poleHeight', 'poleAngle'],
  defaults: { halyard: 0.80, sheet: 0.45, guy: 0.50, poleHeight: 0.50, poleAngle: 0.50 },
  implemented: true,
};

function computePoleTip(trim) {
  const { poleHeight, poleAngle } = trim;
  // 각도: 0=forward(+x), 1=aft(-x). 항상 windward(+z).
  const alpha = lerp(Math.PI / 4, 3 * Math.PI / 4, poleAngle);
  return [
    Math.cos(alpha) * POLE_LEN,
    lerp(1.8, 5.0, poleHeight),
    Math.sin(alpha) * POLE_LEN,
  ];
}

function computeClew(trim) {
  const { sheet, guy } = trim;
  return [
    lerp(-1.0, -4.5, guy),
    lerp(2.8, 0.8, sheet),
    lerp(-3.8, -1.8, sheet),
  ];
}

export function buildShape(trim) {
  const { halyard } = trim;
  const tack = computePoleTip(trim);
  const clew = computeClew(trim);

  const camberBase = lerp(0.36, 0.22, halyard);

  const stations = [];
  for (let i = 0; i < N_STATIONS; i++) {
    const h = i / (N_STATIONS - 1);
    const camber = clamp(camberBase * (1 - 0.15 * h), 0.10, 0.40);
    stations.push({ h, camber, draftPos: 0.50, twist: 0 });
  }

  return {
    sailKey: 'spinnaker',
    head: HEAD,
    tack,
    clew,
    pole: { base: POLE_BASE, tip: tack },
    stations,
    _dims: { mChord: M_CHORD },
  };
}

export function buildGeometry(shape) {
  return buildBalloonGeometry(shape);
}
