// 세일 종류 레지스트리. 각 모듈이 { meta, buildShape, buildGeometry }를 export.
// 외부에서는 SAIL_TYPES[key].buildShape(trim) 형태로 dispatch.

import * as main from './main';
import * as jib from './jib';
import * as genoa from './genoa';
import * as spinnaker from './spinnaker';
import * as gennaker from './gennaker';

export const SAIL_TYPES = {
  main, jib, genoa, spinnaker, gennaker,
};

export const SAIL_ORDER = ['main', 'jib', 'genoa', 'spinnaker', 'gennaker'];

// slot으로 그룹화: 같은 slot 내에서는 상호 배타.
export const SLOT_MEMBERS = {
  main: ['main'],
  headsail: ['jib', 'genoa'],
  downwind: ['spinnaker', 'gennaker'],
};

export function getSailType(key) {
  return SAIL_TYPES[key] || null;
}

export function buildShape(key, trim) {
  const t = getSailType(key);
  return t ? t.buildShape(trim) : null;
}

export function buildGeometry(key, shape) {
  const t = getSailType(key);
  return shape && t ? t.buildGeometry(shape) : null;
}

// 모든 세일의 기본값을 한 번에 가져오기 — store 초기화용.
export function allDefaults() {
  const out = {};
  for (const key of SAIL_ORDER) {
    out[key] = { ...SAIL_TYPES[key].meta.defaults };
  }
  return out;
}
