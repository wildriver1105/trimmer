// Gennaker / Code 0 (제네이커) — 비대칭 다운윈드/리치 세일. bowsprit 사용.

import { RIG } from '../constants';
import { lerp, clamp } from './utils';
import { buildBalloonGeometry } from './downwind';

const N_STATIONS = 8;
const M_CHORD = 18;

const HEAD = [0, RIG.mastHeight * 0.97, 0];
const BOW = [RIG.hullLength / 2 - 0.2, 0.45, 0];
const MAX_BOWSPRIT = 1.8;

export const meta = {
  key: 'gennaker',
  label: 'Gennaker',
  slot: 'downwind',
  trimKeys: ['halyard', 'sheet', 'tackLine', 'twist'],
  defaults: { halyard: 0.75, sheet: 0.50, tackLine: 0.50, twist: 0.40 },
  implemented: true,
};

function computeTack(trim) {
  const { tackLine } = trim;
  const ext = tackLine * MAX_BOWSPRIT;
  return [BOW[0] + ext, BOW[1] + ext * 0.08, 0];
}

function computeClew(trim) {
  const { sheet } = trim;
  return [
    lerp(-0.5, -3.5, sheet),
    lerp(3.0, 0.8, sheet),
    lerp(-3.6, -1.5, sheet),
  ];
}

export function buildShape(trim) {
  const { halyard, twist } = trim;
  const tack = computeTack(trim);
  const clew = computeClew(trim);

  const camberBase = lerp(0.30, 0.18, halyard);

  const stations = [];
  for (let i = 0; i < N_STATIONS; i++) {
    const h = i / (N_STATIONS - 1);
    // twist 큼 → 상부 캠버 falloff 강함 (head가 평평)
    const falloff = lerp(0.15, 0.55, twist);
    const camber = clamp(camberBase * (1 - falloff * h), 0.06, 0.35);
    stations.push({ h, camber, draftPos: 0.50, twist: 0 });
  }

  return {
    sailKey: 'gennaker',
    head: HEAD,
    tack,
    clew,
    bowsprit: { base: BOW, tip: tack },
    stations,
    _dims: { mChord: M_CHORD },
  };
}

export function buildGeometry(shape) {
  return buildBalloonGeometry(shape);
}
