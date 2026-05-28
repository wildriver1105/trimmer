'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { COLORS, SAIL } from '@/lib/constants';

// 화살표 — 간단한 cylinder + cone 조합
function Arrow({ from, dir, length, color, label, headSize = 0.5 }) {
  const len = Math.max(length, 0.01);
  const dirN = new THREE.Vector3(...dir).normalize();
  const fromV = new THREE.Vector3(...from);

  // quaternion: +y(기본 cylinder/cone axis) -> dirN
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN);
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirN.x, dirN.y, dirN.z]);

  const shaftLen = Math.max(0.01, len - headSize);
  // cylinder는 기본적으로 +y 중심에 위치 → translate 절반만큼
  const cylinderPos = dirN.clone().multiplyScalar(shaftLen / 2).add(fromV);
  const conePos = dirN.clone().multiplyScalar(shaftLen + headSize / 2).add(fromV);

  return (
    <group>
      <mesh position={cylinderPos.toArray()} quaternion={quat}>
        <cylinderGeometry args={[0.05, 0.05, shaftLen, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={conePos.toArray()} quaternion={quat}>
        <coneGeometry args={[headSize * 0.35, headSize, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {label && (
        <Html
          position={dirN.clone().multiplyScalar(len + 0.4).add(fromV).toArray()}
          center
          style={{
            color,
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            textShadow: '0 0 6px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {label}
        </Html>
      )}
    </group>
  );
}

export { Arrow };

export function WindField({ wind }) {
  // 진풍 화살표 — 마스트 위쪽에서 들어옴, 길이는 풍속에 비례
  const [twx, , twz] = wind.TW;
  const tws = Math.hypot(twx, twz);
  const scale = 0.5; // m/s -> 화살표 길이 환산
  const trueLen = Math.max(2, Math.min(8, tws * scale));
  const dirT = tws > 0.01 ? [twx / tws, 0, twz / tws] : [1, 0, 0];
  const startT = [
    -dirT[0] * (trueLen + 2),
    SAIL.luffLength + 1.5,
    -dirT[2] * (trueLen + 2),
  ];

  // 상대풍 화살표 — 마스트 헤드 부근, 작게 표시
  const [awx, , awz] = wind.AW;
  const aws = Math.hypot(awx, awz);
  const awLen = Math.max(1.5, Math.min(6, aws * scale));
  const dirA = aws > 0.01 ? [awx / aws, 0, awz / aws] : [1, 0, 0];
  const startA = [
    -dirA[0] * (awLen + 1),
    SAIL.luffLength - 0.5,
    -dirA[2] * (awLen + 1),
  ];

  return (
    <group>
      <Arrow
        from={startT}
        dir={dirT}
        length={trueLen}
        color={COLORS.trueWind}
        label={`TW ${(tws / 0.5144).toFixed(1)} kt`}
        headSize={0.7}
      />
      <Arrow
        from={startA}
        dir={dirA}
        length={awLen}
        color={COLORS.appWind}
        label={`AW ${(aws / 0.5144).toFixed(1)} kt`}
        headSize={0.5}
      />
    </group>
  );
}
