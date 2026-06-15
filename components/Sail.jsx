'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '@/lib/constants';

const PI = Math.PI;

// CL을 색으로: 양수=청록(suction side), 음수=빨강 (반대)
function clToColor(cl, stalled) {
  const c = new THREE.Color();
  if (stalled) { c.setHSL(0.0, 0.85, 0.55); return c; }
  const t = Math.max(-1.5, Math.min(1.5, cl)) / 1.5;
  const hue = t > 0 ? 0.5 : 0.02;
  const sat = Math.abs(t) * 0.85;
  c.setHSL(hue, sat, 0.65);
  return c;
}

// 변형 강조 색: 펄럭임=노랑기, 붕괴=회보라 — pressure 모드가 꺼졌을 때 시각 단서
function stateColor(base, luff, collapse) {
  const c = base.clone();
  if (collapse > 0.05) c.lerp(new THREE.Color('#6a6f86'), Math.min(0.7, collapse));
  else if (luff > 0.05) c.lerp(new THREE.Color('#dcd6a0'), Math.min(0.5, luff * 0.6));
  return c;
}

export function Sail({ geomData, forces, showPressure, wireframe }) {
  const meshRef = useRef();
  const dataRef = useRef({ geomData, forces });
  dataRef.current = { geomData, forces };

  const N = geomData.N;
  const M = geomData.M;

  // BufferGeometry 한 번 생성 (이 Sail 인스턴스는 sailKey로 keyed → N,M 고정)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geomData.positions), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geomData.normals), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * M * 3), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(geomData.indices), 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 색상 갱신 (시간 무관 — 트림/바람 변할 때만)
  useEffect(() => {
    const colAttr = geometry.getAttribute('color');
    const colArr = colAttr.array;
    const sForces = forces?.stationForces || [];
    for (let i = 0; i < N; i++) {
      const sf = sForces[i];
      let c = sf ? clToColor(sf.CL, sf.isStalled) : new THREE.Color('#ffffff');
      if (sf) c = stateColor(c, sf.luff || 0, sf.collapse || 0);
      for (let j = 0; j < M; j++) {
        const v = (i * M + j) * 3;
        colArr[v] = c.r; colArr[v + 1] = c.g; colArr[v + 2] = c.b;
      }
    }
    colAttr.needsUpdate = true;
  }, [geometry, forces, N, M]);

  // 매 프레임 변형: flat + camberDir·(camber·fill + 펄럭임 + 붕괴)
  useFrame((state) => {
    const { geomData, forces } = dataRef.current;
    const flat = geomData.flat;
    const camberAmt = geomData.camberAmt;
    const stations = geomData.stationData;
    const sForces = forces?.stationForces || [];
    if (!flat || !camberAmt) return;

    const posAttr = geometry.getAttribute('position');
    const pos = posAttr.array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < N; i++) {
      const st = stations[i];
      const sf = sForces[i];
      const fill = sf ? sf.fill : 1;
      const luff = sf ? sf.luff : 0;
      const collapse = sf ? sf.collapse : 0;
      const chord = st.chord || 1;
      const dir = st.camberDir || [0, 0, 1];
      const dx = dir[0], dy = dir[1], dz = dir[2];

      for (let j = 0; j < M; j++) {
        const t = j / (M - 1);
        const a = i * M + j;
        const idx = a * 3;

        // 캠버: fill로 스케일 (음수 fill → 안쪽으로 빨려 붕괴)
        let disp = camberAmt[a] * fill;

        // 펄럭임 — 앞전(러프, t 작음)에 집중, 양끝 고정
        if (luff > 0.01) {
          const wL = Math.sin(Math.min(1, t / 0.5) * PI);
          disp += luff * wL * chord * 0.18 * Math.sin(time * 9 + i * 1.7 + t * 8);
        }
        // 붕괴 — 전체 구겨짐 (양끝 고정)
        let yJit = 0;
        if (collapse > 0.01) {
          const wC = Math.sin(t * PI);
          disp += collapse * wC * chord * 0.35 * Math.sin(time * 5.5 + i * 2.3 + t * 12);
          yJit += collapse * wC * chord * 0.20 * Math.sin(time * 4.5 + i * 1.9 + t * 7);
        }
        if (luff > 0.01) {
          const wL = Math.sin(Math.min(1, t / 0.5) * PI);
          yJit += luff * wL * chord * 0.10 * Math.sin(time * 11 + i * 1.1 + t * 6);
        }

        pos[idx] = flat[idx] + dx * disp;
        pos[idx + 1] = flat[idx + 1] + dy * disp + yJit;
        pos[idx + 2] = flat[idx + 2] + dz * disp;
      }
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={showPressure ? '#ffffff' : COLORS.sail}
        vertexColors={showPressure}
        side={THREE.DoubleSide}
        roughness={0.62}
        metalness={0.0}
        sheen={1.0}
        sheenRoughness={0.55}
        sheenColor={'#ffffff'}
        clearcoat={0.06}
        clearcoatRoughness={0.6}
        wireframe={wireframe}
        transparent
        opacity={0.97}
      />
    </mesh>
  );
}
