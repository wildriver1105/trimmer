'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, useMemo } from 'react';
import { useSimStore, getActiveSails } from '@/store/useSimStore';
import { buildShape, buildGeometry } from '@/lib/sails';
import { computeWind, computeForces } from '@/lib/aero';
import { Sail } from './Sail';
import { Rig } from './Rig';
import { Ocean } from './Ocean';
import { WindField } from './WindField';
import { ForceArrows } from './ForceArrows';
import { Telltales } from './Telltales';
import { Streamlines } from './Streamlines';
import { SAIL, COLORS } from '@/lib/constants';

// 황혼(golden hour) 해 위치 — Sky와 directional light가 공유
const SUN_POS = [60, 14, -38];

export function Scene() {
  const TWS = useSimStore((s) => s.TWS);
  const TWA = useSimStore((s) => s.TWA);
  const SOG = useSimStore((s) => s.SOG);
  const trim = useSimStore((s) => s.trim);
  const activeMain = useSimStore((s) => s.activeMain);
  const activeHeadsail = useSimStore((s) => s.activeHeadsail);
  const activeDownwind = useSimStore((s) => s.activeDownwind);

  const showPressure = useSimStore((s) => s.showPressure);
  const showTelltales = useSimStore((s) => s.showTelltales);
  const showForces = useSimStore((s) => s.showForces);
  const showWind = useSimStore((s) => s.showWind);
  const showStreamlines = useSimStore((s) => s.showStreamlines);
  const showHeel = useSimStore((s) => s.showHeel);
  const streamDensity = useSimStore((s) => s.streamDensity);
  const wireframe = useSimStore((s) => s.wireframe);

  const activeKeys = useMemo(
    () => getActiveSails({ activeMain, activeHeadsail, activeDownwind }),
    [activeMain, activeHeadsail, activeDownwind]
  );

  const wind = useMemo(() => computeWind(TWS, TWA, SOG), [TWS, TWA, SOG]);

  // 활성 세일별 shape/geom/forces 계산.
  // sails 배열의 항목은 { key, shape, geomData, forces } 또는 stub은 null.
  const sails = useMemo(() => {
    return activeKeys
      .map((key) => {
        const shape = buildShape(key, trim[key]);
        if (!shape) return null; // 미구현 stub
        const geomData = buildGeometry(key, shape);
        if (!geomData) return null;
        const forces = computeForces(shape, geomData, wind);
        return { key, shape, geomData, forces };
      })
      .filter(Boolean);
  }, [activeKeys, trim, wind]);

  // 합산 forces (현재 readout에 사용하기 위해 main만 있을 때는 동일하지만,
  // 추후 다중 세일 합산 단계에서 확장).
  const mainSail = sails.find((s) => s.key === 'main');
  const spinnakerSail = sails.find((s) => s.key === 'spinnaker');
  const gennakerSail = sails.find((s) => s.key === 'gennaker');

  // 힐 각도(rad). 모든 활성 세일의 heel 성분 합 → tanh 포화로 최대 ±28° 정도.
  // 토글 OFF 면 0.
  const heelRoll = useMemo(() => {
    if (!showHeel) return 0;
    const totalHeel = sails.reduce((s, sl) => s + sl.forces.total.heel, 0);
    return 0.5 * Math.tanh(totalHeel / 1200);
  }, [showHeel, sails]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [16, 10, 16], fov: 42, near: 0.1, far: 300 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
    >
      <fog attach="fog" args={['#243c52', 55, 180]} />

      {/* 황혼 하늘 */}
      <Sky
        distance={450000}
        sunPosition={SUN_POS}
        turbidity={6}
        rayleigh={2.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.85}
      />

      {/* 낮게 깔린 따뜻한 해 + 차가운 하늘광 */}
      <ambientLight intensity={0.25} />
      <directionalLight
        position={SUN_POS}
        intensity={1.6}
        color={'#ffd9b0'}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <hemisphereLight color={'#86b0d8'} groundColor={'#0a2438'} intensity={0.45} />

      <Suspense fallback={null}>
        {/* 움직이는 바다 (GPU 파도) */}
        <Ocean />

        {/* 보트 및 세일 — 힐(heelRoll) 적용. WindField는 절대 좌표 유지 (외부에). */}
        <group rotation={[heelRoll, 0, 0]}>
          <Rig
            mastBend={mainSail?.shape.mastBend ?? 0}
            boomAngle={mainSail?.shape.boomAngle ?? 0}
            boomRise={mainSail?.shape.boomRise ?? 0}
            showBoom={!!mainSail}
            spinnakerPole={spinnakerSail?.shape.pole ?? null}
            gennakerBowsprit={gennakerSail?.shape.bowsprit ?? null}
          />

          {sails.map(({ key, geomData, forces }) => (
            <Sail
              key={key}
              geomData={geomData}
              forces={forces}
              showPressure={showPressure}
              wireframe={wireframe}
            />
          ))}

          {showStreamlines && sails.map(({ key, geomData, forces }) => (
            <Streamlines
              key={`sl-${key}`}
              geomData={geomData}
              forces={forces}
              wind={wind}
              density={streamDensity / Math.sqrt(sails.length)}
            />
          ))}
          {showForces && sails.map(({ key, forces }) => (
            <ForceArrows key={`fa-${key}`} sailKey={key} forces={forces} wind={wind} />
          ))}
          {showTelltales && sails.map(({ key, geomData, forces }) => (
            <Telltales key={`tt-${key}`} geomData={geomData} forces={forces} />
          ))}
        </group>

        {showWind && <WindField wind={wind} />}

        {/* 후처리 — 연기/화살표 글로우 + 가장자리 비네트 */}
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={0.45}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.25}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.18} darkness={0.55} />
        </EffectComposer>
      </Suspense>

      <OrbitControls
        target={[2, SAIL.luffLength / 2, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </Canvas>
  );
}
