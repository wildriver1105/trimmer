'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { COLORS, SAIL } from '@/lib/constants';

// 화살표 — 부드러운 모양:
//   - 끝 base에 반구 cap
//   - tapered shaft (앞쪽이 살짝 두꺼워져 헤드로 자연스럽게 연결)
//   - shaft↔head 사이 작은 ring을 둠 (집합부 어색함 제거)
//   - 헤드 cone의 segment 수 증가 + 살짝 emissive 글로우
function Arrow({ from, dir, length, color, label, headSize = 0.5 }) {
  const len = Math.max(length, 0.01);
  const dirN = useMemo(() => new THREE.Vector3(...dir).normalize(), [dir[0], dir[1], dir[2]]);
  const fromV = useMemo(() => new THREE.Vector3(...from), [from[0], from[1], from[2]]);

  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN);
    return q;
  }, [dirN]);

  const shaftLen = Math.max(0.01, len - headSize);
  const shaftR = Math.max(0.06, len * 0.022);
  const shaftFrontR = shaftR * 1.18;       // 앞쪽이 살짝 두꺼움 → 부드러운 taper
  const headBaseR = Math.max(headSize * 0.42, shaftR * 2.2);

  const basePos      = fromV.clone();
  const shaftCenter  = dirN.clone().multiplyScalar(shaftLen / 2).add(fromV);
  const joinPos      = dirN.clone().multiplyScalar(shaftLen).add(fromV);
  const conePos      = dirN.clone().multiplyScalar(shaftLen + headSize / 2).add(fromV);
  const labelPos     = dirN.clone().multiplyScalar(len + 0.4).add(fromV);

  return (
    <group>
      {/* base cap — 시작점 반구 */}
      <mesh position={basePos.toArray()}>
        <sphereGeometry args={[shaftR * 1.05, 16, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.18}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* shaft — tapered cylinder (뒤쪽 얇고 앞쪽 살짝 두꺼움) */}
      <mesh position={shaftCenter.toArray()} quaternion={quat}>
        <cylinderGeometry args={[shaftFrontR, shaftR, shaftLen, 24, 1, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>

      {/* shaft ↔ head 연결부에 작은 원반 — 시각적 매끄러움 */}
      <mesh position={joinPos.toArray()} quaternion={quat}>
        <sphereGeometry args={[headBaseR * 0.55, 20, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.28}
          roughness={0.28}
          metalness={0.15}
        />
      </mesh>

      {/* head cone — segment 증가 + 더 강한 글로우 */}
      <mesh position={conePos.toArray()} quaternion={quat}>
        <coneGeometry args={[headBaseR, headSize, 28, 4, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>

      {label && (
        <Html
          position={labelPos.toArray()}
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
