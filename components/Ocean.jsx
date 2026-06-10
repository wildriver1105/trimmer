'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// 움직이는 바다 — MeshStandardMaterial의 vertex 단계에 파도 변위를 주입.
// onBeforeCompile 방식이라 표준 라이팅/그림자 수신이 그대로 유지된다.
// 파고는 GPU에서 sin 합성으로 계산하고, 노멀은 유한차분으로 재계산.

const WAVE_GLSL = /* glsl */ `
uniform float uTime;
float waveH(vec2 p, float t) {
  float h = 0.0;
  h += 0.16 * sin(p.x * 0.22 + t * 0.8);
  h += 0.11 * sin(p.x * 0.43 + p.y * 0.61 + t * 1.2);
  h += 0.07 * sin(p.y * 0.90 - t * 0.6);
  h += 0.04 * sin((p.x - p.y) * 1.50 + t * 1.7);
  return h;
}
`;

export function Ocean() {
  const uTime = useMemo(() => ({ value: 0 }), []);

  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = WAVE_GLSL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          float hC = waveH(position.xy, uTime);
          float hEps = 0.5;
          float hX = waveH(position.xy + vec2(hEps, 0.0), uTime);
          float hY = waveH(position.xy + vec2(0.0, hEps), uTime);
          vec3 objectNormal = normalize(vec3(-(hX - hC) / hEps, -(hY - hC) / hEps, 1.0));
          #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
          #endif
          `
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          vec3 transformed = vec3(position);
          transformed.z += hC;
          `
        );
    },
    [uTime]
  );

  useFrame((state) => {
    uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[300, 300, 160, 160]} />
      <meshStandardMaterial
        color={'#0d3a57'}
        roughness={0.42}
        metalness={0.55}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}
