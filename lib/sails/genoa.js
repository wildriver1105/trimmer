// Genoa — 마스트와 overlap 되는 큰 헤드세일.
// jib과 동일한 부착점이지만 clew가 마스트 뒤(- x)로 더 멀리 가서 main을 덮음.

import { RIG } from '../constants';
import { buildHeadsailShape, buildHeadsailGeometry } from './headsail';

const DIMS = {
  key: 'genoa',
  tack: [RIG.hullLength * 0.45, 0.35, 0],
  head: [0, RIG.mastHeight * 0.97, 0],
  // 더 큰 sail이라 clew range가 더 넓고 더 aft로 감
  clewRange: [
    [-2.5, 2.8, -3.5],   // eased — 더 멀고 높음
    [-4.2, 1.0, -1.2],   // trimmed in — 마스트 훨씬 뒤까지 overlap
  ],
  leadEffect: 0.8,
  inhaulerEffect: 0.85,
  camberLoose: 0.16, camberTight: 0.08,
  draftLoose: 0.55, draftTight: 0.35,
  nStations: 8,        // 살짝 더 많은 단면
  mChord: 20,
};

export const meta = {
  key: 'genoa',
  label: 'Genoa',
  slot: 'headsail',
  trimKeys: ['halyard', 'sheet', 'jibLead', 'inhauler'],
  defaults: { halyard: 0.55, sheet: 0.50, jibLead: 0.55, inhauler: 0.15 },
  implemented: true,
};

export function buildShape(trim) { return buildHeadsailShape(trim, DIMS); }
export function buildGeometry(shape) { return buildHeadsailGeometry(shape); }
