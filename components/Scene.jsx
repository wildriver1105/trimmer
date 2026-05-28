'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { useSimStore } from '@/store/useSimStore';
import { buildSailShape } from '@/lib/sailModel';
import { buildSailGeometry } from '@/lib/sailGeometry';
import { computeWind, computeForces } from '@/lib/aero';
import { Sail } from './Sail';
import { Rig } from './Rig';
import { WindField } from './WindField';
import { ForceArrows } from './ForceArrows';
import { Telltales } from './Telltales';
import { Streamlines } from './Streamlines';
import { SAIL, COLORS } from '@/lib/constants';

export function Scene() {
  // 모든 트림/바람 값 구독
  const TWS = useSimStore((s) => s.TWS);
  const TWA = useSimStore((s) => s.TWA);
  const SOG = useSimStore((s) => s.SOG);
  const outhaul = useSimStore((s) => s.outhaul);
  const cunningham = useSimStore((s) => s.cunningham);
  const halyard = useSimStore((s) => s.halyard);
  const backstay = useSimStore((s) => s.backstay);
  const vang = useSimStore((s) => s.vang);
  const sheet = useSimStore((s) => s.sheet);
  const traveler = useSimStore((s) => s.traveler);

  const showPressure = useSimStore((s) => s.showPressure);
  const showTelltales = useSimStore((s) => s.showTelltales);
  const showForces = useSimStore((s) => s.showForces);
  const showWind = useSimStore((s) => s.showWind);
  const showStreamlines = useSimStore((s) => s.showStreamlines);
  const wireframe = useSimStore((s) => s.wireframe);

  const { shape, geomData, wind, forces } = useMemo(() => {
    const trim = { outhaul, cunningham, halyard, backstay, vang, sheet, traveler };
    const shape = buildSailShape(trim);
    const geomData = buildSailGeometry(shape);
    const wind = computeWind(TWS, TWA, SOG);
    const forces = computeForces(shape, geomData, wind);
    return { shape, geomData, wind, forces };
  }, [TWS, TWA, SOG, outhaul, cunningham, halyard, backstay, vang, sheet, traveler]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [16, 10, 16], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[COLORS.sky]} />
      <fog attach="fog" args={[COLORS.sky, 35, 110]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[18, 25, 10]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <hemisphereLight color={'#8fb6e0'} groundColor={'#0a2a3c'} intensity={0.35} />

      <Suspense fallback={null}>
        {/* 바다 (격자 평면) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={COLORS.sea} roughness={0.85} metalness={0.05} />
        </mesh>
        <Grid
          position={[0, -0.48, 0]}
          args={[200, 200]}
          cellColor={COLORS.grid}
          sectionColor={'#1a5072'}
          cellSize={2}
          sectionSize={10}
          fadeDistance={70}
          fadeStrength={1.2}
          infiniteGrid
        />

        <Rig
          mastBend={shape.mastBend}
          boomAngle={shape.boomAngle}
          boomRise={shape.boomRise}
        />
        <Sail
          geomData={geomData}
          forces={forces}
          showPressure={showPressure}
          wireframe={wireframe}
        />
        {showWind && <WindField wind={wind} />}
        {showStreamlines && <Streamlines geomData={geomData} forces={forces} wind={wind} />}
        {showForces && <ForceArrows forces={forces} wind={wind} />}
        {showTelltales && <Telltales geomData={geomData} forces={forces} />}
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
