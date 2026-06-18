'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 풍동 스트림라인 — 2D 포텐셜 유동 추적:
//   각 높이 슬랩에서 세일 단면을 캠버선 위 bound vortex 분포로 모델링한다
//   (총 순환 Γ = ½·V·c·C_L, aero.js의 단면 C_L에서 받음). 자유류 + 유도속도장을
//   RK4로 적분해 스트림라인을 그린다. 이로써 흐름이 세일을 휘감고(Coanda),
//   흡입(풍하)면에서 가속해 선이 촘촘해지며(베르누이), 실속 시 후류가 흐트러진다.
//   국소 속도 → 밝기(빠를수록 흰색)로 가속/감속을 시각화.

const BASE_HEIGHTS = 6;
const BASE_OFFSETS = 9;
const OFFSET_RANGE = 3.6; // 측방 시드 분포 폭 (m)
const UPSTREAM_DIST = 7;  // 시드 상류 거리
const TRACE_STEPS = 64;   // RK4 스텝 수
const TRACE_DS = 0.34;    // 스텝 길이 (m) → 총 길이 ≈ 22m
const N_VORTEX = 9;       // 단면당 분포 vortex 수

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
    const slabs = [];
    const seen = new Set();
    for (let k = 0; k < nHeights; k++) {
      const h = 0.08 + (k / (nHeights - 1)) * 0.84;
      let bestI = 0, bestDiff = 1e9;
      for (let i = 0; i < stations.length; i++) {
        const d = Math.abs(stations[i].h - h);
        if (d < bestDiff) { bestDiff = d; bestI = i; }
      }
      if (seen.has(bestI)) continue;
      seen.add(bestI);
      slabs.push(bestI);
    }
    return { slabs, offsets };
  }, [geomData.stationData, density]);

  const lines = useMemo(
    () => traceFlow(config, geomData, forces, wind),
    [config, geomData, forces, wind]
  );

  return <FlowLines lines={lines} />;
}

// ──────────── 포텐셜 유동 추적 ────────────

// 한 슬랩(높이 단면)의 속도장: 자유류 + 분포 vortex 유도속도 (+ 실속 후류 교란).
function slabVelocity(px, pz, slab, Vfx, Vfz) {
  let vx = Vfx, vz = Vfz;
  const vo = slab.vortices;       // [x, z, g/(2π), ...]
  const rc2 = slab.rc2;
  for (let k = 0; k < vo.length; k += 3) {
    const rx = px - vo[k];
    const rz = pz - vo[k + 1];
    const inv = vo[k + 2] / (rx * rx + rz * rz + rc2);
    vx += -rz * inv;              // 2D vortex 유도속도 (수직, CCW)
    vz += rx * inv;
  }
  // 실속 후류: 세일 뒤쪽(하류) 띠에서 횡방향 진동 → 박리/난류
  if (slab.stalled) {
    const dx = px - slab.cx, dz = pz - slab.cz;
    const along = dx * slab.fx + dz * slab.fz;        // 하류 거리
    const lat = -dx * slab.fz + dz * slab.fx;         // 횡방향
    if (along > 0.2 && Math.abs(lat) < slab.chord * 1.3) {
      const w = Math.exp(-(lat * lat) / (slab.chord * slab.chord));
      const amp = slab.Vmag * 0.34 * w * Math.min(1, along / 2);
      const osc = Math.sin(along * 1.9 + slab.phase);
      vx += -slab.fz * amp * osc;
      vz += slab.fx * amp * osc;
    }
  }
  return [vx, vz];
}

function traceFlow(config, geomData, forces, wind) {
  const AWS = wind.AWS;
  if (AWS < 0.05) return [];
  const stations = geomData.stationData;
  const sForces = forces.stationForces || [];
  const Vmag = AWS;
  const fx = wind.AW[0] / AWS;
  const fz = wind.AW[2] / AWS;
  const Vfx = fx * Vmag, Vfz = fz * Vmag;
  const pfx = -fz, pfz = fx;        // 자유류에 수직 (시드 comb 방향)
  const lines = [];

  for (const si of config.slabs) {
    const st = stations[si];
    const sf = sForces[si];
    if (!st || !sf) continue;
    const pos = st.positions;       // 캠버선 (M개 3D 점)
    const M = pos.length;
    if (M < 2) continue;

    const slabY = (st.luff[1] + st.leech[1]) / 2;
    const chord = st.chord || 1;

    // 캠버선에 vortex 분포 (총 Γ = sf.gamma 균등 분배). g/(2π) 미리 곱함.
    const nv = Math.min(N_VORTEX, M);
    const vortices = new Float32Array(nv * 3);
    // 부호: 흡입(풍하)면 가속이 되도록 (Kutta-Joukowski 순환 방향).
    const gPer = -(sf.gamma || 0) / nv / (2 * Math.PI);
    let cxSum = 0, czSum = 0;
    for (let k = 0; k < nv; k++) {
      const idx = Math.round((k / (nv - 1)) * (M - 1));
      const p = pos[idx];
      vortices[k * 3] = p[0];
      vortices[k * 3 + 1] = p[2];
      vortices[k * 3 + 2] = gPer;
      cxSum += p[0]; czSum += p[2];
    }
    const slab = {
      vortices,
      rc2: (0.16 * chord) * (0.16 * chord),
      stalled: sf.isStalled,
      cx: cxSum / nv, cz: czSum / nv,
      fx, fz, Vmag, chord,
      phase: si * 1.7,
    };

    // 시드 중심 = 단면 chord 중점
    const ctrX = (st.luff[0] + st.leech[0]) / 2;
    const ctrZ = (st.luff[2] + st.leech[2]) / 2;

    for (const d of config.offsets) {
      let px = ctrX - fx * UPSTREAM_DIST + pfx * d;
      let pz = ctrZ - fz * UPSTREAM_DIST + pfz * d;
      const pts = [];
      const lum = [];
      for (let n = 0; n <= TRACE_STEPS; n++) {
        // 현재 속도 → 밝기 (빠를수록 흰색)
        const v = slabVelocity(px, pz, slab, Vfx, Vfz);
        const sp = Math.hypot(v[0], v[1]) / Vmag;
        pts.push(new THREE.Vector3(px, slabY, pz));
        lum.push(clamp(0.34 + 0.62 * (sp - 0.8) / 0.6, 0.26, 1.0));
        // RK4 (정규화 방향장, 균등 호 간격)
        const a = dirUnit(px, pz, slab, Vfx, Vfz);
        const b = dirUnit(px + 0.5 * TRACE_DS * a[0], pz + 0.5 * TRACE_DS * a[1], slab, Vfx, Vfz);
        const c = dirUnit(px + 0.5 * TRACE_DS * b[0], pz + 0.5 * TRACE_DS * b[1], slab, Vfx, Vfz);
        const e = dirUnit(px + TRACE_DS * c[0], pz + TRACE_DS * c[1], slab, Vfx, Vfz);
        px += (TRACE_DS / 6) * (a[0] + 2 * b[0] + 2 * c[0] + e[0]);
        pz += (TRACE_DS / 6) * (a[1] + 2 * b[1] + 2 * c[1] + e[1]);
      }
      const absd = Math.abs(d);
      const opacity = absd < 1.0 ? 0.95 : absd < 2.3 ? 0.7 : 0.45;
      lines.push({ points: pts, lum, opacity });
    }
  }
  return lines;
}

function dirUnit(px, pz, slab, Vfx, Vfz) {
  const v = slabVelocity(px, pz, slab, Vfx, Vfz);
  const m = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / m, v[1] / m];
}

// ──────────── 연속 스트림라인(dye streak) 렌더링 ────────────
//
// 풍동 실험처럼: 각 경로를 매끈한 연속 곡선으로 그리고(흐름장 형태가 항상 보임),
// 그 위로 밝은 띠(dye pulse)가 흘러 방향·속도를 나타낸다.
// 모든 곡선을 하나의 LineSegments로 합쳐 vertex color만 매 프레임 갱신(1 draw call).

const PULSES = 3;        // 한 곡선에 동시에 보이는 dye 띠 수
const FLOW_RATE = 0.85;  // 띠가 곡선을 횡단하는 속도
const AMBIENT = 0.62;    // 상시 밝기 계수 (국소 속도 lum에 곱)

// 각 스트림라인은 이미 RK4로 매끈하므로 원 점을 그대로 LineSegments로 잇는다.
// 정점 색 = 흰색×국소속도(lum) × 흐르는 dye 펄스. 빠른 곳=흰색, 느린 곳=회색.
function FlowLines({ lines }) {
  const built = useMemo(() => {
    let segVerts = 0;
    for (const ln of lines) if (ln.points && ln.points.length >= 2) segVerts += (ln.points.length - 1) * 2;
    const positions = new Float32Array(segVerts * 3);
    const sArr = new Float32Array(segVerts);      // 곡선 내 정규 위치 0..1
    const lumArr = new Float32Array(segVerts);    // 국소 속도 밝기
    const opArr = new Float32Array(segVerts);
    let v = 0;
    for (const ln of lines) {
      const P = ln.points;
      if (!P || P.length < 2) continue;
      const K = P.length;
      const op = ln.opacity ?? 0.75;
      for (let i = 0; i < K - 1; i++) {
        const a = P[i], b = P[i + 1];
        positions[v * 3] = a.x; positions[v * 3 + 1] = a.y; positions[v * 3 + 2] = a.z;
        sArr[v] = i / (K - 1); lumArr[v] = ln.lum[i]; opArr[v] = op; v++;
        positions[v * 3] = b.x; positions[v * 3 + 1] = b.y; positions[v * 3 + 2] = b.z;
        sArr[v] = (i + 1) / (K - 1); lumArr[v] = ln.lum[i + 1]; opArr[v] = op; v++;
      }
    }
    return { positions, colors: new Float32Array(segVerts * 3), sArr, lumArr, opArr, count: v };
  }, [lines]);

  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { colors, sArr, lumArr, opArr, count } = built;
    const phaseShift = t * FLOW_RATE;
    for (let v = 0; v < count; v++) {
      const s = sArr[v];
      const cell = s * PULSES - phaseShift;
      const f = cell - Math.floor(cell);
      const d = (f - 0.5) / 0.17;
      const pulse = Math.exp(-d * d);
      const edge = Math.min(1, s / 0.05) * Math.min(1, (1 - s) / 0.10);
      // 흰색 × (상시 + 펄스) × 국소속도 × opacity
      const g = (AMBIENT + 1.1 * pulse) * lumArr[v] * opArr[v] * edge;
      colors[v * 3] = g; colors[v * 3 + 1] = g; colors[v * 3 + 2] = g;
    }
    if (ref.current) ref.current.geometry.attributes.color.needsUpdate = true;
  });

  if (built.count === 0) return null;

  return (
    <lineSegments key={built.count} ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={built.positions} count={built.count} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={built.colors} count={built.count} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.82} blending={THREE.NormalBlending} depthWrite={false} />
    </lineSegments>
  );
}
