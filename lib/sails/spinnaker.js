// Spinnaker (스피네이커) — 다운윈드 대칭 풍선. pole 사용.

import { RIG } from '../constants';
import { lerp, clamp } from './utils';
import { buildBalloonGeometry } from './downwind';

const N_STATIONS = 8;
const M_CHORD = 18;

// 스피네이커는 보트 앞(+x)으로 날린다 — 크고 둥근 카이트가 바우 전방에 떠 있도록.
const HEAD = [2.8, RIG.mastHeight * 0.95, -0.3];     // 마스트헤드 전방+살짝 leeward
const POLE_BASE = [0, RIG.boomHeight + 0.6, 0];

export const meta = {
  key: 'spinnaker',
  label: 'Spinnaker',
  slot: 'downwind',
  trimKeys: ['halyard', 'sheet', 'guy', 'poleHeight', 'poleAngle'],
  defaults: { halyard: 0.80, sheet: 0.45, guy: 0.50, poleHeight: 0.50, poleAngle: 0.50 },
  implemented: true,
};

// Tack = pole tip. 바우 전방(+x) windward(+z). 둥근 풍선의 한쪽 아래 모서리.
//  poleAngle: 0=forward, 1=square out(측방). poleHeight: topping lift. guy: 전후(brace).
function computePoleTip(trim) {
  const { poleHeight, poleAngle, guy } = trim;
  const x = lerp(3.0, 4.8, poleAngle) - guy * 0.8;   // 전방
  const z = lerp(2.8, 4.8, poleAngle);                // windward (넓게)
  const y = lerp(3.2, 6.0, poleHeight);
  return [x, y, z];
}

// Clew = leeward sheet 점. 바우 전방(+x) leeward(-z). 풍선의 반대쪽 아래 모서리.
//  sheet: 0=eased(멀고 높음), 1=trimmed in(중심선 가깝고 낮음).
function computeClew(trim) {
  const { sheet } = trim;
  const x = lerp(4.6, 2.8, sheet);      // 전방
  const z = lerp(-4.8, -2.2, sheet);    // leeward (넓게)
  const y = lerp(4.4, 2.2, sheet);
  return [x, y, z];
}

export function buildShape(trim) {
  const { halyard } = trim;
  const tack = computePoleTip(trim);
  const clew = computeClew(trim);

  const camberBase = lerp(0.44, 0.30, halyard);   // 더 부풀게

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
