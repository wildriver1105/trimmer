'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Wind-tunnel 스타일 스트림라인:
//   - 각 높이에서 여러 측방 오프셋(perp-to-flow)으로 다발 형성
//   - 흐름 방향으로 march하면서 매 step마다 세일 영향을 계산
//   - 단면-로컬 (s, n) 좌표:
//       s = chord 방향 (luff → leech)
//       n = chord 수직 (leeward 양수)
//   - n > 0 (leeward 측):
//       정상: Coanda — sail surface(camber 곡선) 쪽으로 끌려감 + 가까울수록 가속(Bernoulli)
//       stall: separation point(30%) 이후 떨어져나가며 와류 형태로 진동
//   - n < 0 (windward 측):
//       세일 표면(chord 라인) 근처에서만 가벼운 deflection
// 시각화:
//   - 각 스트림라인을 따라 부드러운 둥근 파티클이 흘러감 (풍동 연기 모방)
//   - 파티클은 lifecycle: spawn→full→fade out
//   - additive blending + 라디얼 그라데이션 텍스처로 글로우 효과

// 기본(밀도 1.0) 기준: 6 높이 × 9 측방 라인.
const BASE_HEIGHTS = 6;
const BASE_OFFSETS = 9;
const OFFSET_RANGE = 3.5; // 측방 라인이 분포하는 최대 거리 (m)
const MARCH_N = 70;
const TOTAL_LEN = 22;
const UPSTREAM_DIST = 8;

// count개의 측방 오프셋을 [-OFFSET_RANGE, OFFSET_RANGE] 범위에 생성.
// 양쪽 끝은 듬성, 중앙(=세일 가까이)은 빽빽하도록 power curve 적용.
function makeOffsets(count) {
  if (count < 2) return [0];
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const t = -1 + (2 * i) / (count - 1); // -1 .. 1
    const sign = t < 0 ? -1 : 1;
    const curved = Math.pow(Math.abs(t), 1.35);
    offsets.push(sign * curved * OFFSET_RANGE);
  }
  return offsets;
}

export function Streamlines({ geomData, forces, wind, density = 1.0 }) {
  const config = useMemo(() => {
    const stations = geomData.stationData;
    const nHeights = Math.max(2, Math.round(BASE_HEIGHTS * density));
    const nOffsets = Math.max(3, Math.round(BASE_OFFSETS * density));
    const offsets = makeOffsets(nOffsets);
    const list = [];
    for (let k = 0; k < nHeights; k++) {
      const h = 0.08 + (k / (nHeights - 1)) * 0.84;
      let bestI = 0, bestDiff = 1e9;
      for (let i = 0; i < stations.length; i++) {
        const d = Math.abs(stations[i].h - h);
        if (d < bestDiff) { bestDiff = d; bestI = i; }
      }
      for (const off of offsets) {
        list.push({ stationIdx: bestI, offset: off });
      }
    }
    return list;
  }, [geomData.stationData, density]);

  const lines = useMemo(
    () => computeStreamlines(config, geomData, forces, wind),
    [config, geomData, forces, wind]
  );

  return <FlowLines lines={lines} />;
}

// ──────────── 연속 스트림라인(dye streak) 렌더링 ────────────
//
// 풍동 실험처럼: 각 경로를 매끈한 연속 곡선으로 그리고(흐름장 형태가 항상 보임),
// 그 위로 밝은 띠(dye pulse)가 흘러 방향·속도를 나타낸다.
// 모든 곡선을 하나의 LineSegments로 합쳐 vertex color만 매 프레임 갱신(1 draw call).

const RES = 48;          // 곡선 리샘플 해상도 (Catmull-Rom)
const PULSES = 3;        // 한 곡선에 동시에 보이는 dye 띠 수
const FLOW_RATE = 0.85;  // 띠가 곡선을 횡단하는 속도 (≈ PULSES/이 값 초)
const AMBIENT = 0.5;     // 곡선 상시 밝기 (흐름장 형태) — 밝은 배경에서도 보이게

function FlowLines({ lines }) {
  // 경로를 매끈하게 리샘플 → LineSegments 정점/메타 구성 (정적, lines 바뀔 때만)
  const built = useMemo(() => {
    const segVerts = lines.length * (RES - 1) * 2;
    const positions = new Float32Array(segVerts * 3);
    const sArr = new Float32Array(segVerts);       // 정점별 정규 호 위치 0..1
    const baseCol = new Float32Array(segVerts * 3);
    const baseOp = new Float32Array(segVerts);
    let v = 0;

    for (const line of lines) {
      if (!line.points || line.points.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(line.points);
      const pts = curve.getPoints(RES - 1);        // RES개 점
      const col = new THREE.Color(line.color);
      const op = line.opacity ?? 0.75;
      for (let i = 0; i < RES - 1; i++) {
        const s0 = i / (RES - 1);
        const s1 = (i + 1) / (RES - 1);
        const a = pts[i], b = pts[i + 1];
        // segment 시작 정점
        positions[v * 3] = a.x; positions[v * 3 + 1] = a.y; positions[v * 3 + 2] = a.z;
        sArr[v] = s0; baseOp[v] = op;
        baseCol[v * 3] = col.r; baseCol[v * 3 + 1] = col.g; baseCol[v * 3 + 2] = col.b;
        v++;
        // segment 끝 정점
        positions[v * 3] = b.x; positions[v * 3 + 1] = b.y; positions[v * 3 + 2] = b.z;
        sArr[v] = s1; baseOp[v] = op;
        baseCol[v * 3] = col.r; baseCol[v * 3 + 1] = col.g; baseCol[v * 3 + 2] = col.b;
        v++;
      }
    }
    const colors = new Float32Array(segVerts * 3);
    return { positions, colors, sArr, baseCol, baseOp, count: v };
  }, [lines]);

  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { colors, sArr, baseCol, baseOp, count } = built;
    const phaseShift = t * FLOW_RATE;
    for (let v = 0; v < count; v++) {
      const s = sArr[v];
      // 흐르는 dye 띠: PULSES개의 가우시안 blob이 곡선을 따라 흐름
      const cell = (s * PULSES - phaseShift);
      const f = cell - Math.floor(cell);          // 0..1 (셀 내 위치)
      const d = (f - 0.5) / 0.16;
      const pulse = Math.exp(-d * d);
      // 양끝 페이드 (멀리 뻗은 상/하류 끝을 부드럽게)
      const edge = Math.min(1, s / 0.06) * Math.min(1, (1 - s) / 0.10);
      const bright = (AMBIENT + 1.25 * pulse) * baseOp[v] * edge;
      colors[v * 3] = baseCol[v * 3] * bright;
      colors[v * 3 + 1] = baseCol[v * 3 + 1] * bright;
      colors[v * 3 + 2] = baseCol[v * 3 + 2] * bright;
    }
    if (ref.current) ref.current.geometry.attributes.color.needsUpdate = true;
  });

  if (built.count === 0) return null;

  return (
    // key=count: 정점 수가 바뀌면 새 geometry로 remount (three는 attribute 리사이즈 미지원)
    <lineSegments key={built.count} ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={built.positions}
          count={built.count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={built.colors}
          count={built.count}
          itemSize={3}
        />
      </bufferGeometry>
      {/* NormalBlending + 적당한 opacity — 밝은 수면/어두운 세일 양쪽에서 보임 */}
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.78}
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function computeStreamlines(config, geomData, forces, wind) {
  const [awx, , awz] = wind.AW;
  const AWS = wind.AWS;
  if (AWS < 0.05) return [];
  const fx = awx / AWS;
  const fz = awz / AWS;

  const stations = geomData.stationData;
  const sForces = forces.stationForces || [];
  const dt = TOTAL_LEN / MARCH_N;
  const result = [];

  for (const cfg of config) {
    const st = stations[cfg.stationIdx];
    const sf = sForces[cfg.stationIdx];
    if (!st || !sf) continue;

    const luffX = st.luff[0];
    const luffY = st.luff[1];
    const luffZ = st.luff[2];

    // 코드 방향 (luff → leech). 헤드 단면처럼 luff==leech로 수렴하면 chord 길이가 0 →
    // NaN 방지를 위해 건너뛴다.
    const chordLen = Math.hypot(st.leech[0] - luffX, st.leech[2] - luffZ);
    if (chordLen < 1e-4) continue;
    const sx = (st.leech[0] - luffX) / chordLen;
    const sz = (st.leech[2] - luffZ) / chordLen;

    // chord에 수직, leeward 양수 (camber bulge 방향)
    const nx = Math.sin(st.angle);
    const nz = -Math.cos(st.angle);

    // 흐름에 수직, leeward 측 (스트림라인 시드 배치용)
    let perpX = -fz;
    let perpZ = fx;
    if (perpX * nx + perpZ * nz < 0) {
      perpX = -perpX;
      perpZ = -perpZ;
    }

    const stalled = sf.isStalled;
    const engagement = stalled ? 0.85 : Math.min(1, Math.abs(sf.CL) / 1.2);
    const d = cfg.offset;

    // 시드 — far upstream
    let px = luffX + perpX * d - fx * UPSTREAM_DIST;
    let py = luffY;
    let pz = luffZ + perpZ * d - fz * UPSTREAM_DIST;
    const points = [[px, py, pz]];

    for (let i = 1; i <= MARCH_N; i++) {
      const dx = px - luffX;
      const dz = pz - luffZ;
      const s = dx * sx + dz * sz;
      const n = dx * nx + dz * nz;
      const sNorm = s / chordLen;

      // 이 s 위치에서의 세일 표면 n 값 (camber 곡선, sailGeometry와 동일 모델)
      let sailN = 0;
      if (sNorm > 0 && sNorm < 1) {
        const dp = st.draftPos;
        if (sNorm < dp) {
          sailN = st.camber * chordLen * Math.sin((Math.PI / 2) * (sNorm / dp));
        } else {
          sailN = st.camber * chordLen * Math.sin((Math.PI / 2) * (1 - (sNorm - dp) / (1 - dp)));
        }
      }

      let perpAdjust = 0;
      let flowMult = 1;
      let yAdjust = 0;

      if (sNorm > -0.05 && sNorm < 1.0) {
        // 세일 영향 구간
        if (n > 0) {
          // leeward
          const separated = stalled && sNorm > 0.30;
          if (!separated) {
            // Coanda: 세일 표면 살짝 위로 끌려감
            const targetN = sailN + 0.14;
            const attract = 0.28 * engagement;
            perpAdjust = (targetN - n) * attract;
            // Bernoulli — 표면 근처에서 가속
            const closeness = Math.max(0, 1 - Math.abs(n - sailN) / 0.7);
            flowMult = 1 + 0.45 * closeness * engagement;
          } else {
            // 분리 + 와류 shedding
            const wakeAge = (sNorm - 0.30) / 0.70;
            // 살짝 leeward로 떠남
            perpAdjust = 0.08 * wakeAge;
            // 와류 진동 — perp와 y 평면에서 위상차 있는 회전 형태
            const phase = i * 1.7 + sNorm * 8 + d * 1.5;
            const amp = 0.45 * wakeAge;
            perpAdjust += amp * Math.sin(phase);
            yAdjust = amp * 0.7 * Math.cos(phase);
            flowMult = 1 - 0.18 * wakeAge;
          }
        } else if (sNorm > 0) {
          // windward — chord 라인 근처에서만 가벼운 deflection
          const dist = -n; // 양수
          const reachR = 0.5;
          if (dist < reachR) {
            const factor = 1 - dist / reachR;
            perpAdjust = -0.08 * factor * factor;
            flowMult = 1 - 0.10 * factor;
          }
        }
      } else if (sNorm >= 1.0 && sNorm < 1.6) {
        // 후류 wake
        if (stalled && Math.abs(n) < 1.5) {
          const wakeAge = (sNorm - 1.0) / 0.6;
          const fade = 1 - wakeAge;
          const phase = i * 1.4 + sNorm * 4 + d * 2;
          yAdjust = 0.55 * fade * Math.sin(phase);
          perpAdjust = 0.40 * fade * Math.cos(phase);
        }
      }

      px += fx * dt * flowMult + perpX * perpAdjust;
      pz += fz * dt * flowMult + perpZ * perpAdjust;
      py += yAdjust;

      points.push([px, py, pz]);
    }

    // 색상 — 흰색/회색 톤으로 통일. 흐름 상태는 명도로 구분.
    //   정상=밝은 흰색, 언더트림=중간 회색, stall(난류)=짙은 회색.
    let baseLum;
    if (stalled) baseLum = 0.55;
    else if (engagement < 0.18) baseLum = 0.74;
    else baseLum = 1.0;
    // 줄마다 명도를 살짝 흩어 흰색~회색이 자연스럽게 섞이게 (lateral offset 해시)
    const hash = (Math.sin(d * 127.1) * 43758.5453);
    const jit = 0.72 + 0.28 * (hash - Math.floor(hash));
    const lum = Math.max(0, Math.min(1, baseLum * jit));
    const color = new THREE.Color(lum, lum, lum);

    // 세일 가까울수록 더 진하게
    const absD = Math.abs(d);
    let opacity;
    if (absD < 1.0) opacity = 0.88;
    else if (absD < 2.2) opacity = 0.65;
    else opacity = 0.42;

    result.push({
      points: points.map((p) => new THREE.Vector3(...p)),
      color,
      opacity,
    });
  }
  return result;
}
