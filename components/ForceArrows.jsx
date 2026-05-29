'use client';

import { COLORS } from '@/lib/constants';
import { Arrow } from './WindField';

// 힘 N -> m 표시 스케일. 일반적인 메인세일 작용력(수백~수천 N)에서
// 화살표가 1~7m 정도가 되도록 조정.
const FORCE_SCALE = 0.008;
const MIN_LEN = 1.0;
const MAX_LEN = 7.5;

// 화살표 길이에 비례한 헤드 크기 (작은 화살표는 적당히 큰 헤드, 큰 화살표는 18% 비율)
const headFor = (len) => Math.max(0.55, len * 0.18);

export function ForceArrows({ forces, wind }) {
  if (!forces || !forces.total) return null;
  const { CE } = forces;
  const { lift, drag, drive, heel, liftDir, dragDir } = forces.total;

  const liftLen  = Math.min(MAX_LEN, Math.max(MIN_LEN, lift  * FORCE_SCALE));
  const dragLen  = Math.min(MAX_LEN, Math.max(MIN_LEN * 0.6, drag  * FORCE_SCALE));
  const driveLen = Math.min(MAX_LEN, Math.max(MIN_LEN * 0.8, Math.abs(drive) * FORCE_SCALE));
  const heelLen  = Math.min(MAX_LEN, Math.max(MIN_LEN * 0.8, Math.abs(heel)  * FORCE_SCALE));

  const driveDir = drive >= 0 ? [1, 0, 0] : [-1, 0, 0];
  const heelDir  = heel  >= 0 ? [0, 0, 1] : [0, 0, -1];

  return (
    <group>
      {/* Lift */}
      <Arrow
        from={CE}
        dir={liftDir}
        length={liftLen}
        color={COLORS.lift}
        label={`Lift ${lift.toFixed(0)} N`}
        headSize={headFor(liftLen)}
      />
      {/* Drag */}
      <Arrow
        from={CE}
        dir={dragDir}
        length={dragLen}
        color={COLORS.drag}
        label={`Drag ${drag.toFixed(0)} N`}
        headSize={headFor(dragLen)}
      />
      {/* Drive (보트 진행 방향) */}
      <Arrow
        from={[CE[0], 0.5, CE[2]]}
        dir={driveDir}
        length={driveLen}
        color={COLORS.drive}
        label={`Drive ${drive.toFixed(0)} N`}
        headSize={headFor(driveLen)}
      />
      {/* Heeling */}
      <Arrow
        from={[CE[0], 0.5, CE[2]]}
        dir={heelDir}
        length={heelLen}
        color={COLORS.heel}
        label={`Heel ${heel.toFixed(0)} N`}
        headSize={headFor(heelLen)}
      />
    </group>
  );
}
