// 세일 형상 -> Three.js BufferGeometry 정점 생성.
//
// 단면별 좌표 모델:
//   각 단면은 boom 평면(=수평) 위에 놓인 캠버 곡선이다.
//   - 단면의 시작점 (luff): 마스트의 해당 높이 (마스트 벤드로 약간 -x 방향 휨).
//   - 단면의 끝점 (leech): luff에서 chord 만큼 떨어진 점.
//     leech 방향 = boom 방향 회전 (boomAngle) + 단면 자체의 twist(추가 회전).
//   - 캠버는 luff→leech 선에 수직(풍하측, +z)으로 부풀어 오름.
//     캠버 곡선은 sin 형태로 단순화: y_camber(t) = camber * chord * sin(pi*t).
//     실제로는 draft 위치를 t=draftPos에서 최대로 놓이게 비대칭화.

import * as THREE from 'three';
import { SAIL, RIG } from './constants';

const PI = Math.PI;

// 비대칭 캠버 곡선: t∈[0,1] -> 0,1 사이의 정점 높이.
// draftPos에서 최대(=1), 양끝에서 0.
function camberCurve(t, draftPos) {
  if (t <= 0 || t >= 1) return 0;
  // 양쪽을 부드럽게 만나는 piecewise sin
  if (t < draftPos) return Math.sin((PI / 2) * (t / draftPos));
  return Math.sin((PI / 2) * (1 - (t - draftPos) / (1 - draftPos)));
}

/**
 * shape (buildSailShape의 결과)에서 sail mesh의 vertices/indices를 만든다.
 * 정점은 (spanStations × chordPoints) 격자.
 *
 * @param {THREE.BufferGeometry} geom — 재사용할 geometry (없으면 새로 만들지 않음)
 * @returns {{ positions: Float32Array, indices: Uint16Array, normals: Float32Array,
 *             cambers: Float32Array, // 단면별 camber 값 (벡터 컬러 등에 사용)
 *             stationData: Array }}
 */
export function buildSailGeometry(shape) {
  const N = shape.stations.length;       // 단면 수
  const M = SAIL.chordPoints;            // 코드 방향 샘플
  const positions = new Float32Array(N * M * 3);
  const cambers = new Float32Array(N * M); // shader에서 vertex color 용도
  const stationData = [];

  for (let i = 0; i < N; i++) {
    const st = shape.stations[i];
    const h = st.h;
    // luff(마스트) 쪽 점의 y 좌표 (foot=0 → head=luffLength)
    const yLuff = h * SAIL.luffLength;
    // 마스트 벤드: 마스트는 헤드 부근에서 뒤로(-x) 휨. cubic 형태.
    const mastDx = -shape.mastBend * (h * h * h);

    // 이 단면의 chord 방향 (xz 평면에서):
    // 기본 boom 방향은 +x (보트 앞). boomAngle만큼 z쪽으로 회전 (+면 -z = leeward 가정).
    // 단면 twist만큼 더 회전.
    const angle = shape.boomAngle + st.twist;
    // leech 방향 벡터 (단위)
    const lx = Math.cos(angle);
    const lz = -Math.sin(angle); // +angle → -z (leeward)

    // camber bulge 방향: leech 방향에 수직, +z쪽 (leeward로 부풀기)
    const cx = -Math.sin(angle);
    const cz = -Math.cos(angle);

    const chord = st.chord;
    const camberDepth = st.camber * chord;

    const luffX = mastDx;
    const luffZ = 0;
    const stPositions = [];
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1); // 0=luff, 1=leech
      const baseX = luffX + lx * t * chord;
      const baseZ = luffZ + lz * t * chord;
      const c = camberCurve(t, st.draftPos);
      const x = baseX + cx * c * camberDepth;
      const z = baseZ + cz * c * camberDepth;
      const y = yLuff;

      const idx = (i * M + j) * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      cambers[i * M + j] = st.camber;
      stPositions.push([x, y, z]);
    }

    stationData.push({
      ...st,
      angle,
      luff: [luffX, yLuff, luffZ],
      leech: stPositions[M - 1],
      positions: stPositions,
    });
  }

  // 인덱스 (삼각형 두 개씩)
  const indices = new Uint32Array((N - 1) * (M - 1) * 6);
  let ii = 0;
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j;
      const b = i * M + (j + 1);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + (j + 1);
      indices[ii++] = a;
      indices[ii++] = c;
      indices[ii++] = b;
      indices[ii++] = b;
      indices[ii++] = c;
      indices[ii++] = d;
    }
  }

  // 노멀 (간단 계산)
  const normals = computeNormals(positions, indices);

  return { positions, indices, normals, cambers, stationData, N, M };
}

function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  const ax = new THREE.Vector3();
  const bx = new THREE.Vector3();
  const cx = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    ax.set(positions[ia], positions[ia + 1], positions[ia + 2]);
    bx.set(positions[ib], positions[ib + 1], positions[ib + 2]);
    cx.set(positions[ic], positions[ic + 1], positions[ic + 2]);
    ab.subVectors(bx, ax);
    ac.subVectors(cx, ax);
    n.crossVectors(ab, ac);
    normals[ia] += n.x; normals[ia + 1] += n.y; normals[ia + 2] += n.z;
    normals[ib] += n.x; normals[ib + 1] += n.y; normals[ib + 2] += n.z;
    normals[ic] += n.x; normals[ic + 1] += n.y; normals[ic + 2] += n.z;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i], y = normals[i + 1], z = normals[i + 2];
    const len = Math.hypot(x, y, z) || 1;
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
  return normals;
}
