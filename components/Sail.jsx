'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/lib/constants';

// CL을 색으로: 양수=청록(suction side), 음수=빨강 (반대)
function clToColor(cl, stalled, isStalledAlpha) {
  const c = new THREE.Color();
  if (stalled) {
    // 박리 표시 — 빨강
    c.setHSL(0.0, 0.85, 0.55);
    return c;
  }
  const t = Math.max(-1.5, Math.min(1.5, cl)) / 1.5;
  // -1=red, 0=white, 1=cyan
  const hue = t > 0 ? 0.5 : 0.02;
  const sat = Math.abs(t) * 0.85;
  c.setHSL(hue, sat, 0.65);
  return c;
}

export function Sail({ geomData, forces, showPressure, wireframe }) {
  const meshRef = useRef();
  const geomRef = useRef();

  // BufferGeometry 한 번 만들고 재사용
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geomData.positions), 3));
    g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(geomData.normals), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(geomData.N * geomData.M * 3), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(geomData.indices), 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 새로운 geomData/forces가 올 때마다 attribute 갱신
  useEffect(() => {
    const posAttr = geometry.getAttribute('position');
    const normAttr = geometry.getAttribute('normal');
    const colAttr = geometry.getAttribute('color');
    posAttr.array.set(geomData.positions);
    normAttr.array.set(geomData.normals);
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    // 인덱스도 단면 수/포인트 수가 바뀌면 갱신 (현재는 고정이지만 안전)
    const idx = geometry.getIndex();
    if (idx && idx.array.length !== geomData.indices.length) {
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(geomData.indices), 1));
    }

    // 색 계산: 단면별 CL과 stall 여부를 모든 단면 정점에 적용
    const N = geomData.N;
    const M = geomData.M;
    const colArr = colAttr.array;
    const stationForces = forces?.stationForces || [];
    for (let i = 0; i < N; i++) {
      const sf = stationForces[i];
      const c = sf
        ? clToColor(sf.CL, sf.isStalled)
        : new THREE.Color('#ffffff');
      for (let j = 0; j < M; j++) {
        const v = (i * M + j) * 3;
        colArr[v]     = c.r;
        colArr[v + 1] = c.g;
        colArr[v + 2] = c.b;
      }
    }
    colAttr.needsUpdate = true;

    geometry.computeBoundingSphere();
  }, [geomData, forces, geometry]);

  return (
    <group>
      {/* 메인 sail mesh — 패브릭 sheen이 있는 physical material */}
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

      {/* 시각 보조: 단면별 luff→leech 곡선을 옅게 그려 캠버를 강조 */}
      <SailSeams geomData={geomData} />
    </group>
  );
}

function SailSeams({ geomData }) {
  // 단면마다 polyline을 만들어 얇은 검정 선으로 표시.
  // 너무 많으면 시각적으로 노이즈가 되므로 짝수 단면만.
  return (
    <group>
      {geomData.stationData.map((st, i) => {
        if (i % 2 !== 0 && i !== geomData.stationData.length - 1) return null;
        const pts = st.positions.map((p) => new THREE.Vector3(...p));
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <line key={i} geometry={g}>
            <lineBasicMaterial color={'#7a8a9a'} transparent opacity={0.45} />
          </line>
        );
      })}
    </group>
  );
}
