// 세일 종류 공통 헬퍼 — 캠버 곡선, 정점 노멀, 작은 헬퍼.

import * as THREE from 'three';

export const PI = Math.PI;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * 비대칭 캠버 곡선. t∈[0,1] → 0..1 사이의 정규화된 깊이.
 * draftPos에서 최대(=1), 양끝 0. piecewise sin으로 부드럽게.
 */
export function camberCurve(t, draftPos) {
  if (t <= 0 || t >= 1) return 0;
  if (t < draftPos) return Math.sin((PI / 2) * (t / draftPos));
  return Math.sin((PI / 2) * (1 - (t - draftPos) / (1 - draftPos)));
}

/**
 * 단면 격자에 대한 삼각형 인덱스를 생성. N=단면 수, M=단면당 chord 포인트.
 */
export function buildGridIndices(N, M) {
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
  return indices;
}

/**
 * 정점 정규벡터 계산 (face normal 누적 + 정규화).
 */
export function computeNormals(positions, indices) {
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
