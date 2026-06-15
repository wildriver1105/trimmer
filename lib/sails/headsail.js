// 공유 헤드세일(jib/genoa) helper. dimensions는 호출자가 제공.

import { lerp, clamp, camberCurve, buildGridIndices, computeNormals } from './utils';

/**
 * 헤드세일 shape 구성. dims = { tack, head, clewRange } — clewRange는 sheet에 따른 clew
 * 위치 분포 [easedPos, trimmedPos].
 */
export function buildHeadsailShape(trim, dims) {
  const { sheet, jibLead, inhauler, halyard } = trim;
  const [easedClew, trimmedClew] = dims.clewRange;

  // Sheet으로 clew 위치를 두 극단 사이 lerp
  let cx = lerp(easedClew[0], trimmedClew[0], sheet);
  let cy = lerp(easedClew[1], trimmedClew[1], sheet);
  let cz = lerp(easedClew[2], trimmedClew[2], sheet);
  cy += (jibLead - 0.5) * (dims.leadEffect ?? 0.6);
  cz += inhauler * (dims.inhaulerEffect ?? 0.75);

  const camberBase = lerp(dims.camberLoose ?? 0.14, dims.camberTight ?? 0.07, halyard);
  const draftBase  = lerp(dims.draftLoose ?? 0.55, dims.draftTight ?? 0.35, halyard);

  const N = dims.nStations ?? 7;
  const stations = [];
  for (let i = 0; i < N; i++) {
    const h = i / (N - 1);
    const camber = clamp(camberBase * (1 - 0.25 * h), 0.02, 0.20);
    const draftPos = clamp(draftBase, 0.20, 0.65);
    stations.push({ h, camber, draftPos, twist: 0 });
  }

  return {
    sailKey: dims.key,
    tack: dims.tack,
    head: dims.head,
    clew: [cx, cy, cz],
    stations,
    _dims: dims,
  };
}

/**
 * 헤드세일 geometry 구성. shape는 buildHeadsailShape 결과.
 */
export function buildHeadsailGeometry(shape) {
  const N = shape.stations.length;
  const M = shape._dims.mChord ?? 18;
  const positions = new Float32Array(N * M * 3);
  const cambers = new Float32Array(N * M);
  const flat = new Float32Array(N * M * 3);
  const camberAmt = new Float32Array(N * M);
  const stationData = [];

  const [tx, ty, tz] = shape.tack;
  const [hx, hy, hz] = shape.head;
  const [cx, cy, cz] = shape.clew;

  const spanLen = Math.hypot(hx - tx, hy - ty, hz - tz);
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
    const chordXZ = Math.hypot(dx, dz);
    const chord = Math.hypot(dx, dy, dz);

    let angle = chordXZ > 1e-3 ? Math.atan2(luffZ - leechZ, luffX - leechX) : lastAngle;
    lastAngle = angle;

    const camDirX = Math.sin(angle);
    const camDirZ = -Math.cos(angle);
    const camberDepth = st.camber * chord;

    const stPositions = [];
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1);
      const baseX = luffX + dx * t;
      const baseY = luffY + dy * t;
      const baseZ = luffZ + dz * t;
      const cF = camberCurve(t, st.draftPos);
      const amt = cF * camberDepth;
      const x = baseX + camDirX * amt;
      const y = baseY;
      const z = baseZ + camDirZ * amt;

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
      camberDir: [camDirX, 0, camDirZ],
      luff: [luffX, luffY, luffZ],
      leech: stPositions[M - 1],
      positions: stPositions,
    });
  }

  const indices = buildGridIndices(N, M);
  const normals = computeNormals(positions, indices);

  return { positions, indices, normals, cambers, flat, camberAmt, stationData, N, M };
}
