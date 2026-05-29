'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
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
//   - dashOffset 애니메이션으로 흐름 표현

const N_HEIGHTS = 6;
const LATERAL_OFFSETS = [-3.2, -2.0, -1.0, -0.4, 0.4, 0.9, 1.5, 2.4, 3.4];
const MARCH_N = 70;
const TOTAL_LEN = 22;
const UPSTREAM_DIST = 8;

export function Streamlines({ geomData, forces, wind }) {
  const config = useMemo(() => {
    const stations = geomData.stationData;
    const list = [];
    for (let k = 0; k < N_HEIGHTS; k++) {
      const h = 0.08 + (k / (N_HEIGHTS - 1)) * 0.84;
      let bestI = 0, bestDiff = 1e9;
      for (let i = 0; i < stations.length; i++) {
        const d = Math.abs(stations[i].h - h);
        if (d < bestDiff) { bestDiff = d; bestI = i; }
      }
      for (const off of LATERAL_OFFSETS) {
        list.push({ stationIdx: bestI, offset: off });
      }
    }
    return list;
  }, [geomData.stationData]);

  const lines = useMemo(
    () => computeStreamlines(config, geomData, forces, wind),
    [config, geomData, forces, wind]
  );

  // dashOffset 애니메이션 (flow 방향성 시각화)
  const refs = useRef([]);
  useFrame((state) => {
    const phase = state.clock.elapsedTime * 1.6;
    for (const r of refs.current) {
      if (r && r.material) r.material.dashOffset = -phase;
    }
  });

  return (
    <group>
      {lines.map((line, k) => (
        <Line
          key={k}
          ref={(r) => { refs.current[k] = r; }}
          points={line.points}
          color={line.color}
          lineWidth={1.2}
          dashed
          dashSize={line.dashSize}
          gapSize={line.gapSize}
          transparent
          opacity={line.opacity}
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
  const dt = TOTAL_LEN / MARCH_N;
  const result = [];

  for (const cfg of config) {
    const st = stations[cfg.stationIdx];
    const sf = sForces[cfg.stationIdx];
    if (!st || !sf) continue;

    const luffX = st.luff[0];
    const luffY = st.luff[1];
    const luffZ = st.luff[2];

    // 코드 방향 (luff → leech)
    const chordLen = Math.hypot(st.leech[0] - luffX, st.leech[2] - luffZ);
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

    // 색상 — 정상/언더트림/오버트림 구분
    let color, dashSize, gapSize;
    if (stalled) {
      color = '#ff7a7a';                // 오버트림: 빨강
      dashSize = 0.35; gapSize = 0.22;  // 더 잘게 — 난류 느낌
    } else if (engagement < 0.18) {
      color = '#9ec5e6';                // 언더트림(luffing): 옅은 파랑
      dashSize = 0.55; gapSize = 0.40;
    } else {
      color = '#ffffff';                // 정상 흐름: 흰색
      dashSize = 0.50; gapSize = 0.30;
    }

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
      dashSize,
      gapSize,
    });
  }
  return result;
}
