// Jib — 일반적인 working jib (non-overlapping headsail).

import { RIG } from '../constants';
import { buildHeadsailShape, buildHeadsailGeometry } from './headsail';

// Working jib — non-overlapping. clew가 마스트(x≈0) 부근까지만, foot은 bow→mast.
const DIMS = {
  key: 'jib',
  tack: [RIG.hullLength * 0.45, 0.35, 0],
  head: [0, RIG.mastHeight * 0.82, 0],   // fractional (~7/8 rig)
  // sheet=0 (eased) ↔ sheet=1 (trimmed in) 사이 clew 위치 — 마스트 부근까지만
  clewRange: [
    [0.4, 1.9, -2.0],    // eased
    [-0.2, 0.7, -0.8],   // trimmed in (clew ≈ 마스트)
  ],
  leadEffect: 0.55,
  inhaulerEffect: 0.65,
  camberLoose: 0.13, camberTight: 0.06,
  draftLoose: 0.52, draftTight: 0.34,
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
