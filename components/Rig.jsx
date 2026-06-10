'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import { RIG, SAIL, COLORS } from '@/lib/constants';

export function Rig({
  mastBend,
  boomAngle,
  boomRise = 0,
  showBoom = true,
  spinnakerPole = null,
  gennakerBowsprit = null,
}) {
  // 마스트: backstay에 따라 cubic으로 휨. TubeGeometry로 만들기.
  const mastGeom = useMemo(() => {
    const segments = 24;
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 6 }, (_, k) => {
        const t = k / 5;
        const y = t * RIG.mastHeight;
        // backstay tighten시 마스트가 앞(+x)으로 휘는 단순화된 모델
        const x = mastBend * (t * t * t);
        return new THREE.Vector3(x, y, 0);
      })
    );
    return new THREE.TubeGeometry(curve, segments, RIG.mastRadius, 12, false);
  }, [mastBend]);

  // 붐: boom angle만큼 y축 주위로 회전
  const boomLen = RIG.boomLength;

  return (
    <group>
      {/* 헐 */}
      <Hull />

      {/* 마스트 */}
      <mesh geometry={mastGeom} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.mast} roughness={0.4} metalness={0.5} />
      </mesh>

      {/* 붐 — 메인세일 활성 시에만 */}
      {showBoom && (
        <group position={[0, RIG.boomHeight, 0]} rotation={[0, -boomAngle, 0]}>
          <group rotation={[0, 0, -boomRise]}>
            <mesh
              position={[-boomLen / 2, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[RIG.boomRadius, RIG.boomRadius, boomLen, 12]} />
              <meshStandardMaterial color={COLORS.boom} roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[-boomLen, 0, 0]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color={'#aaa'} metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
          <BoomVang boomLen={boomLen} boomRise={boomRise} />
        </group>
      )}

      {/* 백스테이/포스테이 */}
      <Stay from={[mastBend, RIG.mastHeight, 0]} to={[-RIG.hullLength / 2 + 0.4, 0.4, 0]} />
      <Stay from={[mastBend, RIG.mastHeight, 0]} to={[RIG.hullLength / 2 - 0.4, 0.4, 0]} />

      {/* Spinnaker pole — base에서 tip까지 */}
      {spinnakerPole && <Spar from={spinnakerPole.base} to={spinnakerPole.tip} radius={0.07} />}

      {/* Gennaker bowsprit */}
      {gennakerBowsprit && <Spar from={gennakerBowsprit.base} to={gennakerBowsprit.tip} radius={0.06} />}
    </group>
  );
}

// Spar (cylinder) — pole이나 bowsprit 같은 봉을 두 점 사이에 그림.
function Spar({ from, to, radius = 0.06, color }) {
  const data = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    return { mid, quat, len };
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);
  return (
    <group>
      <mesh position={data.mid.toArray()} quaternion={data.quat} castShadow>
        <cylinderGeometry args={[radius, radius, data.len, 10]} />
        <meshStandardMaterial color={color || COLORS.mast} roughness={0.4} metalness={0.5} />
      </mesh>
      {/* 끝부분 표시 */}
      <mesh position={to}>
        <sphereGeometry args={[radius * 1.3, 10, 10]} />
        <meshStandardMaterial color={'#aaa'} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Boom Vang — gooseneck 아래 데크에서 boom 25% 지점까지 잇는 선.
// 부모 group은 (0, boomHeight, 0)에서 -boomAngle y회전된 상태이므로
// 이 컴포넌트는 그 local 좌표계에서 동작.
function BoomVang({ boomLen, boomRise }) {
  const attachT = 0.25; // boom의 25% 지점에 vang 부착
  // boom의 attach 점 (boom 내부 group과 동일한 z회전 적용 후 local)
  const ax = -attachT * boomLen * Math.cos(boomRise);
  const ay = attachT * boomLen * Math.sin(boomRise);
  // vang의 데크 쪽 끝: 마스트 기둥 근처 데크 위. local 좌표계에서 (0, -boomHeight + 0.3, 0)
  const dx = 0;
  const dy = -RIG.boomHeight + 0.3;
  const geom = useMemo(() => {
    const a = new THREE.Vector3(dx, dy, 0);
    const b = new THREE.Vector3(ax, ay, 0);
    return new THREE.BufferGeometry().setFromPoints([a, b]);
  }, [ax, ay, dx, dy]);
  return (
    <group>
      <line geometry={geom}>
        <lineBasicMaterial color={'#b8c2cc'} transparent opacity={0.85} />
      </line>
      {/* attach 점 작은 fitting */}
      <mesh position={[ax, ay, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={'#999'} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Stay({ from, to }) {
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  const geom = useMemo(() => {
    const a = new THREE.Vector3(fx, fy, fz);
    const b = new THREE.Vector3(tx, ty, tz);
    return new THREE.BufferGeometry().setFromPoints([a, b]);
  }, [fx, fy, fz, tx, ty, tz]);
  return (
    <line geometry={geom}>
      <lineBasicMaterial color={'#9aa5b1'} transparent opacity={0.7} />
    </line>
  );
}

function Hull() {
  // 단순한 보트 헐 — 둥근 박스 + 데크
  const hullGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const L = RIG.hullLength / 2;
    const W = RIG.hullBeam / 2;
    // 위에서 본 모양 (lozenge — 앞쪽 뾰족)
    shape.moveTo(L, 0);
    shape.bezierCurveTo(L * 0.6, W, -L * 0.6, W, -L, W * 0.4);
    shape.lineTo(-L, -W * 0.4);
    shape.bezierCurveTo(-L * 0.6, -W, L * 0.6, -W, L, 0);
    const settings = {
      depth: RIG.hullDepth,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.12,
      bevelSegments: 3,
      steps: 1,
    };
    const g = new THREE.ExtrudeGeometry(shape, settings);
    g.rotateX(Math.PI / 2);
    g.translate(0, -RIG.hullDepth + 0.2, 0);
    return g;
  }, []);

  return (
    <group>
      {/* 헐 — gelcoat 광택 (clearcoat) */}
      <mesh geometry={hullGeom} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={COLORS.hull}
          roughness={0.4}
          metalness={0.1}
          clearcoat={0.7}
          clearcoatRoughness={0.22}
        />
      </mesh>
      {/* 데크 — 무광 non-skid */}
      <mesh position={[0, 0.21, 0]} receiveShadow>
        <boxGeometry args={[RIG.hullLength * 0.95, 0.04, RIG.hullBeam * 0.85]} />
        <meshStandardMaterial color={'#3a4654'} roughness={0.85} />
      </mesh>
      {/* boot stripe — 광택 도장 */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[RIG.hullLength * 0.96, 0.06, RIG.hullBeam * 0.92]} />
        <meshPhysicalMaterial color={'#d9534f'} roughness={0.35} clearcoat={0.5} clearcoatRoughness={0.3} />
      </mesh>
    </group>
  );
}
