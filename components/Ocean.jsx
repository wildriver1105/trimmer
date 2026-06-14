'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Water } from 'three-stdlib';

// 현실적인 바다 — three.js 클래식 Ocean(Water) 셰이더.
// 매 프레임 씬을 reflection 텍스처로 렌더해 하늘·보트를 수면에 반사하고,
// sunDirection 기반의 태양 글리터(specular)를 만든다.
// normal map은 외부 에셋 없이 캔버스에서 tileable하게 생성한다.

// ─── tileable 노멀맵 (sine-sum heightfield → normal) ───
function makeWaterNormals() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);

  // 정수 주파수 사인파 → [0,1] 구간에서 완벽히 타일링됨
  const waves = [];
  for (let i = 0; i < 7; i++) {
    waves.push({
      fx: Math.floor(Math.random() * 6) + 1,
      fy: Math.floor(Math.random() * 6) + 1,
      amp: 1 / (1 + i * 0.8),
      ph: Math.random() * Math.PI * 2,
    });
  }
  const H = (u, v) => {
    let h = 0;
    for (const w of waves) h += w.amp * Math.sin(2 * Math.PI * (w.fx * u + w.fy * v) + w.ph);
    return h;
  };

  const eps = 1 / S;
  const strength = 0.09;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const dx = (H(u + eps, v) - H(u - eps, v)) / (2 * eps);
      const dy = (H(u, v + eps) - H(u, v - eps)) / (2 * eps);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const idx = (y * S + x) * 4;
      img.data[idx] = (nx * 0.5 + 0.5) * 255;
      img.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[idx + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function Ocean({
  sunDirection = [0.5, 0.6, -0.4],
  sunColor = '#ffffff',
  waterColor = '#0a2f3a',
  distortionScale = 2.6,
  level = -0.5,
  size = 4000,
}) {
  const normals = useMemo(makeWaterNormals, []);

  const water = useMemo(() => {
    const geom = new THREE.PlaneGeometry(size, size);
    const w = new Water(geom, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(...sunDirection).normalize(),
      sunColor: new THREE.Color(sunColor),
      waterColor: new THREE.Color(waterColor),
      distortionScale,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.y = level;
    // 잔물결 스케일 — 보트(~10~13 units) 근처에서 적당한 chop이 보이도록
    w.material.uniforms.size.value = 10.0;
    return w;
    // size/normals 변경 시에만 재생성 (sun/color는 uniform 갱신으로 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normals, size, level]);

  // 정리
  useEffect(() => () => water.geometry.dispose(), [water]);

  // sun/color uniform 갱신
  useEffect(() => {
    const u = water.material.uniforms;
    u.sunDirection.value.set(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
    u.sunColor.value.set(sunColor);
    u.waterColor.value.set(waterColor);
    u.distortionScale.value = distortionScale;
  }, [water, sunDirection, sunColor, waterColor, distortionScale]);

  // 파도 흐름 애니메이션
  useFrame((_, dt) => {
    water.material.uniforms.time.value += Math.min(dt, 0.05) * 0.55;
  });

  return <primitive object={water} />;
}
