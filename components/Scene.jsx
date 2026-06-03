'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { useSimStore, getActiveSails } from '@/store/useSimStore';
import { buildShape, buildGeometry } from '@/lib/sails';
import { computeWind, computeForces } from '@/lib/aero';
import { Sail } from './Sail';
import { Rig } from './Rig';
import { WindField } from './WindField';
import { ForceArrows } from './ForceArrows';
import { Telltales } from './Telltales';
import { Streamlines } from './Streamlines';
import { SAIL, COLORS } from '@/lib/constants';

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
        {/* 바다 */}
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
          mastBend={mainSail?.shape.mastBend ?? 0}
          boomAngle={mainSail?.shape.boomAngle ?? 0}
          boomRise={mainSail?.shape.boomRise ?? 0}
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

        {showWind && <WindField wind={wind} />}
        {showStreamlines && sails.map(({ key, geomData, forces }) => (
          <Streamlines
            key={`sl-${key}`}
            geomData={geomData}
            forces={forces}
            wind={wind}
            density={streamDensity}
          />
        ))}
        {showForces && sails.map(({ key, forces }) => (
          <ForceArrows key={`fa-${key}`} forces={forces} wind={wind} />
        ))}
        {showTelltales && sails.map(({ key, geomData, forces }) => (
          <Telltales key={`tt-${key}`} geomData={geomData} forces={forces} />
        ))}
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
