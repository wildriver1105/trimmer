// Jib — 일반적인 working jib (non-overlapping headsail).

import { RIG } from '../constants';
import { buildHeadsailShape, buildHeadsailGeometry } from './headsail';

const DIMS = {
  key: 'jib',
  tack: [RIG.hullLength * 0.45, 0.35, 0],
  head: [0, RIG.mastHeight * 0.97, 0],
  // sheet=0 (eased) ↔ sheet=1 (trimmed in) 사이 clew 위치
  clewRange: [
    [-1.4, 2.5, -2.8],   // eased
    [-2.6, 0.9, -1.0],   // trimmed in
  ],
  leadEffect: 0.6,
  inhaulerEffect: 0.75,
  camberLoose: 0.14, camberTight: 0.07,
  draftLoose: 0.55, draftTight: 0.35,
  nStations: 7,
  mChord: 18,
};

export const meta = {
  key: 'jib',
  label: 'Jib',
  slot: 'headsail',
  trimKeys: ['halyard', 'sheet', 'jibLead', 'inhauler'],
  defaults: { halyard: 0.60, sheet: 0.55, jibLead: 0.50, inhauler: 0.20 },
  implemented: true,
};

export function buildShape(trim) { return buildHeadsailShape(trim, DIMS); }
export function buildGeometry(shape) { return buildHeadsailGeometry(shape); }
