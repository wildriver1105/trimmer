'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, useMemo, useState, useEffect } from 'react';
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
import { computeSun } from '@/lib/sun';

// 페이지가 숨겨지거나 창이 포커스를 잃으면 active=false → 렌더 루프 일시정지.
// SSR 안전: document/window 접근은 useEffect 내부에서만.
function usePageActive() {
  const [active, setActive] = useState(true);
  useEffect(() => {
    // 보이는 동안은 항상 렌더, 탭이 진짜 숨겨졌을 때만(백그라운드/최소화/화면꺼짐) 정지.
    // hasFocus()까지 보면 창이 최전면이 아닐 때도 멈춰 3D가 안 보이는 문제가 생겨 제외.
    const update = () => setActive(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return active;
}

// 모바일/저전력 디바이스 감지 (클라이언트에서 마운트 후 1회). SSR 안전.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(
      typeof window !== 'undefined' &&
        (window.matchMedia?.('(pointer: coarse)').matches ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    );
  }, []);
  return isMobile;
}

export function Scene() {
  const active = usePageActive();
  const isMobile = useIsMobile();

  const TWS = useSimStore((s) => s.TWS);
  const TWA = useSimStore((s) => s.TWA);
  const SOG = useSimStore((s) => s.SOG);
  const trim = useSimStore((s) => s.trim);
  const timeOfDay = useSimStore((s) => s.timeOfDay);
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

  // 시각(time of day)에서 태양 방향·색·조명 도출
  const sun = useMemo(() => computeSun(timeOfDay), [timeOfDay]);
  const sunLightPos = useMemo(
    () => [sun.dir[0] * 80, Math.max(3, sun.dir[1] * 80), sun.dir[2] * 80],
    [sun]
  );

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
      frameloop={active ? 'always' : 'never'}
      dpr={isMobile ? 1 : [1, 2]}
      camera={{ position: [16, 10, 16], fov: 42, near: 0.1, far: 4000 }}
      gl={{
        antialias: !isMobile,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
    >
      {/* 안개 — 먼 바다를 수평선 색으로 페이드 (보트 근처는 영향 없음) */}
      <fog attach="fog" args={[sun.fogColor, 180, 1600]} />

      {/* 하늘 — 시각에 따라 태양 위치/대기 산란 변화 */}
      <Sky
        distance={450000}
        sunPosition={sun.dir}
        turbidity={sun.turbidity}
        rayleigh={sun.rayleigh}
        mieCoefficient={0.005}
        mieDirectionalG={0.88}
      />

      {/* 태양광 (시각에 따라 방향·색·세기 변화) + 하늘광 */}
      <ambientLight intensity={sun.ambient} />
      <directionalLight
        position={sunLightPos}
        intensity={sun.sunIntensity}
        color={sun.sunColor}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize-width={isMobile ? 1024 : 2048}
        shadow-mapSize-height={isMobile ? 1024 : 2048}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <hemisphereLight color={'#86b0d8'} groundColor={'#0a2438'} intensity={sun.hemi} />

      <Suspense fallback={null}>
        {/* 현실적인 바다 (반사 + 태양 글리터) */}
        <Ocean sunDirection={sun.dir} sunColor={sun.sunColor} />

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

        {/* 후처리 — 연기/화살표 글로우 + 가장자리 비네트.
            모바일에서는 풀스크린 프레임버퍼 할당이 GPU OOM 원인이므로 비활성화. */}
        {!isMobile && (
          <EffectComposer multisampling={4}>
            <Bloom
              intensity={0.38}
              luminanceThreshold={0.85}
              luminanceSmoothing={0.3}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.18} darkness={0.55} />
          </EffectComposer>
        )}
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
