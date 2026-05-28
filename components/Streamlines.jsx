'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

// America's Cup 스타일의 흐름선:
// 여러 높이에서 바람이 세일에 부딪혀 어디로 흐르는지 시각화.
//   - 흐름 engagement(=|CL|로 측정)가 낮으면 → 세일을 지나치며 곧게 흐름 (under-trim, 루핑)
//   - engagement가 높고 stall 아니면 → 세일 leeward 면을 따라 부드럽게 휘어 흐름 (정상 트림)
//   - stall(over-trim)이면 → 분리 지점부터 난류 형태로 흐트러짐
// dashed 라인의 dashOffset을 매 프레임 갱신해 "흐르는" 효과를 낸다.

const N_HEIGHTS = 8;
const LEEWARD_OFFSET = 0.28;
const UPSTREAM_DIST = 8;
const DOWNSTREAM_DIST = 8;
const UPSTREAM_N = 10;
const SAIL_N = 14;
const DOWNSTREAM_N = 10;

export function Streamlines({ geomData, forces, wind }) {
  // 단면 인덱스를 미리 매핑
  const config = useMemo(() => {
    const stations = geomData.stationData;
    const list = [];
    for (let k = 0; k < N_HEIGHTS; k++) {
      const h = 0.04 + (k / (N_HEIGHTS - 1)) * 0.90;
      let bestI = 0, bestDiff = 1e9;
      for (let i = 0; i < stations.length; i++) {
        const d = Math.abs(stations[i].h - h);
        if (d < bestDiff) { bestDiff = d; bestI = i; }
      }
      list.push({ stationIdx: bestI });
    }
    return list;
  }, [geomData.stationData]);

  // 트림/바람이 변할 때만 재계산
  const lines = useMemo(
    () => computeStreamlines(config, geomData, forces, wind),
    [config, geomData, forces, wind]
  );

  // dashOffset 애니메이션으로 흐름 표현
  const refs = useRef([]);
  useFrame((state) => {
    const phase = state.clock.elapsedTime * 1.6;
    refs.current.forEach((r) => {
      if (r && r.material) {
        r.material.dashOffset = -phase;
      }
    });
  });

  return (
    <group>
      {lines.map((line, k) => (
        <Line
          key={k}
          ref={(r) => { refs.current[k] = r; }}
          points={line.points}
          color={
            line.stalled
              ? '#ff7a7a'                                  // over-trim (빨강)
              : line.engagement < 0.18
                ? '#9ec5e6'                                // under-trim / luffing (옅은 파랑)
                : '#ffffff'                                // 정상 (흰색)
          }
          lineWidth={1.6}
          dashed
          dashSize={0.55}
          gapSize={0.35}
          transparent
          opacity={0.78}
        />
      ))}
    </group>
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
  const result = [];

  for (const cfg of config) {
    const st = stations[cfg.stationIdx];
    const sf = sForces[cfg.stationIdx];
    if (!st || !sf) continue;

    const stalled = sf.isStalled;
    // engagement: |CL|로 측정. 정상 양력 1.2 정도일 때 1.0으로 정규화.
    const engagement = stalled ? 1 : Math.min(1, Math.abs(sf.CL) / 1.2);

    const angle = st.angle;
    // 단면 leeward 법선 (xz 평면)
    const nx = Math.sin(angle);
    const nz = -Math.cos(angle);

    const luffX = st.luff[0];
    const luffY = st.luff[1];
    const luffZ = st.luff[2];

    // leeward 측 오프셋을 적용한 luff 시작점
    const luffOffsetX = luffX + nx * LEEWARD_OFFSET;
    const luffOffsetZ = luffZ + nz * LEEWARD_OFFSET;

    const sailM = st.positions.length;
    const chord = Math.hypot(
      st.leech[0] - st.luff[0],
      st.leech[2] - st.luff[2]
    );

    const points = [];

    // 1. 상류 — 멀리서 흐름 방향으로 직진해 luff offset 점까지
    for (let i = 0; i <= UPSTREAM_N; i++) {
      const t = i / UPSTREAM_N;
      const dist = UPSTREAM_DIST * (1 - t);
      points.push([
        luffOffsetX - fx * dist,
        luffY,
        luffOffsetZ - fz * dist,
      ]);
    }

    // 2. 세일 구간 — 직선 baseline과 세일 leeward 경로를 engagement로 lerp
    let lastX = luffOffsetX;
    let lastY = luffY;
    let lastZ = luffOffsetZ;
    for (let i = 1; i <= SAIL_N; i++) {
      const t = i / SAIL_N;
      const sailIdx = Math.min(sailM - 1, Math.round(t * (sailM - 1)));
      const sp = st.positions[sailIdx];
      const wrappedX = sp[0] + nx * LEEWARD_OFFSET;
      const wrappedY = sp[1];
      const wrappedZ = sp[2] + nz * LEEWARD_OFFSET;
      const straightX = luffOffsetX + fx * t * chord;
      const straightZ = luffOffsetZ + fz * t * chord;
      const straightY = luffY;
      let x = straightX + (wrappedX - straightX) * engagement;
      let z = straightZ + (wrappedZ - straightZ) * engagement;
      let y = straightY + (wrappedY - straightY) * engagement;
      // stall 후 흐트러진 난류
      if (stalled && t > 0.35) {
        const k = (t - 0.35) / 0.65;
        y += Math.sin(i * 1.7 + st.h * 9) * 0.30 * k;
        x += nx * Math.sin(i * 2.1 + st.h * 5) * 0.18 * k;
        z += nz * Math.sin(i * 2.1 + st.h * 5) * 0.18 * k;
      }
      points.push([x, y, z]);
      lastX = x; lastY = y; lastZ = z;
    }

    // 3. 하류 — 세일 끝에서 흐름 방향으로 직진
    for (let i = 1; i <= DOWNSTREAM_N; i++) {
      const t = i / DOWNSTREAM_N;
      const dist = DOWNSTREAM_DIST * t;
      points.push([lastX + fx * dist, lastY, lastZ + fz * dist]);
    }

    result.push({
      points: points.map((p) => new THREE.Vector3(...p)),
      stalled,
      engagement,
    });
  }
  return result;
}
