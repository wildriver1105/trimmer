// Spinnaker/Gennaker 등 풍하 풍선 세일의 공통 geometry helper.
// 3개 corner(head, tack, clew)를 받아 단면 격자 메시를 생성하고
// 평균 sail plane의 법선 방향으로 camber bulge를 줌.

import { lerp, camberCurve, buildGridIndices, computeNormals } from './utils';

export function buildBalloonGeometry(shape) {
  const N = shape.stations.length;
  const M = shape._dims?.mChord ?? 18;
  const positions = new Float32Array(N * M * 3);
  const cambers = new Float32Array(N * M);
  const flat = new Float32Array(N * M * 3);
  const camberAmt = new Float32Array(N * M);
  const stationData = [];

  const [hx, hy, hz] = shape.head;
  const [tx, ty, tz] = shape.tack;
  const [cx, cy, cz] = shape.clew;

  // 평균 sail plane의 법선 (bulge 방향). edge1 × edge2 후 +x 쪽으로 정렬.
  const e1x = hx - tx, e1y = hy - ty, e1z = hz - tz;
  const e2x = hx - cx, e2y = hy - cy, e2z = hz - cz;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  if (nx < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const nLen = Math.hypot(nx, ny, nz) || 1;
  nx /= nLen; ny /= nLen; nz /= nLen;

  // 스팬 길이 — head로부터 foot midpoint
  const midFx = (tx + cx) / 2;
  const midFy = (ty + cy) / 2;
  const midFz = (tz + cz) / 2;
  const spanLen = Math.hypot(hx - midFx, hy - midFy, hz - midFz);
  const dh = spanLen / (N - 1);

  let lastAngle = 0;
  for (let i = 0; i < N; i++) {
    const st = shape.stations[i];
    const h = st.h;
    const luffX = lerp(tx, hx, h);
    const luffY = lerp(ty, hy, h);
    const luffZ = lerp(tz, hz, h);
    const leechX = lerp(cx, hx, h);
    const leechY = lerp(cy, hy, h);
    const leechZ = lerp(cz, hz, h);

    const dx = leechX - luffX;
    const dy = leechY - luffY;
    const dz = leechZ - luffZ;
    const chord = Math.hypot(dx, dy, dz);
    const chordXZ = Math.hypot(dx, dz);

    let angle = chordXZ > 1e-3 ? Math.atan2(luffZ - leechZ, luffX - leechX) : lastAngle;
    lastAngle = angle;

    const camberDepth = st.camber * chord;

    const stPositions = [];
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1);
      const baseX = luffX + dx * t;
      const baseY = luffY + dy * t;
      const baseZ = luffZ + dz * t;
      const cF = camberCurve(t, st.draftPos);
      const amt = cF * camberDepth;
      // 모든 단면 공통 bulge 방향 (풍선 효과)
      const x = baseX + nx * amt;
      const y = baseY + ny * amt;
      const z = baseZ + nz * amt;

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
      dh,
      camberDir: [nx, ny, nz],
      luff: [luffX, luffY, luffZ],
      leech: stPositions[M - 1],
      positions: stPositions,
    });
  }

  const indices = buildGridIndices(N, M);
  const normals = computeNormals(positions, indices);

  return { positions, indices, normals, cambers, flat, camberAmt, stationData, N, M };
}
