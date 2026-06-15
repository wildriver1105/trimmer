// Genoa — 마스트와 overlap 되는 큰 헤드세일.
// jib과 동일한 부착점이지만 clew가 마스트 뒤(- x)로 더 멀리 가서 main을 덮음.

import { RIG } from '../constants';
import { buildHeadsailShape, buildHeadsailGeometry } from './headsail';

// Genoa — masthead + mast 뒤로 overlap (과거 jib 사이즈와 동일).
const DIMS = {
  key: 'genoa',
  tack: [RIG.hullLength * 0.45, 0.35, 0],
  head: [0, RIG.mastHeight * 0.97, 0],
  clewRange: [
    [-1.4, 2.5, -2.8],   // eased
    [-2.6, 0.9, -1.0],   // trimmed in — 마스트 뒤로 overlap
  ],
  leadEffect: 0.6,
  inhaulerEffect: 0.75,
  camberLoose: 0.14, camberTight: 0.07,
  draftLoose: 0.55, draftTight: 0.35,
  nStations: 8,
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
