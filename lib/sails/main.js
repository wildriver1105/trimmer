// Main sail (메인세일) — luff=mast, foot=boom, leech=free.
// 보트 좌표계: x=앞, y=위, z=좌현.

import { SAIL, TRIM_EFFECTS, RIG } from '../constants';
import { lerp, clamp, camberCurve, buildGridIndices, computeNormals } from './utils';

export const meta = {
  key: 'main',
  label: 'Main Sail',
  slot: 'main',
  trimKeys: ['outhaul', 'cunningham', 'halyard', 'backstay', 'vang', 'sheet', 'traveler'],
  defaults: {
    outhaul: 0.50, cunningham: 0.30, halyard: 0.50,
    backstay: 0.30, vang: 0.30, sheet: 0.60, traveler: 0.00,
  },
};

export function buildShape(trim) {
  const { outhaul, cunningham, halyard, backstay, vang, sheet, traveler } = trim;

  const sheetAngle = lerp(TRIM_EFFECTS.sheetEaseMaxAngle, 0.05, sheet);
  const boomAngle = sheetAngle - traveler * TRIM_EFFECTS.travelerToBoomAngle;
  const boomRise = (1 - sheet) * (1 - vang) * TRIM_EFFECTS.maxBoomRise;
  const baseTwist = TRIM_EFFECTS.vangBaseTwist * (1 - vang);
  const twistTotal = clamp(baseTwist + (1 - sheet) * TRIM_EFFECTS.sheetEaseToTwist, 0, 1.2);
  const mastBend = backstay * TRIM_EFFECTS.backstayToMastBend;

  const draftBase = SAIL.defaultDraftPos
    + cunningham * TRIM_EFFECTS.cunninghamToDraftPos
    + halyard * TRIM_EFFECTS.halyardToDraftPos;

  const N = SAIL.spanStations;
  const stations = [];
  for (let i = 0; i < N; i++) {
    const h = i / (N - 1);
    const chord = lerp(SAIL.footLength, SAIL.headWidth, h);

    const outhaulFactor = (1 - h);
    const backstayFactor = h;
    const camber = clamp(
      SAIL.defaultCamber
        + outhaul * TRIM_EFFECTS.outhaulToFootCamber * outhaulFactor
        + backstay * (TRIM_EFFECTS.backstayToUpperCamber * backstayFactor
                    + TRIM_EFFECTS.backstayToLowerCamber * (1 - backstayFactor)),
      0.02, 0.22
    );
    const draftPos = clamp(draftBase, 0.20, 0.70);
    const twist = twistTotal * (h * h);

    stations.push({ h, chord, camber, draftPos, twist });
  }

  return { sailKey: 'main', boomAngle, boomRise, mastBend, stations };
}

export function buildGeometry(shape) {
  const N = shape.stations.length;
  const M = SAIL.chordPoints;
  const positions = new Float32Array(N * M * 3);
  const cambers = new Float32Array(N * M);
  const flat = new Float32Array(N * M * 3);     // 캠버 없는 코드선 위치 (변형 baseline)
  const camberAmt = new Float32Array(N * M);    // 정점별 캠버 변위 크기
  const stationData = [];

  for (let i = 0; i < N; i++) {
    const st = shape.stations[i];
    const h = st.h;
    const yLuff = RIG.boomHeight + h * SAIL.luffLength;
    const mastDx = shape.mastBend * (h * h * h);

    const angle = shape.boomAngle + st.twist;
    const lx = -Math.cos(angle);
    const lz = -Math.sin(angle);
    const cx = Math.sin(angle);   // camber bulge 방향 (xz)
    const cz = -Math.cos(angle);

    const chord = st.chord;
    const camberDepth = st.camber * chord;
    const tilt = (shape.boomRise || 0) * (1 - h);
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    const luffX = mastDx;
    const luffZ = 0;
    const stPositions = [];
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1);
      const horiz = t * chord * cosT;
      const yRise = t * chord * sinT;
      const baseX = luffX + lx * horiz;
      const baseZ = luffZ + lz * horiz;
      const baseY = yLuff + yRise;
      const c = camberCurve(t, st.draftPos);
      const amt = c * camberDepth;
      const x = baseX + cx * amt;
      const z = baseZ + cz * amt;
      const y = baseY;

      const idx = (i * M + j) * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      flat[idx] = baseX; flat[idx + 1] = baseY; flat[idx + 2] = baseZ;
      camberAmt[i * M + j] = amt;
      cambers[i * M + j] = st.camber;
      stPositions.push([x, y, z]);
    }

    stationData.push({
      ...st,
      angle,
      chord,
      camberDir: [cx, 0, cz],
      luff: [luffX, yLuff, luffZ],
      leech: stPositions[M - 1],
      positions: stPositions,
    });
  }

  const indices = buildGridIndices(N, M);
  const normals = computeNormals(positions, indices);

  return { positions, indices, normals, cambers, flat, camberAmt, stationData, N, M };
}
