'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const TT_LEN = 0.45;

// 텔테일 위치/박리 데이터를 매 프레임 갱신.
// 각 텔테일은 두 점짜리 BufferGeometry를 한 번만 만들고, useFrame에서
// position attribute만 in-place로 수정한다.

export function Telltales({ geomData, forces }) {
  // 텔테일 배치는 단면 인덱스와 chord 인덱스로 사전 계산.
  const ttSpec = useMemo(() => {
    const M = geomData.M;
    const luffIdx = Math.max(1, Math.round(M * 0.05));
    const leechIdx = Math.min(M - 2, Math.round(M * 0.95));
    const heights = [0.20, 0.50, 0.78];
    const stations = geomData.stationData;
    const list = [];
    for (const h of heights) {
      let bestI = 0;
      let bestDiff = 1e9;
      for (let i = 0; i < stations.length; i++) {
        const d = Math.abs(stations[i].h - h);
        if (d < bestDiff) { bestDiff = d; bestI = i; }
      }
      list.push({ stationIdx: bestI, chordIdx: luffIdx, side: 'luff' });
      list.push({ stationIdx: bestI, chordIdx: leechIdx, side: 'leech' });
    }
    return list;
  }, [geomData.M, geomData.stationData]);

  // 각 텔테일을 위한 geometry ref (mount 시 한 번만 만들어짐)
  const geomsRef = useRef([]);
  // refs는 첫 mount 이후 ttSpec.length만큼 채워진다.

  useEffect(() => {
    // 새 spec에 맞춰 길이 동기화
    geomsRef.current = ttSpec.map((_, k) => {
      const existing = geomsRef.current[k];
      if (existing) return existing;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      return g;
    }).slice(0, ttSpec.length);
  }, [ttSpec]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const stations = geomData.stationData;
    const sForces = forces.stationForces || [];
    const geoms = geomsRef.current;
    ttSpec.forEach((tt, k) => {
      const st = stations[tt.stationIdx];
      const sf = sForces[tt.stationIdx];
      const geom = geoms[k];
      if (!st || !sf || !geom) return;
      const base = st.positions[tt.chordIdx];
      const lx = Math.cos(st.angle);
      const lz = -Math.sin(st.angle);
      const stalled = sf.isStalled;
      const flap = stalled ? 1 : 0;
      const wobble = Math.sin(t * 8 + k * 1.3) * 0.5 + 0.5;
      const yLift = flap * (0.2 + 0.25 * wobble);
      const dirX = lx * (1 - flap * 0.5);
      const dirZ = lz * (1 - flap * 0.5);
      const p = geom.attributes.position;
      p.array[0] = base[0];
      p.array[1] = base[1];
      p.array[2] = base[2];
      p.array[3] = base[0] + dirX * TT_LEN;
      p.array[4] = base[1] + yLift;
      p.array[5] = base[2] + dirZ * TT_LEN;
      p.needsUpdate = true;
    });
  });

  return (
    <group>
      {ttSpec.map((tt, k) => (
        <TelltaleLine
          key={k}
          register={(g) => { geomsRef.current[k] = g; }}
          color={tt.side === 'luff' ? '#ff7777' : '#77ff77'}
        />
      ))}
    </group>
  );
}

function TelltaleLine({ register, color }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  }, []);
  useEffect(() => { register(geom); }, [register, geom]);
  return (
    <line geometry={geom}>
      <lineBasicMaterial color={color} />
    </line>
  );
}
